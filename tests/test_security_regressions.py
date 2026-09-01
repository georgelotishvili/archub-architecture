import os
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy.exc import IntegrityError

import app as app_module
from app.extensions import db
from app.models import User


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def run_production_import(
    secret=None,
    code="import app",
    flask_env="production",
    extra_env=None,
):
    env = os.environ.copy()
    database_path = Path(
        tempfile.gettempdir(),
        f"archub-security-{os.getpid()}-app.db",
    ).resolve().as_posix()
    env.update(
        FLASK_ENV=flask_env,
        DATABASE_URL=f"sqlite:///{database_path}",
        BASE_URL="https://archub.ge",
        PYTHONDONTWRITEBYTECODE="1",
    )
    if secret is None:
        env.pop("SECRET_KEY", None)
    else:
        env["SECRET_KEY"] = secret
    rate_limit_path = Path(
        tempfile.gettempdir(),
        f"archub-security-{os.getpid()}-rate-limits.db",
    ).resolve().as_posix()
    env["RATELIMIT_STORAGE_URI"] = f"sqlite-rate-limit:///{rate_limit_path}"
    if extra_env:
        env.update(extra_env)

    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
        check=False,
    )


def test_production_rejects_relative_sqlite_database_url():
    result = run_production_import(
        "d" * 64,
        extra_env={"DATABASE_URL": "sqlite:///database.db"},
    )

    assert result.returncode != 0
    assert "absolute file path" in result.stderr


def test_database_rejects_case_variant_user_emails():
    first = User(
        username="First User",
        email="Person@Example.com",
        password_hash="not-used",
    )
    second = User(
        username="Second User",
        email="person@example.com",
        password_hash="not-used",
    )
    db.session.add_all([first, second])

    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_production_fails_closed_without_unique_secret():
    result = run_production_import()

    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr


def test_production_starts_with_strong_secret_and_hsts():
    code = """
from app import app
response = app.test_client().get('/robots.txt', base_url='https://archub.ge')
assert response.status_code == 200
assert response.headers['Strict-Transport-Security'] == (
    'max-age=31536000; includeSubDomains'
)
"""
    result = run_production_import("a" * 64, code)

    assert result.returncode == 0, result.stderr


def test_live_wsgi_entrypoint_forces_production_environment():
    code = """
import os
from hosting.wsgi import application
assert os.environ['FLASK_ENV'] == 'production'
assert application.config['DEBUG'] is False
assert application.config['SESSION_COOKIE_SECURE'] is True
"""
    result = run_production_import(
        "b" * 64,
        code=code,
        flask_env="development",
    )

    assert result.returncode == 0, result.stderr


def test_http_and_untrusted_host_redirect_to_canonical_origin(
    app, client, monkeypatch
):
    monkeypatch.setitem(app.config, "FORCE_HTTPS", True)
    monkeypatch.setitem(app.config, "BASE_URL", "https://archub.ge")

    response = client.get(
        "/api/status?next=%2Fadmin",
        base_url="http://attacker.invalid",
    )

    assert response.status_code == 308
    target = urlsplit(response.headers["Location"])
    assert target.scheme == "https"
    assert target.netloc == "archub.ge"
    assert target.path == "/api/status"
    assert parse_qs(target.query) == {"next": ["/admin"]}


def test_trusted_one_hop_proxy_sets_external_scheme_host_and_client():
    code = """
from flask import jsonify, request, url_for
from app import app

forwarded_headers = {
    'X-Forwarded-For': '198.51.100.10, 203.0.113.42',
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Host': 'internal.invalid, archub.ge',
    'X-Forwarded-Port': '443',
}

@app.get('/_proxy_probe')
def proxy_probe():
    return jsonify({
        'scheme': request.scheme,
        'host': request.host,
        'remote_addr': request.remote_addr,
        'external_home': url_for('home', _external=True),
    })

response = app.test_client().get(
    '/_proxy_probe',
    base_url='http://internal.invalid:8000',
    headers=forwarded_headers,
)
assert response.status_code == 200
assert response.get_json() == {
    'scheme': 'https',
    'host': 'archub.ge',
    'remote_addr': '203.0.113.42',
    'external_home': 'https://archub.ge/',
}
"""
    result = run_production_import(
        "c" * 64,
        code=code,
        extra_env={"TRUST_PROXY_HEADERS": "true"},
    )

    assert result.returncode == 0, result.stderr


def test_forwarded_proto_is_ignored_without_trusted_proxy(
    app, client, monkeypatch
):
    monkeypatch.setitem(app.config, "FORCE_HTTPS", True)
    monkeypatch.setitem(app.config, "BASE_URL", "https://archub.ge")
    monkeypatch.setitem(app.config, "TRUST_PROXY_HEADERS", False)

    response = client.get(
        "/api/status",
        base_url="http://archub.ge",
        headers={"X-Forwarded-Proto": "https"},
    )

    assert response.status_code == 308
    assert response.headers["Location"] == "https://archub.ge/api/status"


def test_rate_limit_key_uses_proxy_overwritten_real_ip(app, monkeypatch):
    monkeypatch.setitem(app.config, "TRUST_PROXY_HEADERS", True)

    with app.test_request_context(
        "/api/login",
        environ_base={"REMOTE_ADDR": "127.0.0.1"},
        headers={
            "X-Real-IP": "203.0.113.7",
            "X-Forwarded-For": "198.51.100.12, 203.0.113.7",
        },
    ):
        assert app_module.rate_limit_key() == "203.0.113.7"


