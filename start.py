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
    """Bring the development database to the recorded migration head."""
    print("[...] მონაცემთა ბაზის მიგრაციები მოწმდება...")
    try:
        from app import app
        from flask_migrate import upgrade

        with app.app_context():
            upgrade()
        print("[OK] მონაცემთა ბაზის მიგრაციები დასრულდა")
        return True
    except Exception as error:
        print(f"[ERROR] მონაცემთა ბაზის მიგრაცია ვერ მოხერხდა: {error}")
        return False

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
        # use_reloader=False - Windows-ზე reloader-ს პრობლემები აქვს
        # ცვლილებების შემდეგ სერვერი ხელით უნდა გადატვირთოთ
        app.run(
            debug=True,
            host='127.0.0.1',
            port=5000,
            use_reloader=False
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


# ===== ძველი პროცესების გასუფთავება =====
def kill_existing_flask_processes():
    """თიშავს ძველ Flask პროცესებს პორტ 5000-ზე"""
    if os.name == 'nt':  # Windows
        import subprocess
        try:
            # ვპოულობთ პროცესებს რომლებიც იყენებენ პორტ 5000-ს
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True, text=True, timeout=5
            )
            
            pids_to_kill = set()
            for line in result.stdout.split('\n'):
                if ':5000' in line and 'LISTENING' in line:
                    parts = line.split()
                    if parts:
                        try:
                            pid = int(parts[-1])
                            if pid != os.getpid():  # არ გავთიშოთ საკუთარი თავი
                                pids_to_kill.add(pid)
                        except ValueError:
                            pass
            
            if pids_to_kill:
                print(f"[i] ითიშება ძველი პროცესები: {pids_to_kill}")
                for pid in pids_to_kill:
                    try:
                        subprocess.run(['taskkill', '/F', '/PID', str(pid)], 
                                      capture_output=True, timeout=5)
                    except:
                        pass
                import time
                time.sleep(1)
                print("[OK] ძველი პროცესები გაითიშა")
        except Exception as e:
            pass  # თუ ვერ გავთიშეთ, გავაგრძელოთ მაინც


# ===== მთავარი გაშვების წერტილი =====
if __name__ == '__main__':
    print("")
    print("[...] ARCHUB იწყება...")
    print("")
    
    # ძველი პროცესების გასუფთავება
    kill_existing_flask_processes()
    
    # პაკეტების შემოწმება
    if not check_dependencies():
        print("")
        input("დააჭირეთ Enter გასასვლელად...")
        sys.exit(1)
    
    # development სერვერის გაშვება
    run_development_server()
