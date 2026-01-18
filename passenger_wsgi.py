"""
ARCHUB - Passenger WSGI Entry Point
===================================
ეს ფაილი გამოიყენება Passenger-ის მიერ სერვერზე.
"""
import os
import sys
from pathlib import Path

# პროექტის root დირექტორია
PROJECT_ROOT = Path(__file__).resolve().parent

# დავამატოთ პროექტი sys.path-ში
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# შევცვალოთ working directory
os.chdir(PROJECT_ROOT)

# აპლიკაციის იმპორტი start.py-დან
from start import create_app
application = create_app()
