import itertools
import os

import pytest

# The application chooses its configuration at import time. These values must be
# set before importing the global Flask application.
os.environ["FLASK_ENV"] = "testing"
os.environ["SECRET_KEY"] = "pytest-only-secret-key-that-is-never-used-live"

from app import app as flask_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import User  # noqa: E402


_ip_counter = itertools.count(1)


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    """A test-only app configuration that cannot touch production data."""
    flask_app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
        FORCE_HTTPS=False,
        BASE_URL="https://archub.ge",
        UPLOAD_FOLDER=str(tmp_path_factory.mktemp("uploads")),
    )
    yield flask_app


@pytest.fixture(autouse=True)
def isolated_database(app):
    """Recreate only the in-memory testing database for every test."""
    with app.app_context():
        db.session.remove()
        db.drop_all()
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    test_client = app.test_client()
    number = next(_ip_counter)
    # Avoid cross-test rate-limit coupling while keeping rate limiting enabled.
    test_client.environ_base["REMOTE_ADDR"] = (
        f"192.0.{(number // 254) % 254}.{number % 254 + 1}"
    )
    return test_client


@pytest.fixture
def make_user():
    def create_user(
        *,
        username="Test User",
        email="user@example.com",
        password="strong-test-password",
        is_admin=False,
    ):
        user = User(username=username, email=email, is_admin=is_admin)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user.id

    return create_user


@pytest.fixture
def login_as():
    def login(test_client, user_id):
        with test_client.session_transaction() as session:
            session["_user_id"] = str(user_id)
            session["_fresh"] = True

    return login
