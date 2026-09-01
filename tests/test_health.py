from app.extensions import db
from app.models import ContactSubmission


def test_healthz_checks_database(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_healthz_returns_503_without_leaking_database_error(
    client, monkeypatch
):
    marker = "private-database-error-7331"

    def fail_execute(self, *args, **kwargs):
        raise RuntimeError(marker)

    monkeypatch.setattr(type(db.session), "execute", fail_execute)

    response = client.get("/healthz")

    assert response.status_code == 503
    assert response.get_json() == {"status": "error"}
    assert marker not in response.get_data(as_text=True)


def test_healthz_returns_503_when_required_table_is_missing(app, client):
    with app.app_context():
        ContactSubmission.__table__.drop(db.engine)

    response = client.get("/healthz")

    assert response.status_code == 503
    assert response.get_json() == {"status": "error"}
