from concurrent.futures import ThreadPoolExecutor
from queue import Empty
import hashlib
import multiprocessing
import sqlite3
import time
import traceback

from flask import Flask
from flask_limiter import Limiter
from limits.errors import StorageError
from limits.storage import storage_from_string
import pytest

import app as app_module
from app.rate_limit_storage import SQLiteRateLimitStorage


def storage_uri(path):
    return f"sqlite-rate-limit:///{path.resolve().as_posix()}"


def _process_increment_worker(uri, key, increments, start_event, result_queue):
    """Exercise a fresh backend instance in a spawned interpreter."""
    try:
        if not start_event.wait(timeout=15):
            raise TimeoutError("worker start event was not released")
        storage = storage_from_string(uri, timeout=10.0)
        for _ in range(increments):
            storage.incr(key, 3600)
        result_queue.put(None)
    except BaseException:
        result_queue.put(traceback.format_exc())
        raise


def run_process_increments(uri, key, *, workers, increments):
    """Start independent processes and return their final shared counter."""
    context = multiprocessing.get_context("spawn")
    start_event = context.Event()
    result_queue = context.Queue()
    processes = [
        context.Process(
            target=_process_increment_worker,
            args=(uri, key, increments, start_event, result_queue),
        )
        for _ in range(workers)
    ]

    try:
        for process in processes:
            process.start()
        start_event.set()
        join_deadline = time.monotonic() + 30
        for process in processes:
            remaining = max(0, join_deadline - time.monotonic())
            process.join(timeout=remaining)

        messages = []
        result_deadline = time.monotonic() + 5
        for _ in processes:
            try:
                remaining = max(0.01, result_deadline - time.monotonic())
                messages.append(result_queue.get(timeout=remaining))
            except Empty:
                messages.append("worker exited without reporting a result")

        assert all(not process.is_alive() for process in processes), messages
        assert [process.exitcode for process in processes] == [0] * workers, messages
        assert messages == [None] * workers
    finally:
        for process in processes:
            if process.is_alive():
                process.terminate()
            process.join(timeout=5)
        result_queue.close()
        result_queue.join_thread()

    return storage_from_string(uri).get(key)


def test_public_storage_factory_resolves_custom_backend(tmp_path):
    storage = storage_from_string(storage_uri(tmp_path / "factory.db"))

    assert isinstance(storage, SQLiteRateLimitStorage)
    assert storage.check() is True


def test_sqlite_rate_limits_are_shared_between_instances(tmp_path):
    uri = storage_uri(tmp_path / "limits.db")
    first = SQLiteRateLimitStorage(uri)
    second = SQLiteRateLimitStorage(uri)

    assert first.incr("login/client", 60) == 1
    assert second.incr("login/client", 60) == 2
    assert first.get("login/client") == 2
    assert second.get_expiry("login/client") > 0

    second.clear("login/client")
    assert first.get("login/client") == 0


def test_backend_hashes_keys_and_uses_healthy_wal_database(tmp_path):
    database_path = tmp_path / "private-counters.db"
    raw_key = "login/203.0.113.7"
    storage = SQLiteRateLimitStorage(storage_uri(database_path))

    assert storage.incr(raw_key, 60) == 1

    with sqlite3.connect(database_path) as connection:
        stored_key = connection.execute(
            "SELECT key FROM rate_limit_counters"
        ).fetchone()[0]
        journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]

    assert stored_key == hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    assert raw_key not in stored_key
    assert journal_mode.lower() == "wal"
    assert integrity == "ok"


def test_sqlite_rate_limit_increment_is_atomic_across_threads(tmp_path):
    uri = storage_uri(tmp_path / "threaded.db")
    storages = [SQLiteRateLimitStorage(uri) for _ in range(8)]

    def increment(index):
        return storages[index % len(storages)].incr("reset/client", 60)

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(increment, range(40)))

    assert storages[0].get("reset/client") == 40
    assert storages[0].reset() == 1
    assert storages[1].get("reset/client") == 0


