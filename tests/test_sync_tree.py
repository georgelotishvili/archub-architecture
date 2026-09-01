import os
from pathlib import Path
import subprocess
import sys

import pytest

from deployment import sync_tree


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SYNC_SCRIPT = PROJECT_ROOT / "deployment" / "sync_tree.py"


def write_file(root, relative, content):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def snapshot_tree(root):
    snapshot = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            snapshot[relative] = ("symlink", os.readlink(path))
        elif path.is_dir():
            snapshot[relative] = ("directory", None)
        else:
            snapshot[relative] = ("file", path.read_bytes())
    return snapshot


def call_sync(source, destination, home_root):
    return sync_tree.sync_tree(
        source,
        destination,
        home_root=home_root,
    )


def test_sync_preserves_runtime_data_and_leaves_stale_code_untouched(tmp_path):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()

    write_file(source, "app/current.py", "new release")
    write_file(source, "templates/index.html", "new template")
    write_file(source, ".env", "release must not replace this")
    write_file(source, "static/uploads/injected.jpg", "release upload")
    write_file(source, "tmp/restart.txt", "release restart")

    write_file(destination, "app/current.py", "old release")
    write_file(destination, "obsolete.py", "stale code")
    protected = {
        ".env": "live secret",
        ".env.production": "live production secret",
        ".htaccess": "live passenger config",
        "database.db": "live database",
        "database.db-wal": "live database wal",
        "rate_limits.db": "live limiter",
        "rate_limits.db-shm": "live limiter shm",
        "static/uploads/customer.jpg": "customer upload",
        "tmp/restart.txt": "live restart marker",
        "logs/app.log": "live log",
        "venv/bin/python": "live virtualenv",
        "app/__pycache__/cache.pyc": "live bytecode",
        "diagnostic.log": "live diagnostic",
    }
    for relative, content in protected.items():
        write_file(destination, relative, content)

    call_sync(source, destination, tmp_path)

    assert (destination / "app/current.py").read_text(encoding="utf-8") == "new release"
    assert (destination / "templates/index.html").read_text(encoding="utf-8") == "new template"
    assert (destination / "obsolete.py").read_text(
        encoding="utf-8"
    ) == "stale code"
    for relative, content in protected.items():
        assert (destination / relative).read_text(encoding="utf-8") == content
    assert not (destination / "static/uploads/injected.jpg").exists()


def test_staging_failure_leaves_destination_byte_for_byte_unchanged(
    tmp_path, monkeypatch
):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "app/new.py", "new")
    write_file(destination, "app/new.py", "old")
    write_file(destination, "stale.py", "must remain")
    before = snapshot_tree(destination)

    def fail_staging(*_args, **_kwargs):
        raise OSError("injected staging failure")

    monkeypatch.setattr(sync_tree, "_stage_file", fail_staging)

    with pytest.raises(OSError, match="injected staging failure"):
        call_sync(source, destination, tmp_path)

    assert snapshot_tree(destination) == before


def test_install_failure_does_not_delete_stale_destination_entries(
    tmp_path, monkeypatch
):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "app/new.py", "new")
    stale = write_file(destination, "stale.py", "must remain until success")

    def fail_install(*_args, **_kwargs):
        raise OSError("injected install failure")

    monkeypatch.setattr(sync_tree, "_install_file", fail_install)

    with pytest.raises(OSError, match="injected install failure"):
        call_sync(source, destination, tmp_path)

    assert stale.read_text(encoding="utf-8") == "must remain until success"


def test_source_and_destination_symlinks_are_rejected(tmp_path):
    external = write_file(tmp_path, "outside.txt", "outside")

    source = tmp_path / "release-source-link"
    destination = tmp_path / "live-source-link"
    source.mkdir()
    destination.mkdir()
    try:
        os.symlink(external, source / "escape.py")
    except (OSError, NotImplementedError) as error:
        pytest.skip(f"symlinks unavailable: {error}")

    with pytest.raises(Exception, match="[Ss]ymlink"):
        call_sync(source, destination, tmp_path)

    source_two = tmp_path / "release-destination-link"
    destination_two = tmp_path / "live-destination-link"
    source_two.mkdir()
    destination_two.mkdir()
    write_file(source_two, "safe.py", "safe")
    os.symlink(external, destination_two / "escape.py")

    with pytest.raises(Exception, match="[Ss]ymlink"):
        call_sync(source_two, destination_two, tmp_path)


def test_overlapping_source_and_destination_are_rejected(tmp_path):
    source = tmp_path / "release"
    destination = source / "nested-live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "app.py", "release")

    with pytest.raises(Exception, match="overlap|inside|nested|distinct"):
        call_sync(source, destination, tmp_path)


def test_type_conflict_is_rejected_before_mutation(tmp_path):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "package/module.py", "new")
    write_file(destination, "package", "existing file conflicts with directory")
    write_file(destination, "stale.py", "must remain")
    before = snapshot_tree(destination)

    with pytest.raises(Exception, match="[Tt]ype|conflict|directory|file"):
        call_sync(source, destination, tmp_path)

    assert snapshot_tree(destination) == before


def test_source_change_during_staging_is_rejected_before_live_mutation(
    tmp_path, monkeypatch
):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    source_file = write_file(source, "app/new.py", "new")
    write_file(destination, "app/new.py", "old")
    before = snapshot_tree(destination)
    original_stage_file = sync_tree._stage_file

    def stage_then_mutate(path, staged, expected):
        original_stage_file(path, staged, expected)
        source_file.write_text("changed after staging", encoding="utf-8")

    monkeypatch.setattr(sync_tree, "_stage_file", stage_then_mutate)

    with pytest.raises(Exception, match="source changed"):
        call_sync(source, destination, tmp_path)

    assert snapshot_tree(destination) == before


def test_validate_only_cli_never_mutates_destination(tmp_path):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "app.py", "new")
    write_file(destination, "app.py", "old")
    before = snapshot_tree(destination)

    result = subprocess.run(
        [
            sys.executable,
            str(SYNC_SCRIPT),
            "--source",
            str(source),
            "--destination",
            str(destination),
            "--home-root",
            str(tmp_path),
            "--validate-only",
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "SYNC_TREE_STATUS=validated" in result.stdout
    assert snapshot_tree(destination) == before


def test_cli_and_deploy_rollback_use_the_same_sync_helper(tmp_path):
    source = tmp_path / "release"
    destination = tmp_path / "live"
    source.mkdir()
    destination.mkdir()
    write_file(source, "app.py", "new")

    result = subprocess.run(
        [
            sys.executable,
            str(SYNC_SCRIPT),
            "--source",
            str(source),
            "--destination",
            str(destination),
            "--home-root",
            str(tmp_path),
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert (destination / "app.py").read_text(encoding="utf-8") == "new"

    deploy_script = (PROJECT_ROOT / "deployment" / "deploy.sh").read_text(
        encoding="utf-8"
    )
    assert "sync_tree.py" in deploy_script
    assert "archub_require_command rsync" not in deploy_script
    assert deploy_script.count("archub_sync_code_tree ") == 2
    assert 'ARCHUB_SYNC_HELPER_PATH="$ARCHUB_BACKUP_DIR_RESULT/sync_tree.py"' in deploy_script
    assert "Run deploy.sh from the release source" in deploy_script
    assert "failed_release_only_files_removed=0" in deploy_script
