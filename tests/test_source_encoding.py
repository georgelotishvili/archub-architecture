from pathlib import Path


SOURCE_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".md",
    ".py",
    ".sh",
    ".txt",
}
EXCLUDED_PARTS = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "static/uploads",
    "venv",
}
MOJIBAKE_PREFIX = chr(0x0431) + chr(0x0453)


def test_source_files_are_utf8_without_common_mojibake():
    failures = []
    for path in Path(".").rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        normalized = path.as_posix()
        if any(part in normalized for part in EXCLUDED_PARTS):
            continue
        text = path.read_text(encoding="utf-8")
        if MOJIBAKE_PREFIX in text:
            failures.append(f"{normalized}: Cyrillic mojibake marker")
        if "\ufffd" in text:
            failures.append(f"{normalized}: Unicode replacement character")
        if any(0x80 <= ord(character) <= 0x9F for character in text):
            failures.append(f"{normalized}: C1 control character")

    assert failures == []