def test_sqlite_rate_limit_increment_is_exact_across_processes(tmp_path):
    uri = storage_uri(tmp_path / "multiprocess.db")
    SQLiteRateLimitStorage(uri)

    total = run_process_increments(
        uri,
        "forgot-password/client",
        workers=4,
        increments=12,
    )

    assert total == 48


def test_sqlite_schema_initialization_is_safe_across_processes(tmp_path):
    uri = storage_uri(tmp_path / "simultaneous-initialization.db")

    total = run_process_increments(
        uri,
        "register/client",
        workers=6,
        increments=1,
    )

    assert total == 6


def test_held_write_lock_is_wrapped_and_does_not_partially_increment(tmp_path):
    database_path = tmp_path / "locked.db"
    storage = SQLiteRateLimitStorage(storage_uri(database_path), timeout=0.05)
    assert storage.incr("contact/client", 60) == 1

    blocker = sqlite3.connect(database_path, isolation_level=None)
    blocker.execute("BEGIN IMMEDIATE")
    try:
        with pytest.raises(StorageError):
            storage.incr("contact/client", 60)
        assert storage.get("contact/client") == 1
    finally:
        blocker.rollback()
        blocker.close()

    assert storage.incr("contact/client", 60) == 2


def test_storage_health_returns_false_on_connection_error(tmp_path, monkeypatch):
    storage = SQLiteRateLimitStorage(storage_uri(tmp_path / "unhealthy.db"))

    def fail_to_connect():
        raise sqlite3.OperationalError("simulated health-check failure")

    monkeypatch.setattr(storage, "_connect", fail_to_connect)

    assert storage.check() is False


def test_storage_health_suppresses_rollback_and_close_errors(tmp_path, monkeypatch):
    storage = SQLiteRateLimitStorage(storage_uri(tmp_path / "broken-health.db"))

    class BrokenConnection:
        def execute(self, _statement):
            raise sqlite3.OperationalError("simulated query failure")

        def rollback(self):
            raise sqlite3.OperationalError("simulated rollback failure")

        def close(self):
            raise sqlite3.OperationalError("simulated close failure")

    monkeypatch.setattr(storage, "_connect", BrokenConnection)

    assert storage.check() is False


def test_flask_limiter_enforces_429_with_sqlite_backend(tmp_path):
    flask_app = Flask(__name__)
    limiter = Limiter(
        key_func=lambda: "shared-client",
        app=flask_app,
        storage_uri=storage_uri(tmp_path / "flask-limiter.db"),
        storage_options={"wrap_exceptions": True},
        strategy="fixed-window",
        swallow_errors=False,
    )

    @flask_app.get("/limited")
    @limiter.limit("2 per minute")
    def limited():
        return {"success": True}

    client = flask_app.test_client()
    statuses = [client.get("/limited").status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_archub_returns_503_when_rate_limit_storage_fails(
    client, monkeypatch
):
    failure_marker = "private storage failure marker"

    def fail_closed(*_args, **_kwargs):
        raise StorageError(sqlite3.OperationalError(failure_marker))

    monkeypatch.setattr(app_module.limiter.storage, "incr", fail_closed)

    response = client.post(
        "/api/login",
        json={"email": "nobody@example.com", "password": "not-the-password"},
    )

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "5"
    assert response.is_json
    assert response.get_json()["success"] is False
    assert failure_marker not in response.get_data(as_text=True)


def test_production_replaces_explicit_memory_storage():
    from config import ProductionConfig

    assert ProductionConfig.RATELIMIT_STORAGE_URI.startswith(
        "sqlite-rate-limit:///"
    )


def test_storage_expired_counter_starts_a_new_window(tmp_path):
    storage = SQLiteRateLimitStorage(storage_uri(tmp_path / "expiry.db"))

    assert storage.incr("contact/client", 0) == 1
    assert storage.get("contact/client") == 0
    assert storage.incr("contact/client", 60) == 1


def test_storage_health_and_empty_reset(tmp_path):
    storage = SQLiteRateLimitStorage(storage_uri(tmp_path / "health.db"))

    assert storage.check() is True
    assert storage.reset() == 0
