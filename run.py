#!/usr/bin/env python3
# ===== ARCHUB - გაშვების სკრიპტი =====
# ეს ფაილი არის Flask განვითარების სერვერის გასაშვებად
# ამოწმებს მოთხოვნებს და ამუშავებს აპლიკაციას

import os
import sys
from pathlib import Path

# ===== Windows console Unicode handling =====
# Some Windows terminals use a legacy codepage that cannot encode emojis or
# non-ASCII characters. Reconfigure stdout/stderr to UTF-8 with a safe fallback
# so that debug prints do not crash the process.
if os.name == 'nt':
    try:
        # Python 3.7+: preferred way
        sys.stdout.reconfigure(encoding='utf-8', errors='ignore')
        sys.stderr.reconfigure(encoding='utf-8', errors='ignore')
    except Exception:
        try:
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='ignore')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='ignore')
        except Exception:
            # As a last resort, avoid failing due to encoding issues
            pass

# ===== მოთხოვნების შემოწმება =====
def check_requirements():
    """ყველა მოთხოვნის შემოწმება - ბაზა, საქაღალდეები და ა.შ."""
    print("🔍 Checking requirements...")
    
    # Check if virtual environment is activated
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("⚠️  Warning: Virtual environment not detected")
        print("   It's recommended to activate the virtual environment first")
        print("   Windows: venv\\Scripts\\activate")
        print("   macOS/Linux: source venv/bin/activate")
        print()
    
    # Check if database exists
    if not os.path.exists('database.db'):
        print("⚠️  Database not found, creating it...")
        try:
            from app import app, db
            with app.app_context():
                db.create_all()
            print("✅ Database created successfully")
        except Exception as e:
            print(f"❌ Failed to create database: {e}")
            return False
    
    # Check if uploads directory exists
    uploads_dir = Path('static/uploads')
    if not uploads_dir.exists():
        print("📁 Creating uploads directory...")
        uploads_dir.mkdir(parents=True, exist_ok=True)
        (uploads_dir / 'main').mkdir(exist_ok=True)
        (uploads_dir / 'gallery').mkdir(exist_ok=True)
        print("✅ Uploads directory created")
    
    print("✅ All requirements met")
    return True

# ===== მთავარი გაშვების ფუნქცია =====
def main():
    """მთავარი გაშვების ფუნქცია - ამუშავებს Flask სერვერს"""
    print("🚀 Starting Archub Development Server")
    print("=" * 50)
    
    if not check_requirements():
        print("❌ Requirements check failed")
        sys.exit(1)
    
    print("\n🌐 Starting Flask server...")
    print("📍 Server will be available at: http://127.0.0.1:5000")
    print("📍 Admin panel: http://127.0.0.1:5000/admin")
    print("📍 API documentation: http://127.0.0.1:5000/api/projects")
    print("\n⏹️  Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        from app import app
        app.run(debug=True, host='127.0.0.1', port=5000)
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
