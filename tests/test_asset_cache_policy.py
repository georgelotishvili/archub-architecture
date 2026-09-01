def test_code_assets_revalidate_and_render_with_cache_buster(client):
    asset = client.get("/static/js/script.js")
    page = client.get("/")

    assert asset.status_code == 200
    assert asset.headers["Cache-Control"] == (
        "no-cache, max-age=0, must-revalidate"
    )
    html = page.get_data(as_text=True)
    assert "/static/js/script.js?v=" in html
    assert "/static/css/styles.css?v=" in html


def test_missing_upload_is_not_cached_immutably(client):
    response = client.get("/static/uploads/does-not-exist.jpg")

    assert response.status_code == 404
    assert "immutable" not in response.headers.get("Cache-Control", "")


def test_static_version_hook_does_not_override_explicit_version(app):
    values = {"filename": "js/script.js", "v": "release-id"}

    app.url_default_functions[None][0]("static", values)

    assert values["v"] == "release-id"
