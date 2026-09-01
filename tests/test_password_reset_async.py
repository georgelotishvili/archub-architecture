from types import SimpleNamespace

import app as app_module


def test_reset_email_delivery_is_queued_before_response(client, monkeypatch):
    queued = []
    monkeypatch.setattr(
        app_module,
        "validate_email",
        lambda value, **kwargs: SimpleNamespace(normalized=value.lower()),
    )
    monkeypatch.setattr(
        app_module,
        "queue_reset_email",
        lambda email: queued.append(email),
    )

    response = client.post(
        "/api/forgot-password",
        json={"email": "owner@example.com"},
    )

    assert response.status_code == 200
    assert queued == ["owner@example.com"]


def test_reset_email_worker_is_detached_and_receives_email(monkeypatch):
    captured = {}

    class FakeInput:
        def __init__(self):
            self.value = ""
            self.closed = False

        def write(self, value):
            self.value += value

        def close(self):
            self.closed = True

    class FakeProcess:
        def __init__(self):
            self.stdin = FakeInput()

        def wait(self, timeout):
            captured["wait_timeout"] = timeout
            return 0

        def kill(self):
            captured["killed"] = True

    fake_process = FakeProcess()

    def fake_popen(command, **kwargs):
        captured["command"] = command
        captured["kwargs"] = kwargs
        return fake_process

    monkeypatch.setattr(app_module.subprocess, "Popen", fake_popen)
    result = app_module.queue_reset_email("owner@example.com")

    assert result is fake_process
    assert captured["command"][1:] == ["-m", "app.reset_email_worker"]
    assert captured["kwargs"]["start_new_session"] is True
    assert captured["kwargs"]["close_fds"] is True
    assert fake_process.stdin.value == "owner@example.com"
    assert fake_process.stdin.closed is True


def test_unknown_reset_email_uses_same_generic_response(
    client, monkeypatch
):
    queued = []
    monkeypatch.setattr(
        app_module,
        "validate_email",
        lambda value, **kwargs: SimpleNamespace(normalized=value.lower()),
    )
    monkeypatch.setattr(
        app_module,
        "queue_reset_email",
        lambda *args: queued.append(args),
    )

    response = client.post(
        "/api/forgot-password",
        json={"email": "missing@example.com"},
    )

    assert response.status_code == 200
    assert response.get_json()["success"] is True
    assert queued == [("missing@example.com",)]


def test_reset_email_failure_does_not_raise_or_log_secret(
    app, make_user, monkeypatch, caplog
):
    secret_url = "https://archub.ge/reset-password?token=super-secret"

    def failed_delivery(*args):
        raise RuntimeError("mail unavailable")

    monkeypatch.setattr(app_module, "send_reset_email", failed_delivery)
    monkeypatch.setitem(app.config, "BASE_URL", "https://archub.ge")
    make_user(username="Owner", email="owner@example.com")

    app_module._process_reset_email("owner@example.com")

    assert "Password reset email delivery failed" in caplog.text
    assert "super-secret" not in caplog.text
