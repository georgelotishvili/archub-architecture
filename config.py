# ===== ARCHUB - კონფიგურაციის ფაილი =====
# ეს ფაილი შეიცავს აპლიკაციის ყველა კონფიგურაციას
# განვითარების, წარმოების და ტესტირების გარემოებისთვის

from datetime import timedelta
import os
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

# ===== ძირითადი დირექტორია =====
basedir = os.path.abspath(os.path.dirname(__file__))


def sqlite_rate_limit_uri(path):
    """Return a limits-compatible absolute URI on Windows and POSIX."""
    normalized = Path(path).resolve().as_posix()
    return f'sqlite-rate-limit:///{normalized}'


def default_rate_limit_database_path():
    """Keep cPanel runtime state outside public_html; stay portable elsewhere."""
    cpanel_app_root = Path('/home/archubge/public_html/archub')
    if os.name != 'nt' and Path(basedir) == cpanel_app_root:
        return Path('/home/archubge/private/archub/rate_limits.db')
    return Path(basedir, 'rate_limits.db')


RATE_LIMIT_DATABASE_URI = sqlite_rate_limit_uri(default_rate_limit_database_path())


def production_database_uri(configured=None):
    """Return a production DB URI, rejecting ambiguous local SQLite paths."""
    raw_value = os.environ.get('DATABASE_URL', '') if configured is None else configured
    database_url = str(raw_value or '').strip()
    if not database_url:
        database_path = Path(basedir, 'database.db').resolve().as_posix()
        return f'sqlite:///{database_path}'

    try:
        parsed = make_url(database_url)
    except ArgumentError as error:
        raise RuntimeError('DATABASE_URL is invalid') from error

    if parsed.get_backend_name() == 'sqlite':
        database_name = parsed.database
        if (
            parsed.host
            or not database_name
            or database_name == ':memory:'
            or not Path(database_name).is_absolute()
        ):
            raise RuntimeError(
                'Production SQLite DATABASE_URL must use an absolute file path'
            )
    return database_url

# ===== ძირითადი კონფიგურაციის კლასი =====
class Config:
    """ძირითადი კონფიგურაციის კლასი - საერთო პარამეტრები"""
    # Development fallback only. Production startup rejects it explicitly.
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'archub-development-only-secret'
    BASE_URL = os.environ.get('BASE_URL', 'https://archub.ge').rstrip('/')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(hours=12)
    SEND_FILE_MAX_AGE_DEFAULT = 0
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    TRUST_PROXY_HEADERS = os.environ.get(
        'TRUST_PROXY_HEADERS', 'false'
    ).strip().lower() in {'1', 'true', 'yes', 'on'}

    # ===== ფაილის ატვირთვის პარამეტრები =====
    UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB მაქსიმალური ფაილის ზომა
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}  # დაშვებული ფაილის გაფართოებები
    MAX_IMAGE_PIXELS = 50_000_000
    MAX_PROJECT_AREA_LENGTH = 100
    MAX_CONTACT_MESSAGE_LENGTH = 5000

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
    _configured_limiter_uri = os.environ.get('RATELIMIT_STORAGE_URI', '').strip()
    # Existing cPanel environments may still explicitly say memory://. Replace
    # that unsafe process-local value unless a genuinely shared backend is set.
    RATELIMIT_STORAGE_URI = (
        RATE_LIMIT_DATABASE_URI if _configured_limiter_uri in {'', 'memory://'}
        else _configured_limiter_uri
    )
    SQLALCHEMY_DATABASE_URI = production_database_uri()
    PREFERRED_URL_SCHEME = 'https'
    SESSION_COOKIE_SECURE = True
    REMEMBER_COOKIE_SECURE = True
    FORCE_HTTPS = True

    # წარმოების გარემოს ელ-ფოსტის პარამეტრები
    MAIL_SUPPRESS_SEND = False
    MAIL_DEBUG = False

# ===== ტესტირების გარემოს კონფიგურაცია =====
class TestingConfig(Config):
    """ტესტირების გარემოს კონფიგურაცია - ტესტებისთვის"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'  # მეხსიერებაში ბაზა ტესტებისთვის
    WTF_CSRF_ENABLED = False
    FORCE_HTTPS = False
    SQLALCHEMY_ENGINE_OPTIONS = {}

# ===== კონფიგურაციის ლექსიკონი =====
# გარემოს სახელის მიხედვით კონფიგურაციის არჩევა
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
