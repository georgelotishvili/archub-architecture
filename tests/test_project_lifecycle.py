import json
from io import BytesIO

from PIL import Image
from werkzeug.datastructures import MultiDict

import app as app_module
from app.extensions import db
from app.models import Photo, Project, project_likes


def image_bytes(image_format="PNG"):
    stream = BytesIO()
    Image.new("RGB", (8, 8), color=(40, 80, 120)).save(stream, format=image_format)
    return stream.getvalue()


def make_admin_client(client, make_user, login_as):
    admin_id = make_user(
        username="Administrator",
        email="admin@example.com",
        is_admin=True,
    )
    login_as(client, admin_id)
    return admin_id


def test_missing_project_like_does_not_create_orphan(
    client, make_user, login_as
):
    user_id = make_user()
    login_as(client, user_id)

    response = client.post("/api/projects/999/like")

    assert response.status_code == 404
    assert db.session.query(project_likes).count() == 0


def test_project_api_includes_main_image_in_ordered_photo_list(client):
    project = Project(
        area="120 კვ.მ",
        main_image_url="static/uploads/main/main.jpg",
    )
    db.session.add(project)
    db.session.flush()
    db.session.add_all(
        [
            Photo(
                project_id=project.id,
                url="static/uploads/gallery/second.jpg",
                order=2,
            ),
            Photo(
                project_id=project.id,
                url="static/uploads/gallery/first.jpg",
                order=1,
            ),
        ]
    )
    db.session.commit()

    response = client.get("/api/projects")

    assert response.status_code == 200
    assert response.get_json()["projects"][0]["photos"] == [
        "static/uploads/main/main.jpg",
        "static/uploads/gallery/first.jpg",
        "static/uploads/gallery/second.jpg",
    ]


def test_invalid_gallery_rolls_back_database_and_all_new_files(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))
    payload = MultiDict(
        [
            ("area", "150 კვ.მ"),
            ("main_image", (BytesIO(image_bytes()), "main.png")),
            ("gallery_photos", (BytesIO(image_bytes()), "valid.png")),
            ("gallery_photos", (BytesIO(b"not an image"), "invalid.png")),
        ]
    )

    response = client.post(
        "/api/projects",
        data=payload,
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert Project.query.count() == 0
    assert Photo.query.count() == 0
    assert [path for path in tmp_path.rglob("*") if path.is_file()] == []


def test_response_serialization_failure_rolls_back_project_and_upload(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))

    def fail_serialization(_project):
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(app_module, "project_photo_urls", fail_serialization)
    response = client.post(
        "/api/projects",
        data={
            "area": "110 კვ.მ",
            "main_image": (BytesIO(image_bytes()), "main.png"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    assert Project.query.count() == 0
    assert Photo.query.count() == 0
    assert [path for path in tmp_path.rglob("*") if path.is_file()] == []


def test_promoting_gallery_photo_preserves_previous_main_as_gallery(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))
    old_main_url = "static/uploads/main/old.jpg"
    promoted_url = "static/uploads/gallery/promoted.jpg"
    for relative_url in (old_main_url, promoted_url):
        stored_file = tmp_path / relative_url.removeprefix("static/uploads/")
        stored_file.parent.mkdir(parents=True, exist_ok=True)
        stored_file.write_bytes(image_bytes("JPEG"))

    project = Project(area="90 კვ.მ", main_image_url=old_main_url)
    project.photos.append(Photo(url=promoted_url, order=1))
    db.session.add(project)
    db.session.commit()

    response = client.put(
        f"/api/projects/{project.id}",
        data={
            "area": "95 კვ.მ",
            "main_image_url": promoted_url,
            "photos_order": json.dumps([old_main_url, promoted_url]),
        },
    )

    assert response.status_code == 200
    db.session.expire_all()
    updated = db.session.get(Project, project.id)
    assert updated.main_image_url == promoted_url
    assert [(photo.url, photo.order) for photo in updated.photos] == [
        (old_main_url, 0),
    ]
    assert response.get_json()["project"]["photos"] == [
        promoted_url,
        old_main_url,
    ]
    assert (tmp_path / "main" / "old.jpg").is_file()
    assert (tmp_path / "gallery" / "promoted.jpg").is_file()


def test_photo_add_serialization_failure_rolls_back_new_upload(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))
    project = Project(area="80 კვ.მ", main_image_url="")
    db.session.add(project)
    db.session.commit()

    def fail_serialization(_project):
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(app_module, "project_photo_urls", fail_serialization)
    response = client.post(
        f"/api/projects/{project.id}/photos",
        data={"photos": (BytesIO(image_bytes()), "gallery.png")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    assert Photo.query.count() == 0
    assert [path for path in tmp_path.rglob("*") if path.is_file()] == []


def test_main_upload_serialization_failure_keeps_previous_image(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))
    old_main_url = "static/uploads/main/old.jpg"
    old_file = tmp_path / "main" / "old.jpg"
    old_file.parent.mkdir(parents=True)
    old_file.write_bytes(image_bytes("JPEG"))
    project = Project(area="85 კვ.მ", main_image_url=old_main_url)
    db.session.add(project)
    db.session.commit()

    def fail_serialization(_project):
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(app_module, "project_photo_urls", fail_serialization)
    response = client.put(
        f"/api/projects/{project.id}/main-image",
        data={"main_image": (BytesIO(image_bytes()), "replacement.png")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    db.session.expire_all()
    assert db.session.get(Project, project.id).main_image_url == old_main_url
    assert old_file.is_file()
    assert [path for path in tmp_path.rglob("*") if path.is_file()] == [old_file]


def test_shared_gallery_and_main_file_is_deleted_only_after_last_reference(
    app, client, make_user, login_as, tmp_path, monkeypatch
):
    make_admin_client(client, make_user, login_as)
    monkeypatch.setitem(app.config, "UPLOAD_FOLDER", str(tmp_path))
    relative_url = "static/uploads/gallery/shared.jpg"
    stored_file = tmp_path / "gallery" / "shared.jpg"
    stored_file.parent.mkdir(parents=True)
    stored_file.write_bytes(image_bytes("JPEG"))

    project = Project(area="90 კვ.მ", main_image_url=f"/{relative_url}")
    db.session.add(project)
    db.session.flush()
    db.session.add(Photo(project_id=project.id, url=relative_url, order=0))
    db.session.commit()

    remove_gallery = client.delete(
        f"/api/projects/{project.id}/photos",
        data={"photo_url": relative_url},
    )

    assert remove_gallery.status_code == 200
    assert stored_file.is_file()
    assert Photo.query.count() == 0

    remove_main = client.delete(f"/api/projects/{project.id}/main-image")

    assert remove_main.status_code == 200
    assert not stored_file.exists()


def test_registration_normalizes_email_and_blocks_case_variant(client):
    first = client.post(
        "/api/register",
        json={
            "first_name": "Ana",
            "last_name": "Tester",
            "email": "Person@Example.COM",
            "phone": "+995555123456",
            "password": "strong-password",
        },
    )
    second = client.post(
        "/api/register",
        json={
            "first_name": "Nino",
            "last_name": "Tester",
            "email": "person@example.com",
            "phone": "+995555654321",
            "password": "another-strong-password",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert [user.email for user in db.session.query(__import__('app.models', fromlist=['User']).User).all()] == [
        "person@example.com"
    ]
