import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_db_commands_builds_app_through_start_factory():
    code = """
import start

calls = []
real_create_app = start.create_app

def tracked_create_app():
    calls.append(True)
    return real_create_app()

start.create_app = tracked_create_app
import db_commands

assert calls == [True]
assert db_commands.app.config['TESTING'] is True
"""
    env = os.environ.copy()
    env.update(
        {
            'FLASK_ENV': 'testing',
            'SECRET_KEY': 'db-commands-startup-test-secret',
            'RATELIMIT_STORAGE_URI': 'memory://',
            'PYTHONDONTWRITEBYTECODE': '1',
        }
    )

    result = subprocess.run(
        [sys.executable, '-c', code],
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        encoding='utf-8',
        errors='replace',
        timeout=30,
        check=False,
    )

    assert result.returncode == 0, result.stderr
