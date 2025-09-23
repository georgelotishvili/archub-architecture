#!/usr/bin/env python3
"""
Setup script for Archub project
This script helps set up the project environment and database
"""

import os
import sys
import subprocess
import sqlite3
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 7):
        print("❌ Python 3.7 or higher is required")
        return False
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    return True

def create_virtual_environment():
    """Create virtual environment"""
    if os.path.exists('venv'):
        print("✅ Virtual environment already exists")
        return True
    
    return run_command('python -m venv venv', 'Creating virtual environment')

def activate_and_install():
    """Activate virtual environment and install requirements"""
    if os.name == 'nt':  # Windows
        activate_cmd = 'venv\\Scripts\\activate'
        pip_cmd = 'venv\\Scripts\\pip'
    else:  # Unix/Linux/macOS
        activate_cmd = 'source venv/bin/activate'
        pip_cmd = 'venv/bin/pip'
    
    # Install requirements
    return run_command(f'{pip_cmd} install -r requirements.txt', 'Installing Python packages')

def setup_database():
    """Set up the database"""
    print("🔄 Setting up database...")
    try:
        # Import Flask app and create database
        sys.path.insert(0, os.getcwd())
        from app import app, db
        
        with app.app_context():
            db.create_all()
            print("✅ Database tables created successfully")
        
        # Check if migrations need to be run
        if os.path.exists('migrations'):
            print("🔄 Running database migrations...")
            if run_command('flask db upgrade', 'Running database migrations'):
                print("✅ Database migrations completed")
            else:
                print("⚠️  Database migrations failed, but database tables were created")
        
        return True
    except Exception as e:
        print(f"❌ Database setup failed: {e}")
        return False

def create_sample_data():
    """Create sample data"""
    print("🔄 Creating sample data...")
    try:
        from db_commands import create_sample_data
        create_sample_data()
        print("✅ Sample data created successfully")
        return True
    except Exception as e:
        print(f"❌ Sample data creation failed: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Archub Project Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Create virtual environment
    if not create_virtual_environment():
        print("❌ Setup failed at virtual environment creation")
        sys.exit(1)
    
    # Install requirements
    if not activate_and_install():
        print("❌ Setup failed at package installation")
        sys.exit(1)
    
    # Setup database
    if not setup_database():
        print("❌ Setup failed at database setup")
        sys.exit(1)
    
    # Create sample data
    response = input("🤔 Would you like to create sample data? (y/n): ").lower().strip()
    if response in ['y', 'yes']:
        create_sample_data()
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Activate virtual environment:")
    if os.name == 'nt':
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("2. Run the application:")
    print("   python app.py")
    print("3. Open your browser and visit:")
    print("   http://127.0.0.1:5000")
    print("\n📚 For more information, see README.md")

if __name__ == "__main__":
    main()
