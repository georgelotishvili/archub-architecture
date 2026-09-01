"""Cross-process fixed-window storage for Flask-Limiter on shared hosting."""

from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import time
from threading import Lock
from urllib.parse import unquote, urlsplit

from limits.storage import Storage


class SQLiteRateLimitStorage(Storage):
    """SQLite-backed fixed-window counters shared by local WSGI processes.

    A fresh connection is opened for every operation, making the class safe
    across Passenger/Gunicorn forks. Writes use ``BEGIN IMMEDIATE`` and WAL.
    """

    STORAGE_SCHEME = ["sqlite-rate-limit"]

    def __init__(
        self,
        uri: str | None = None,
        wrap_exceptions: bool = True,
        **options: float | str | bool,
    ):
        super().__init__(uri, wrap_exceptions=wrap_exceptions, **options)
        if not uri:
            raise ValueError("SQLite rate-limit storage requires a URI")

        parsed = urlsplit(uri)
        if (
            parsed.scheme != "sqlite-rate-limit"
            or parsed.netloc
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Invalid SQLite rate-limit storage URI")

        path = unquote(parsed.path)
        if path in {":memory:", "/:memory:", "//:memory:"}:
            raise ValueError("An on-disk SQLite rate-limit database is required")
        if os.name == "nt" and re.match(r"^/[A-Za-z]:/", path):
            path = path[1:]
        elif os.name != "nt" and path.startswith("//"):
            path = path[1:]
        if not path or not os.path.isabs(path):
            raise ValueError("SQLite rate-limit storage path must be absolute")

        self.path = os.path.abspath(path)
        parent = os.path.dirname(self.path)
        if not os.path.isdir(parent) or os.path.islink(parent):
            raise ValueError("SQLite rate-limit storage directory is unsafe")
        if os.path.lexists(self.path) and (
            os.path.islink(self.path) or not os.path.isfile(self.path)
        ):
            raise ValueError("SQLite rate-limit storage file is unsafe")

        self.timeout = float(options.get("timeout", 5.0))
        self._cleanup_lock = Lock()
        self._last_cleanup = 0.0
        self._ensure_schema()

    @property
    def base_exceptions(self):
        return (sqlite3.Error, OSError)

    def _connect(self):
        connection = sqlite3.connect(
            self.path,
            timeout=self.timeout,
            isolation_level=None,
        )
        connection.execute(f"PRAGMA busy_timeout = {int(self.timeout * 1000)}")
        connection.execute("PRAGMA synchronous = NORMAL")
        return connection

    @staticmethod
    def _is_busy_error(error):
        message = str(error).lower()
        return "locked" in message or "busy" in message

    def _initialize_schema_once(self):
        connection = self._connect()
        try:
            journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
            if str(journal_mode).lower() != "wal":
                journal_mode = connection.execute(
                    "PRAGMA journal_mode = WAL"
                ).fetchone()[0]
            if str(journal_mode).lower() != "wal":
                raise sqlite3.OperationalError("SQLite WAL mode is unavailable")

            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS rate_limit_counters (
                    key TEXT PRIMARY KEY,
                    value INTEGER NOT NULL,
                    expires_at REAL NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS ix_rate_limit_expiry
                ON rate_limit_counters (expires_at)
                """
            )
            connection.commit()
        except BaseException:
            if connection.in_transaction:
                try:
                    connection.rollback()
                except self.base_exceptions:
                    pass
            try:
                connection.close()
            except self.base_exceptions:
                pass
            raise
        else:
            connection.close()

    def _ensure_schema(self):
        deadline = time.monotonic() + max(self.timeout, 0.1)
        retry_delay = 0.01

        while True:
            try:
                self._initialize_schema_once()
                break
            except sqlite3.OperationalError as error:
                remaining = deadline - time.monotonic()
                if not self._is_busy_error(error) or remaining <= 0:
                    raise
                time.sleep(min(retry_delay, remaining))
                retry_delay = min(retry_delay * 2, 0.25)

        # Runtime state lives in a private directory, and the database itself
        # is kept owner-only. Failure here aborts startup instead of weakening
        # the limiter silently.
        os.chmod(self.path, 0o600)

    @staticmethod
    def _digest_key(key):
        return hashlib.sha256(str(key).encode("utf-8")).hexdigest()

    def _cleanup_is_due(self):
        current = time.monotonic()
        with self._cleanup_lock:
            if current - self._last_cleanup < 60:
                return False
            self._last_cleanup = current
            return True

    def incr(self, key: str, expiry: int, amount: int = 1) -> int:
        stored_key = self._digest_key(key)
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            now = time.time()
            if self._cleanup_is_due():
                connection.execute(
                    "DELETE FROM rate_limit_counters WHERE expires_at <= ?",
                    (now,),
                )
            row = connection.execute(
                "SELECT value, expires_at FROM rate_limit_counters WHERE key = ?",
                (stored_key,),
            ).fetchone()
            if row is None or row[1] <= now:
                value = amount
                connection.execute(
                    """
                    INSERT INTO rate_limit_counters (key, value, expires_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        expires_at = excluded.expires_at
                    """,
                    (stored_key, value, now + expiry),
                )
            else:
                value = int(row[0]) + amount
                connection.execute(
                    "UPDATE rate_limit_counters SET value = ? WHERE key = ?",
                    (value, stored_key),
                )
            connection.commit()
            return value
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def get(self, key: str) -> int:
        now = time.time()
        stored_key = self._digest_key(key)
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT value, expires_at FROM rate_limit_counters WHERE key = ?",
                (stored_key,),
            ).fetchone()
            return int(row[0]) if row and row[1] > now else 0
        finally:
            connection.close()

    def get_expiry(self, key: str) -> float:
        now = time.time()
        stored_key = self._digest_key(key)
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT expires_at FROM rate_limit_counters WHERE key = ?",
                (stored_key,),
            ).fetchone()
            return float(row[0]) if row and row[0] > now else now
        finally:
            connection.close()

    def clear(self, key: str) -> None:
        stored_key = self._digest_key(key)
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "DELETE FROM rate_limit_counters WHERE key = ?",
                (stored_key,),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def reset(self) -> int:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            count = int(
                connection.execute(
                    "SELECT COUNT(*) FROM rate_limit_counters"
                ).fetchone()[0]
            )
            connection.execute("DELETE FROM rate_limit_counters")
            connection.commit()
            return count
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def check(self) -> bool:
        connection = None
        healthy = False
        try:
            connection = self._connect()
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("SELECT 1").fetchone()
            connection.rollback()
            healthy = True
        except self.base_exceptions:
            if connection is not None:
                try:
                    connection.rollback()
                except self.base_exceptions:
                    pass
        finally:
            if connection is not None:
                try:
                    connection.close()
                except self.base_exceptions:
                    healthy = False
        return healthy
