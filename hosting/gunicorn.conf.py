import os
from pathlib import Path


project_root = Path(__file__).resolve().parent.parent

# TCP bind by default (recommended with Nginx proxying to 127.0.0.1:8000)
bind_host = os.getenv("GUNICORN_HOST", "127.0.0.1")
bind_port = os.getenv("GUNICORN_PORT", "8000")
bind = f"{bind_host}:{bind_port}"

# If you prefer a Unix socket, uncomment and adjust Nginx accordingly
# bind = f"unix:{project_root / 'run' / 'gunicorn.sock'}"

# Workers/threads
workers = int(os.getenv("GUNICORN_WORKERS", "3"))
threads = int(os.getenv("GUNICORN_THREADS", "2"))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")

# Timeouts and keepalive
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# Logging
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")  # '-' means stdout
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")

# Ensure working directory is project root
chdir = str(project_root)

# Preload app to reduce memory usage per worker
preload_app = True

def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def on_starting(server):
    server.log.info("Starting Gunicorn with config %s", __file__)


