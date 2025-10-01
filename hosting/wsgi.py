import os
import sys
from pathlib import Path

# Add project root (…/archub) to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Optional: load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass

os.environ.setdefault("FLASK_ENV", "production")

# Expose WSGI callable named 'application' for Passenger
from app import app as application
