import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = (PROJECT_ROOT / "static").resolve()
TEMPLATE_ROOT = PROJECT_ROOT / "templates"

STATIC_URL_FOR_RE = re.compile(
    r"""url_for\(\s*(['"])static\1\s*,[^)]*?"""
    r"""\bfilename\s*=\s*(['"])([^'"]+)\2""",
    re.DOTALL,
)
CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", re.IGNORECASE)
INLINE_URL_RE = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""")
CSS_IMPORT_RE = re.compile(r"""@import\s+(['"])(.*?)\1""", re.IGNORECASE)
ASSET_TAG_RE = re.compile(
    r"""<(?:link|script|img|source|video|audio|object|embed|meta)\b[^>]*>""",
    re.IGNORECASE | re.DOTALL,
)
ASSET_ATTRIBUTE_RE = re.compile(
    r"""\b(?:src|srcset|href|poster|data|content)\s*=\s*(['"])(.*?)\1""",
    re.IGNORECASE | re.DOTALL,
)
ASSET_SUFFIXES = {
    ".css",
    ".js",
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".json",
    ".webmanifest",
}
INLINE_CLASSIC_SCRIPT_RE = re.compile(
    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)


def _line_number(text, offset):
    return text.count("\n", 0, offset) + 1


def _ignored_reference(reference):
    value = reference.strip()
    lowered = value.lower()
    return (
        not value
        or "{{" in value
        or "{%" in value
        or "var(" in lowered
        or lowered.startswith(
            (
                "#",
                "//",
                "http://",
                "https://",
                "data:",
                "blob:",
                "mailto:",
                "tel:",
                "javascript:",
                "about:",
            )
        )
    )


def _resolve_reference(reference, source, css_relative=False):
    if _ignored_reference(reference):
        return None

    path = unquote(urlsplit(reference.strip()).path)
    if not path:
        return None

    if path.startswith("/static/"):
        target = STATIC_ROOT / path.removeprefix("/static/")
    elif path.startswith("static/"):
        target = STATIC_ROOT / path.removeprefix("static/")
    elif css_relative:
        target = source.parent / path
    elif Path(path).suffix.lower() in ASSET_SUFFIXES:
        # A literal asset-bearing HTML reference should use /static/ or
        # url_for('static', ...). Resolve it anyway so a typo fails clearly.
        target = PROJECT_ROOT / path.lstrip("/")
    else:
        return None

    resolved = target.resolve()
    try:
        relative = resolved.relative_to(STATIC_ROOT)
    except ValueError:
        return resolved, None

    if relative.parts and relative.parts[0] == "uploads":
        return None
    return resolved, relative.as_posix()


def _attribute_references(tag):
    for match in ASSET_ATTRIBUTE_RE.finditer(tag):
        value = match.group(2).strip()
        if match.group(0).lstrip().lower().startswith("srcset"):
            if value.lower().startswith("data:"):
                continue
            for candidate in value.split(","):
                parts = candidate.strip().split()
                if parts:
                    yield parts[0], match.start(2)
        else:
            yield value, match.start(2)


def test_all_literal_template_and_css_assets_exist():
    references = set()
    problems = []

    for source in sorted(TEMPLATE_ROOT.glob("*.html")):
        text = source.read_text(encoding="utf-8")

        for match in STATIC_URL_FOR_RE.finditer(text):
            reference = match.group(3)
            resolved = _resolve_reference(f"/static/{reference}", source)
            if resolved is not None:
                target, relative = resolved
                references.add(relative)
                if relative is None or not target.is_file():
                    problems.append(
                        (source, _line_number(text, match.start()), reference, target)
                    )

        for tag_match in ASSET_TAG_RE.finditer(text):
            tag = tag_match.group(0)
            for reference, attribute_offset in _attribute_references(tag):
                resolved = _resolve_reference(reference, source)
                if resolved is None:
                    continue
                target, relative = resolved
                references.add(relative)
                if relative is None or not target.is_file():
                    problems.append(
                        (
                            source,
                            _line_number(
                                text,
                                tag_match.start() + attribute_offset,
                            ),
                            reference,
                            target,
                        )
                    )

        for match in INLINE_URL_RE.finditer(text):
            reference = match.group(2)
            resolved = _resolve_reference(reference, source)
            if resolved is None:
                continue
            target, relative = resolved
            references.add(relative)
            if relative is None or not target.is_file():
                problems.append(
                    (source, _line_number(text, match.start()), reference, target)
                )

    for source in sorted((STATIC_ROOT / "css").glob("*.css")):
        text = source.read_text(encoding="utf-8")
        matches = list(CSS_URL_RE.finditer(text)) + list(
            CSS_IMPORT_RE.finditer(text)
        )
        for match in matches:
            reference = match.group(2)
            resolved = _resolve_reference(reference, source, css_relative=True)
            if resolved is None:
                continue
            target, relative = resolved
            references.add(relative)
            if relative is None or not target.is_file():
                problems.append(
                    (source, _line_number(text, match.start()), reference, target)
                )

    assert references, "No literal static asset references were discovered"
    assert "images/favicon.ico" in references
    assert {"css/styles.css", "css/header.css", "js/script.js"} <= references

    formatted = [
        (
            f"{source.relative_to(PROJECT_ROOT).as_posix()}:{line}: "
            f"{reference!r} -> {target}"
        )
        for source, line, reference, target in sorted(
            problems,
            key=lambda item: (
                item[0].as_posix(),
                item[1],
                item[2],
            ),
        )
    ]
    assert not formatted, "Missing or invalid local static assets:\n" + "\n".join(
        formatted
    )


def test_my_page_classic_scripts_share_valid_global_scope():
    template = (TEMPLATE_ROOT / "my_page.html").read_text(encoding="utf-8")
    inline_scripts = INLINE_CLASSIC_SCRIPT_RE.findall(template)

    assert len(inline_scripts) == 1
    assert template.count("document.addEventListener('DOMContentLoaded'") == 1

    shared_script = (STATIC_ROOT / "js" / "script.js").read_text(
        encoding="utf-8"
    )
    combined_script = "\n".join((shared_script, *inline_scripts))
    result = subprocess.run(
        ["node", "--check", "-"],
        input=combined_script,
        capture_output=True,
        check=False,
        encoding="utf-8",
    )

    assert result.returncode == 0, (
        "The shared and /my-page classic scripts cannot coexist in one global "
        f"scope:\n{result.stderr}"
    )
