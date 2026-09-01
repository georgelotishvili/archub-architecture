from io import BytesIO

from PIL import Image

import app as app_module
from app.extensions import db
from app.models import CarouselImage


def seed_carousel():
    inactive = CarouselImage(
        url="static/uploads/carousel/inactive.jpg",
        order=1,
        is_active=False,
    )
    active = CarouselImage(
        url="static/uploads/carousel/active.jpg",
        order=5,
        is_active=True,
    )
    db.session.add_all([active, inactive])
    db.session.commit()
    return inactive.id, active.id


def image_bytes():
    stream = BytesIO()
    Image.new("RGB", (8, 8), color=(40, 80, 120)).save(stream, format="PNG")
    return stream.getvalue()


def test_carousel_all_requires_authentication(client):
    response = client.get("/api/carousel/all")

    assert response.status_code == 401
    assert response.get_json()["success"] is False


def test_carousel_all_rejects_non_admin(
    client, make_user, login_as
):
    user_id = make_user()
    login_as(client, user_id)

    response = client.get("/api/carousel/all")

    assert response.status_code == 403


def test_admin_carousel_all_includes_inactive_images_in_order(
    client, make_user, login_as
):
    inactive_id, active_id = seed_carousel()
    admin_id = make_user(
        username="Administrator",
        email="admin@example.com",
        is_admin=True,
    )
    login_as(client, admin_id)

    response = client.get("/api/carousel/all")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["count"] == 2
    assert [item["id"] for item in body["images"]] == [
        inactive_id,
        active_id,
    ]
    assert [item["is_active"] for item in body["images"]] == [
        False,
        True,
    ]

    public = client.get("/api/carousel").get_json()
    assert [item["id"] for item in public["images"]] == [active_id]


def test_carousel_serialization_failure_rolls_back_row_and_upload(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    admin_id = make_user(
        username="Administrator",
        email="admin@example.com",
        is_admin=True,
    )
    login_as(client, admin_id)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    def fail_serialization(_image):
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(app_module, "serialize_carousel_image", fail_serialization)
    response = client.post(
        "/api/carousel",
        data={"image": (BytesIO(image_bytes()), "carousel.png"), "order": "1"},
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    assert CarouselImage.query.count() == 0
    assert [path for path in tmp_path.rglob("*") if path.is_file()] == []
