# ===== ARCHUB - კონფიგურაციის ფაილი =====
# ეს ფაილი შეიცავს აპლიკაციის ყველა კონფიგურაციას
# განვითარების, წარმოების და ტესტირების გარემოებისთვის

import os
from pathlib import Path

# ===== ძირითადი დირექტორია =====
basedir = os.path.abspath(os.path.dirname(__file__))

# ===== ძირითადი კონფიგურაციის კლასი =====
class Config:
    """ძირითადი კონფიგურაციის კლასი - საერთო პარამეტრები"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    
    # ===== ფაილის ატვირთვის პარამეტრები =====
    UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB მაქსიმალური ფაილის ზომა
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}  # დაშვებული ფაილის გაფართოებები
    
    # ===== ელ-ფოსტის პარამეტრები (კონტაქტ ფორმისთვის) =====
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or 'noreply@archub.ge'

# ===== განვითარების გარემოს კონფიგურაცია =====
class DevelopmentConfig(Config):
    """განვითარების გარემოს კონფიგურაცია - debug რეჟიმი ჩართული"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{os.path.join(basedir, "database.db")}'
    
    # განვითარების გარემოს ელ-ფოსტის პარამეტრები
    MAIL_SUPPRESS_SEND = True  # განვითარების გარემოში ელ-ფოსტა არ იგზავნება
    MAIL_DEBUG = True

# ===== წარმოების გარემოს კონფიგურაცია =====
class ProductionConfig(Config):
    """წარმოების გარემოს კონფიგურაცია - ოპტიმიზებული პროდუქტიულობისთვის"""
    DEBUG = False
    # წარმოებაში PostgreSQL ბაზის გამოყენება
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql://user:password@localhost/archub'
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    
    # წარმოების გარემოს ელ-ფოსტის პარამეტრები
    MAIL_SUPPRESS_SEND = False
    MAIL_DEBUG = False

# ===== ტესტირების გარემოს კონფიგურაცია =====
class TestingConfig(Config):
    """ტესტირების გარემოს კონფიგურაცია - ტესტებისთვის"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'  # მეხსიერებაში ბაზა ტესტებისთვის
    WTF_CSRF_ENABLED = False

# ===== კონფიგურაციის ლექსიკონი =====
# გარემოს სახელის მიხედვით კონფიგურაციის არჩევა
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
