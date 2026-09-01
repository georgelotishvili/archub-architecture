from io import BytesIO
from pathlib import PurePosixPath

from PIL import Image
from werkzeug.datastructures import FileStorage

import app as app_module


def image_bytes(image_format):
    stream = BytesIO()
    Image.new("RGB", (4, 4), color=(20, 40, 60)).save(
        stream,
        format=image_format,
    )
    return stream.getvalue()


def upload(filename, content):
    return FileStorage(
        stream=BytesIO(content),
        filename=filename,
        content_type="application/octet-stream",
    )


def saved_path(upload_root, url):
    relative = PurePosixPath(url).relative_to("static/uploads")
    return upload_root.joinpath(*relative.parts)


def test_valid_image_is_saved_in_temporary_upload_directory(
    app, tmp_path, monkeypatch
):
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    url = app_module.save_uploaded_file(
        upload("photo.png", image_bytes("PNG")),
        "main",
    )

    assert url.startswith("static/uploads/main/")
    assert url.endswith(".png")
    assert saved_path(tmp_path, url).is_file()


def test_fake_image_with_allowed_extension_is_rejected(
    app, tmp_path, monkeypatch
):
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    result = app_module.save_uploaded_file(
        upload("malware.png", b"this is not an image"),
        "main",
    )

    assert result is None
    assert not list(tmp_path.rglob("*"))


def test_real_image_with_disallowed_filename_extension_is_rejected(
    app, tmp_path, monkeypatch
):
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    result = app_module.save_uploaded_file(
        upload("photo.svg", image_bytes("PNG")),
        "main",
    )

    assert result is None
    assert not list(tmp_path.rglob("*"))


def test_saved_extension_comes_from_real_content_not_claimed_extension(
    app, tmp_path, monkeypatch
):
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    url = app_module.save_uploaded_file(
        upload("claimed-as-png.png", image_bytes("JPEG")),
        "gallery",
    )

    assert url.endswith(".jpg")
    path = saved_path(tmp_path, url)
    assert path.is_file()

    with Image.open(path) as image:
        assert image.format == "JPEG"


def test_unknown_upload_subfolder_is_rejected(
    app, tmp_path, monkeypatch
):
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    result = app_module.save_uploaded_file(
        upload("photo.png", image_bytes("PNG")),
        "../outside",
    )

    assert result is None
    assert not list(tmp_path.rglob("*"))
