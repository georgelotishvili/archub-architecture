#!/usr/bin/env python3
"""Safely overlay an Archub release without deleting live runtime state."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import uuid


class SyncTreeError(RuntimeError):
    """Raised when an overlay cannot be proven safe."""


def _is_reparse_point(metadata: os.stat_result) -> bool:
    """Return whether Windows marked an entry as a junction/reparse point."""
    attributes = getattr(metadata, 'st_file_attributes', 0)
    reparse_flag = getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0)
    return bool(reparse_flag and attributes & reparse_flag)


def _same_file_identity(
    current: os.stat_result, expected: os.stat_result
) -> bool:
    """Detect release files that changed after the initial safety scan."""
    stable_fields = ('st_mode', 'st_size', 'st_mtime_ns')
    if any(
        getattr(current, field) != getattr(expected, field)
        for field in stable_fields
    ):
        return False
    for field in ('st_dev', 'st_ino'):
        current_value = getattr(current, field, 0)
        expected_value = getattr(expected, field, 0)
        if current_value and expected_value and current_value != expected_value:
            return False
    return True


def _is_protected(relative: str) -> bool:
    parts = tuple(part for part in relative.split("/") if part)
    if not parts:
        return False
    name = parts[-1]
    if parts[0] == ".git":
        return True
    if len(parts) == 1 and (
        name in {".env", ".htaccess", "database.db", "rate_limits.db"}
        or name.startswith(".env.")
        or name.startswith("database.db-")
        or name.startswith("rate_limits.db-")
    ):
        return True
    if parts[0] in {"tmp", "logs", "venv"}:
        return True
    if len(parts) >= 2 and parts[:2] == ("static", "uploads"):
        return True
    if "__pycache__" in parts:
        return True
    return name.endswith((".pyc", ".pyo", ".log"))


def _resolve_directory(path, label: str) -> Path:
    candidate = Path(path).absolute()
    try:
        candidate_metadata = candidate.lstat()
    except OSError as error:
        raise SyncTreeError(f'{label} cannot be inspected: {error}') from error
    if _is_reparse_point(candidate_metadata):
        raise SyncTreeError(f'{label} cannot be a reparse point')
    if candidate.is_symlink():
        raise SyncTreeError(f"{label} cannot be a symlink")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError as error:
        raise SyncTreeError(f"{label} cannot be resolved: {error}") from error
    if not resolved.is_dir():
        raise SyncTreeError(f"{label} must be a directory")
    return resolved


def _is_within(path: Path, parent: Path) -> bool:
    try:
        return os.path.commonpath((str(path), str(parent))) == str(parent)
    except ValueError:
        return False


def _validate_roots(source, destination, home_root) -> tuple[Path, Path, Path]:
    home = _resolve_directory(home_root, "home root")
    source_root = _resolve_directory(source, "source")
    destination_root = _resolve_directory(destination, "destination")
    if not _is_within(source_root, home) or not _is_within(destination_root, home):
        raise SyncTreeError("source and destination must stay inside home root")
    if source_root in {home, destination_root} or destination_root == home:
        raise SyncTreeError("source and destination must be distinct children of home root")
    if _is_within(source_root, destination_root) or _is_within(
        destination_root, source_root
    ):
        raise SyncTreeError("source and destination cannot overlap or be nested")
    return source_root, destination_root, home


def _scan_tree(root: Path) -> tuple[dict[str, os.stat_result], dict[str, os.stat_result]]:
    directories: dict[str, os.stat_result] = {}
    files: dict[str, os.stat_result] = {}
    stack = [(root, "")]

    while stack:
        directory, prefix = stack.pop()
        try:
            entries = sorted(os.scandir(directory), key=lambda entry: entry.name)
        except OSError as error:
            raise SyncTreeError(f"cannot scan {directory}: {error}") from error
        for entry in entries:
            relative = f"{prefix}/{entry.name}" if prefix else entry.name
            relative = relative.replace(os.sep, "/")
            early_metadata = entry.stat(follow_symlinks=False)
            if _is_reparse_point(early_metadata):
                raise SyncTreeError(f'reparse point is not allowed: {relative}')
            if entry.is_symlink():
                raise SyncTreeError(f"symlink is not allowed: {relative}")
            if _is_protected(relative):
                continue
            try:
                metadata = entry.stat(follow_symlinks=False)
            except OSError as error:
                raise SyncTreeError(f"cannot inspect {relative}: {error}") from error
            if stat.S_ISDIR(metadata.st_mode):
                directories[relative] = metadata
                stack.append((Path(entry.path), relative))
            elif stat.S_ISREG(metadata.st_mode):
                files[relative] = metadata
            else:
                raise SyncTreeError(f"special filesystem entry is not allowed: {relative}")
    return directories, files


def _copy_regular_file(
    source: Path,
    destination: Path,
    expected: os.stat_result | None = None,
) -> None:
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(source, flags)
    try:
        metadata = os.fstat(descriptor)
        if expected is not None and not _same_file_identity(metadata, expected):
            raise SyncTreeError(f'source changed before copying: {source}')
        if not stat.S_ISREG(metadata.st_mode):
            raise SyncTreeError(f"source changed type while copying: {source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with os.fdopen(descriptor, "rb", closefd=False) as input_file:
            with destination.open("xb") as output_file:
                shutil.copyfileobj(input_file, output_file, length=1024 * 1024)
                output_file.flush()
                os.fsync(output_file.fileno())
        after_copy = os.fstat(descriptor)
        if expected is not None and not _same_file_identity(after_copy, expected):
            raise SyncTreeError(f'source changed while copying: {source}')
        os.chmod(destination, stat.S_IMODE(metadata.st_mode))
        os.utime(
            destination,
            ns=(metadata.st_atime_ns, metadata.st_mtime_ns),
        )
    finally:
        os.close(descriptor)


def _stage_file(
    source: Path, staged: Path, expected: os.stat_result | None = None
) -> None:
    """Copy one validated release file into private staging."""
    _copy_regular_file(source, staged, expected)


def _safe_destination_parent(destination_root: Path, relative: str) -> Path:
    parent = destination_root
    for part in Path(relative).parts[:-1]:
        parent = parent / part
        if parent.exists():
            metadata = parent.lstat()
            if _is_reparse_point(metadata):
                raise SyncTreeError(f'unsafe destination reparse point: {relative}')
            if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
                raise SyncTreeError(f"unsafe destination parent: {relative}")
        else:
            parent.mkdir(mode=0o700)
    return parent


def _install_file(staged: Path, destination: Path) -> None:
    """Atomically replace one live file from a completely prepared stage."""
    temporary = destination.parent / (
        f".archub-sync-{destination.name}-{uuid.uuid4().hex}.tmp"
    )
    try:
        _copy_regular_file(staged, temporary)
        if destination.exists() and destination.is_dir():
            raise SyncTreeError(f"destination type conflict: {destination}")
        if destination.exists() and _is_reparse_point(destination.lstat()):
            raise SyncTreeError(f'destination reparse point is not allowed: {destination}')
        if destination.is_symlink():
            raise SyncTreeError(f"destination symlink is not allowed: {destination}")
        os.replace(temporary, destination)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def _reject_type_conflicts(
    source_directories: dict[str, os.stat_result],
    source_files: dict[str, os.stat_result],
    destination_directories: dict[str, os.stat_result],
    destination_files: dict[str, os.stat_result],
) -> None:
    source_directory_keys = {os.path.normcase(path) for path in source_directories}
    source_file_keys = {os.path.normcase(path) for path in source_files}
    destination_directory_keys = {
        os.path.normcase(path) for path in destination_directories
    }
    destination_file_keys = {os.path.normcase(path) for path in destination_files}
    normalized_conflicts = sorted(
        source_directory_keys.intersection(destination_file_keys)
        | source_file_keys.intersection(destination_directory_keys)
    )
    if normalized_conflicts:
        raise SyncTreeError(
            f'source/destination case or type conflict: {normalized_conflicts[0]}'
        )
    directory_over_files = set(source_directories).intersection(destination_files)
    files_over_directories = set(source_files).intersection(destination_directories)
    conflicts = sorted(directory_over_files | files_over_directories)
    if conflicts:
        raise SyncTreeError(f"source/destination type conflict: {conflicts[0]}")


def _inspect_trees(source, destination, home_root):
    source_root, destination_root, home = _validate_roots(
        source, destination, home_root
    )
    source_directories, source_files = _scan_tree(source_root)
    destination_directories, destination_files = _scan_tree(destination_root)
    _reject_type_conflicts(
        source_directories,
        source_files,
        destination_directories,
        destination_files,
    )
    return source_root, destination_root, home, source_directories, source_files


def sync_tree(source, destination, home_root=None) -> dict[str, int]:
    """Overlay release code after complete staging; never delete live entries."""
    if home_root is None:
        home_root = Path(destination).absolute().parent
    (
        source_root,
        destination_root,
        home,
        source_directories,
        source_files,
    ) = _inspect_trees(
        source, destination, home_root
    )

    stage = Path(tempfile.mkdtemp(prefix=".archub-sync-stage-", dir=home))
    try:
        for relative in sorted(source_directories, key=lambda value: (value.count("/"), value)):
            (stage / relative).mkdir(mode=0o700, parents=True, exist_ok=False)
        for relative in sorted(source_files):
            source_path = source_root / relative
            before = source_path.lstat()
            expected = source_files[relative]
            if not _same_file_identity(before, expected):
                raise SyncTreeError(f'source changed after safety scan: {relative}')
            _stage_file(source_path, stage / relative, expected)
            after = source_path.lstat()
            if not _same_file_identity(after, expected):
                raise SyncTreeError(f'source changed while staging: {relative}')

        staged_directories, staged_files = _scan_tree(stage)
        if set(staged_directories) != set(source_directories) or set(staged_files) != set(
            source_files
        ):
            raise SyncTreeError("staged release manifest does not match source")

        for relative in sorted(source_directories, key=lambda value: (value.count("/"), value)):
            destination_directory = destination_root / relative
            if destination_directory.exists():
                metadata = destination_directory.lstat()
                if _is_reparse_point(metadata):
                    raise SyncTreeError(f'destination reparse point: {relative}')
                if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
                    raise SyncTreeError(f"destination type conflict: {relative}")
            else:
                destination_directory.mkdir(mode=0o700)

        for relative in sorted(source_files):
            _safe_destination_parent(destination_root, relative)
            _install_file(stage / relative, destination_root / relative)

        for relative, metadata in sorted(
            source_directories.items(),
            key=lambda item: (item[0].count("/"), item[0]),
            reverse=True,
        ):
            os.chmod(destination_root / relative, stat.S_IMODE(metadata.st_mode))

        return {
            "directories": len(source_directories),
            "files": len(source_files),
            "deleted": 0,
        }
    finally:
        if stage.parent == home and stage.name.startswith(".archub-sync-stage-"):
            shutil.rmtree(stage, ignore_errors=True)


synchronize_tree = sync_tree


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safely overlay an Archub release without deleting live files."
    )
    parser.add_argument("--source", required=True)
    parser.add_argument("--destination", required=True)
    parser.add_argument("--home-root", required=True)
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="inspect source and destination without staging or changing files",
    )
    return parser


def main(argv=None) -> int:
    arguments = _build_parser().parse_args(argv)
    try:
        if arguments.validate_only:
            inspected = _inspect_trees(
                arguments.source,
                arguments.destination,
                arguments.home_root,
            )
            result = {
                "directories": len(inspected[3]),
                "files": len(inspected[4]),
                "deleted": 0,
            }
        else:
            result = sync_tree(
                arguments.source,
                arguments.destination,
                home_root=arguments.home_root,
            )
    except (SyncTreeError, OSError) as error:
        print(f"sync_tree: {error}", file=sys.stderr)
        return 1
    status = "validated" if arguments.validate_only else "success"
    print(
        f"SYNC_TREE_STATUS={status} "
        f"FILES={result['files']} DIRECTORIES={result['directories']} DELETED=0"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
