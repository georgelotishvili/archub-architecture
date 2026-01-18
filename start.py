#!/usr/bin/env python3
"""
===== ARCHUB - უნივერსალური გამშვები სკრიპტი =====

ეს ფაილი არის ერთადერთი ფაილი რომელიც გჭირდებათ აპლიკაციის გასაშვებად.

გამოყენება:
    ლოკალურად: python start.py
    სერვერზე: gunicorn "start:create_app()"

ავტომატურად:
    - შექმნის საჭირო საქაღალდეებს
    - შექმნის მონაცემთა ბაზას
    - დააყენებს development/production რეჟიმს გარემოს მიხედვით
"""

import os
import sys
from pathlib import Path

# ===== პროექტის root დირექტორია =====
PROJECT_ROOT = Path(__file__).resolve().parent
os.chdir(PROJECT_ROOT)

# დავამატოთ პროექტის root sys.path-ში
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ===== Windows კონსოლის UTF-8 მხარდაჭერა =====
if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def load_environment():
    """ჩატვირთავს .env ფაილს თუ არსებობს"""
    env_file = PROJECT_ROOT / '.env'
    
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            print("[OK] .env ფაილი ჩაიტვირთა")
        except ImportError:
            # python-dotenv არ არის დაყენებული, ხელით წავიკითხოთ
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ.setdefault(key.strip(), value.strip())
                print("[OK] .env ფაილი ჩაიტვირთა (ხელით)")
            except Exception as e:
                print(f"[!] .env ფაილის წაკითხვა ვერ მოხერხდა: {e}")
    else:
        print("[i] .env ფაილი არ არსებობს (არასავალდებულო)")


def is_production():
    """ამოწმებს production გარემოა თუ არა"""
    flask_env = os.environ.get('FLASK_ENV', '').lower()
    return flask_env == 'production'


def setup_directories():
    """შექმნის საჭირო საქაღალდეებს"""
    directories = [
        PROJECT_ROOT / 'static' / 'uploads',
        PROJECT_ROOT / 'static' / 'uploads' / 'main',
        PROJECT_ROOT / 'static' / 'uploads' / 'gallery',
        PROJECT_ROOT / 'static' / 'uploads' / 'carousel',
    ]
    
    for directory in directories:
        if not directory.exists():
            directory.mkdir(parents=True, exist_ok=True)
            print(f"[OK] შეიქმნა: {directory.relative_to(PROJECT_ROOT)}")


def setup_database():
    """შექმნის მონაცემთა ბაზას თუ არ არსებობს"""
    db_path = PROJECT_ROOT / 'database.db'
    
    # თუ production-ში ვართ და PostgreSQL გამოიყენება, გამოვტოვოთ SQLite შემოწმება
    if is_production() and 'postgresql' in os.environ.get('DATABASE_URL', '').lower():
        print("[i] Production რეჟიმი: PostgreSQL ბაზა გამოიყენება")
        return True
    
    if not db_path.exists():
        print("[...] მონაცემთა ბაზა იქმნება...")
        try:
            from app import app
            from app.extensions import db
            
            with app.app_context():
                db.create_all()
            print("[OK] მონაცემთა ბაზა შეიქმნა წარმატებით")
        except Exception as e:
            print(f"[ERROR] მონაცემთა ბაზის შექმნა ვერ მოხერხდა: {e}")
            return False
    else:
        print("[OK] მონაცემთა ბაზა უკვე არსებობს")
    
    return True


def create_app():
    """
    აპლიკაციის შექმნა - გამოიყენება როგორც ლოკალურად, ასევე სერვერზე.
    
    სერვერზე gunicorn-ით გამოყენება:
        gunicorn "start:create_app()"
    """
    load_environment()
    setup_directories()
    
    # აპლიკაციის იმპორტი
    from app import app
    return app


def run_development_server():
    """განვითარების სერვერის გაშვება"""
    print("")
    print("=" * 55)
    print("        ARCHUB - Development Server")
    print("=" * 55)
    print("")
    
    # გარემოს მომზადება
    load_environment()
    
    # development რეჟიმის დაყენება თუ არ არის მითითებული
    if not os.environ.get('FLASK_ENV'):
        os.environ['FLASK_ENV'] = 'development'
    
    setup_directories()
    
    if not setup_database():
        print("\n[ERROR] მონაცემთა ბაზის პრობლემა. შეამოწმეთ შეცდომები ზევით.")
        input("\nდააჭირეთ Enter გასასვლელად...")
        sys.exit(1)
    
    print("")
    print("-" * 55)
    print("  სერვერი მუშაობს მისამართზე: http://127.0.0.1:5000")
    print("  ადმინ პანელი: http://127.0.0.1:5000/admin")
    print("-" * 55)
    print("  გასათიშად დააჭირეთ: Ctrl+C")
    print("-" * 55)
    print("")
    
    try:
        from app import app
        app.run(
            debug=True,
            host='127.0.0.1',
            port=5000,
            use_reloader=True
        )
    except KeyboardInterrupt:
        print("\n\n[i] სერვერი გაითიშა მომხმარებლის მოთხოვნით")
    except Exception as e:
        print(f"\n[ERROR] სერვერის შეცდომა: {e}")
        input("\nდააჭირეთ Enter გასასვლელად...")
        sys.exit(1)


def check_dependencies():
    """ამოწმებს საჭირო პაკეტებს"""
    required = ['flask', 'flask_sqlalchemy', 'flask_login']
    missing = []
    
    for package in required:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print("[!] აკლია საჭირო პაკეტები:", ', '.join(missing))
        print("[i] გაუშვით: pip install -r requirements.txt")
        return False
    return True


# ===== მთავარი გაშვების წერტილი =====
if __name__ == '__main__':
    print("")
    print("[...] ARCHUB იწყება...")
    print("")
    
    # პაკეტების შემოწმება
    if not check_dependencies():
        print("")
        input("დააჭირეთ Enter გასასვლელად...")
        sys.exit(1)
    
    # development სერვერის გაშვება
    run_development_server()
