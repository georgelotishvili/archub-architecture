"""
ARCHUB - Gunicorn/WSGI Entry Point
==================================
ეს ფაილი გამოიყენება gunicorn-ის ან სხვა WSGI სერვერის მიერ.

გამოყენება:
    gunicorn "hosting.wsgi:application"
    ან
    gunicorn "start:create_app()"
"""
import os
import sys
from pathlib import Path

# პროექტის root დირექტორია (hosting საქაღალდის parent)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# დავამატოთ პროექტი sys.path-ში
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# შევცვალოთ working directory
os.chdir(PROJECT_ROOT)

# Production რეჟიმის დაყენება
os.environ.setdefault("FLASK_ENV", "production")

# აპლიკაციის იმპორტი start.py-დან
from start import create_app
application = create_app()