def test_security_headers_are_added_to_normal_and_error_responses(client):
    for path in ("/api/status", "/api/does-not-exist"):
        response = client.get(path)

        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert (
            response.headers["Referrer-Policy"]
            == "strict-origin-when-cross-origin"
        )
        assert response.headers["X-Permitted-Cross-Domain-Policies"] == "none"
        assert response.headers["Cross-Origin-Opener-Policy"] == "same-origin"

        permissions = response.headers["Permissions-Policy"]
        for directive in (
            "camera=()",
            "microphone=()",
            "geolocation=()",
            "payment=()",
        ):
            assert directive in permissions

        csp = response.headers["Content-Security-Policy"]
        assert "default-src 'self'" in csp
        assert "object-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp


def test_authenticated_and_user_specific_apis_are_never_cached(
    client, make_user, login_as
):
    admin_id = make_user(
        username="Cache Administrator",
        email="cache-admin@example.com",
        is_admin=True,
    )
    target_id = make_user(
        username="Cache Target",
        email="cache-target@example.com",
    )
    login_as(client, admin_id)

    responses = (
        client.get("/api/projects"),
        client.get("/api/carousel/all"),
        client.get(f"/api/admin/user/{target_id}/liked-projects"),
    )

    assert all(response.status_code == 200 for response in responses)
    assert all(response.headers["Cache-Control"] == "no-store" for response in responses)


@pytest.mark.parametrize(
    "path",
    [
        "/api/register",
        "/api/login",
        "/api/forgot-password",
        "/api/reset-password",
        "/api/contact",
    ],
)
def test_malformed_json_is_always_a_json_400(client, path):
    response = client.post(
        path,
        data='{"broken"',
        content_type="application/json",
    )

    assert response.status_code == 400, (
        path,
        response.get_data(as_text=True),
    )
    assert response.is_json
    assert response.get_json()["success"] is False


@pytest.mark.parametrize("body", ("[]", '"text"', "null"))
def test_non_object_json_is_rejected(client, body):
    response = client.post(
        "/api/register",
        data=body,
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.is_json
    assert response.get_json()["success"] is False


def test_reset_link_never_uses_request_host(
    app, client, make_user, monkeypatch
):
    email = "owner@example.com"
    make_user(username="Owner", email=email)

    monkeypatch.setitem(app.config, "BASE_URL", "https://archub.ge")
    monkeypatch.setattr(
        app_module,
        "validate_email",
        lambda value, **kwargs: SimpleNamespace(normalized=value.lower()),
    )

    captured = {}

    def capture_email(to_email, username, reset_url):
        captured["url"] = reset_url

    monkeypatch.setattr(app_module, "send_reset_email", capture_email)
    monkeypatch.setattr(
        app_module, "queue_reset_email", app_module._process_reset_email
    )
    response = client.post(
        "/api/forgot-password",
        json={"email": email},
        base_url="http://attacker.invalid",
    )

    assert response.status_code == 200
    parsed = urlsplit(captured["url"])
    assert parsed.scheme == "https"
    assert parsed.netloc == "archub.ge"
    assert parsed.path == "/reset-password"
    assert "attacker.invalid" not in captured["url"]

    token = parse_qs(parsed.query)["token"][0]
    stored_digest = User.query.filter_by(email=email).one().reset_token
    assert stored_digest != token
    assert stored_digest == User.reset_token_digest(token)


def test_expired_reset_link_renders_error_instead_of_opening_form(client):
    response = client.get("/reset-password?token=" + ("x" * 32))

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "data-reset-error=" in html
    assert "არასწორი ან ვადაგასული ბმული" in html


class EventMarkerParser(HTMLParser):
    def __init__(self, marker):
        super().__init__(convert_charrefs=True)
        self.marker = marker
        self.unsafe_handlers = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if (
                name.lower().startswith("on")
                and value
                and self.marker in value
            ):
                self.unsafe_handlers.append((tag, name, value))


def test_registration_payload_cannot_escape_into_admin_html(
    client, make_user, login_as, monkeypatch
):
    marker = "__archub_xss_7331"
    malicious_name = (
        f"Ana');window.{marker}=1;//"
        f"<img src=x onerror=window.{marker}=1>"
    )
    email = "xss-test@example.com"

    monkeypatch.setattr(
        app_module,
        "validate_email",
        lambda value, **kwargs: SimpleNamespace(normalized=value.lower()),
    )

    response = client.post(
        "/api/register",
        json={
            "first_name": malicious_name,
            "last_name": "Tester",
            "email": email,
            "phone": "+995555123456",
            "password": "strong-test-password",
        },
    )
    assert response.status_code == 201

    registered = User.query.filter_by(email=email).one()
    admin_id = make_user(
        username="Administrator",
        email="admin@example.com",
        is_admin=True,
    )
    login_as(client, admin_id)

    response = client.get("/admin/users")
    assert response.status_code == 200

    html = response.get_data(as_text=True)
    assert "<img src=x onerror=" not in html

    parser = EventMarkerParser(marker)
    parser.feed(html)
    assert parser.unsafe_handlers == []
    assert registered.id is not None
