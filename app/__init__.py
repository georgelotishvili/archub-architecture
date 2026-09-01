# ===== ARCHUB - არქიტექტურული პორტფოლიო ვებ-აპლიკაცია =====
# ეს არის მთავარი Flask აპლიკაციის ფაილი
# შეიცავს: API endpoints, routes, file upload ფუნქციები, authentication
from sqlalchemy import func, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect, CSRFError
from werkzeug.exceptions import BadRequest, NotFound, RequestEntityTooLarge, TooManyRequests
from werkzeug.middleware.proxy_fix import ProxyFix
import ipaddress
import os
import subprocess
import sys
import uuid
import logging
import warnings
from threading import Thread
from functools import wraps
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from config import config
from PIL import Image
import bleach
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from html import escape as html_escape
from limits.errors import StorageError
from app.rate_limit_storage import SQLiteRateLimitStorage  # noqa: F401
from pathlib import PurePosixPath
from urllib.parse import urlsplit

# ===== LOGGING კონფიგურაცია =====
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== FLASK აპლიკაციის ინიციალიზაცია =====
# Flask აპლიკაციის შექმნა
# template_folder და static_folder მიუთითებს პროექტის root-ზე
import pathlib
PROJECT_ROOT = pathlib.Path(__file__).parent.parent
app = Flask(__name__, 
            template_folder=str(PROJECT_ROOT / 'templates'),
            static_folder=str(PROJECT_ROOT / 'static'))

# CORS-ის ინიციალიზაცია (Cross-Origin Resource Sharing)
# CORS ინიციალიზდება კონფიგურაციის ჩატვირთვის შემდეგ; აქ ვრთავთ მხოლოდ CSRF-ს
csrf = CSRFProtect(app)

# კონფიგურაციის არჩევა FLASK_ENV ცვლადის მიხედვით
config_name = os.getenv('FLASK_ENV', 'default')
if config_name not in config:
    raise RuntimeError(f'Unsupported FLASK_ENV value: {config_name}')
app.config.from_object(config[config_name])

if app.config.get('TRUST_PROXY_HEADERS'):
    # The documented reverse proxy is a single trusted hop and overwrites all
    # forwarded headers before the request reaches the application.
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=1,
        x_proto=1,
        x_host=1,
        x_port=1,
        x_prefix=0,
    )

if config_name == 'production':
    secret_key = app.config.get('SECRET_KEY') or ''
    if len(secret_key) < 32 or secret_key in {
        'archub-development-only-secret',
        'archub-secret-key-change-in-production',
    }:
        raise RuntimeError('Production requires a unique SECRET_KEY of at least 32 characters.')

# CORS კონფიგურაცია გარემოზე დაყრდნობით
if config_name == 'production':
    CORS(app, resources={r"/api/*": {"origins": [os.getenv('CORS_ORIGIN', 'https://archub.ge')]}}, supports_credentials=True)
else:
    CORS(app, supports_credentials=True)


def rate_limit_key():
    """Trust a client IP header only behind an explicitly configured proxy."""
    if app.config.get('TRUST_PROXY_HEADERS'):
        # The included single-hop Nginx config overwrites this header.
        candidate = request.headers.get('X-Real-IP', '').strip()
        if candidate:
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                pass
    return get_remote_address()


# Rate limiting
limiter = Limiter(
    key_func=rate_limit_key,
    app=app,
    storage_uri=app.config['RATELIMIT_STORAGE_URI'],
    storage_options={'wrap_exceptions': True},
    strategy='fixed-window',
    swallow_errors=False,
)

# ატვირთული ფაილების საქაღალდის შექმნა (თუ არ არსებობს)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
Image.MAX_IMAGE_PIXELS = app.config['MAX_IMAGE_PIXELS']


def _is_api_request():
    return request.path.startswith('/api/') or request.path == '/healthz'


@app.before_request
def enforce_canonical_https():
    """Keep production traffic on the single trusted HTTPS origin."""
    if not app.config.get('FORCE_HTTPS'):
        return None

    canonical = urlsplit(app.config['BASE_URL'])
    request_host = request.host.split(':', 1)[0].lower()
    request_scheme = request.scheme.lower()

    if request_scheme != 'https' or request_host != canonical.hostname:
        target = f"{app.config['BASE_URL']}{request.path}"
        if request.query_string:
            target = f"{target}?{request.query_string.decode('latin-1')}"
        return redirect(target, code=308)
    return None


@app.after_request
def apply_response_security(response):
    """Security and cache policy shared by every response."""
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()',
    )
    response.headers.setdefault('X-Permitted-Cross-Domain-Policies', 'none')
    response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')

    # Some legacy uploads have a mismatched extension/content type. New uploads
    # are corrected below; keep nosniff off only for those legacy URLs until the
    # migration is complete.
    if not request.path.startswith('/static/uploads/'):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')

    response.headers.setdefault(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; object-src 'none'; "
        "frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "script-src 'self' 'unsafe-inline'; connect-src 'self'",
    )

    if config_name == 'production':
        response.headers.setdefault(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains',
        )

    private_prefixes = ('/admin', '/my-page', '/reset-password', '/api/login',
                        '/api/logout', '/api/register', '/api/forgot-password',
                        '/api/reset-password', '/api/status', '/api/csrf-token',
                        '/api/admin', '/api/user', '/api/carousel/all',
                        '/api/projects')
    if request.path.startswith(private_prefixes):
        response.headers['Cache-Control'] = 'no-store'
    elif request.path.startswith('/static/uploads/') and response.status_code == 200:
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    elif request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate'
    elif response.mimetype == 'text/html':
        response.headers.setdefault('Cache-Control', 'no-cache')

    if request.path in {'/api/projects', '/api/user/liked-projects'}:
        response.headers.add('Vary', 'Cookie')
    if request.path.startswith('/reset-password'):
        response.headers['Referrer-Policy'] = 'no-referrer'
    return response


def _error_response(message, status_code):
    if _is_api_request():
        return jsonify({'success': False, 'error': message}), status_code
    return app.response_class(message, status=status_code, mimetype='text/plain')


@app.errorhandler(StorageError)
def handle_rate_limit_storage_error(_error):
    """Fail closed without exposing storage internals or local fallback."""
    logger.exception('Shared rate-limit storage is unavailable')
    response = jsonify({
        'success': False,
        'error': 'სერვისი დროებით მიუწვდომელია',
    })
    response.headers['Retry-After'] = '5'
    return response, 503


@app.errorhandler(CSRFError)
def handle_csrf_error(_error):
    return _error_response('უსაფრთხოების ტოკენი არასწორია ან ვადაგასულია', 400)


@app.errorhandler(RequestEntityTooLarge)
def handle_large_upload(_error):
    return _error_response('ატვირთვის მაქსიმალური ზომაა 16 MB', 413)


@app.errorhandler(TooManyRequests)
def handle_rate_limit(_error):
    return _error_response('ძალიან ბევრი მოთხოვნაა. სცადეთ მოგვიანებით.', 429)


@app.errorhandler(BadRequest)
def handle_bad_request(_error):
    return _error_response('არასწორი მოთხოვნა', 400)


@app.errorhandler(NotFound)
def handle_not_found(_error):
    return _error_response('გვერდი ვერ მოიძებნა', 404)

# Serve a simple favicon to avoid 404 noise in logs
@app.route('/favicon.ico')
def favicon():
    # 1x1 transparent PNG
    transparent_png = (
        b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA" 
        b"AAC0lEQVR42mP8zwAAAgMBAQEA8RsAAAAASUVORK5CYII="
    )
    from base64 import b64decode
    return app.response_class(b64decode(transparent_png), mimetype='image/png')

# ===== SEO ROUTES =====
# robots.txt for search engine crawlers
@app.route('/robots.txt')
def robots_txt():
    robots_content = """User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /my-page

# Sitemap
Sitemap: https://archub.ge/sitemap.xml

# Crawl-delay (optional, be polite to crawlers)
Crawl-delay: 1
"""
    return app.response_class(robots_content, mimetype='text/plain')

# sitemap.xml for search engine indexing
@app.route('/sitemap.xml')
def sitemap_xml():
    base_url = app.config['BASE_URL']
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>{base_url}/</loc>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
</urlset>"""
    return app.response_class(sitemap, mimetype='application/xml')

# ===== გაფართოებების ინიციალიზაცია =====
# SQLAlchemy ბაზის ინიციალიზაცია
from app.extensions import db
db.init_app(app)
migrate = Migrate(app, db)

# LoginManager-ის ინიციალიზაცია (მომხმარებლის ავტორიზაციისთვის)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'home'

@login_manager.unauthorized_handler
def unauthorized():
    try:
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        return redirect(url_for('home'))
    except Exception:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

# მოდელების იმპორტი models.py ფაილიდან
from app.models import Project, Photo, User, CarouselImage, project_likes, ContactSubmission

REQUIRED_DATABASE_TABLES = frozenset({
    'user',
    'project',
    'photo',
    'carousel_image',
    'contact_submission',
    'project_likes',
})


@app.route('/healthz')
@limiter.exempt
def healthz():
    """Real application/database readiness check for monitoring."""
    try:
        db.session.execute(text('SELECT 1'))
        available_tables = set(inspect(db.engine).get_table_names())
        missing_tables = REQUIRED_DATABASE_TABLES - available_tables
        if missing_tables:
            raise RuntimeError(
                'Required database tables are missing: '
                + ', '.join(sorted(missing_tables))
            )
        upload_folder = app.config['UPLOAD_FOLDER']
        if not os.path.isdir(upload_folder) or not os.access(upload_folder, os.W_OK):
            raise RuntimeError('Upload directory is unavailable')
        return jsonify({'status': 'ok'}), 200
    except Exception:
        logger.exception('Health check failed')
        return jsonify({'status': 'error'}), 503


# ===== FLASK-LOGIN კონფიგურაცია =====
# მომხმარებლის ჩატვირთვის ფუნქცია Flask-Login-ისთვის
@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None

# Jinja2 კონტექსტის პროცესორი - now() ფუნქციის დამატება შაბლონებში
@app.context_processor
def inject_now():
    return {'now': datetime.now}


@app.url_defaults
def add_static_asset_version(endpoint, values):
    """Cache-bust code assets even when a reverse proxy serves them directly."""
    if endpoint != 'static' or 'filename' not in values or 'v' in values:
        return
    asset_path = PROJECT_ROOT / 'static' / str(values['filename'])
    try:
        values['v'] = str(asset_path.stat().st_mtime_ns)
    except (OSError, ValueError):
        return

# ===== ADMIN REQUIRED დეკორატორი =====
def admin_required(f):
    """დეკორატორი რომელიც ამოწმებს არის თუ არა მომხმარებელი ადმინისტრატორი"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({
                'success': False,
                'error': 'ავტორიზაცია საჭიროა'
            }), 401
        if not current_user.is_admin:
            logger.warning(f'Unauthorized admin access attempt by user {current_user.id}')
            return jsonify({
                'success': False,
                'error': 'წვდომა აკრძალულია. საჭიროა ადმინისტრატორის უფლებები.'
            }), 403
        return f(*args, **kwargs)
    return decorated_function

# ===== ფაილის ატვირთვის დამხმარე ფუნქციები =====
UPLOAD_URL_PREFIX = 'static/uploads/'
UPLOAD_FOLDERS = {'main', 'gallery', 'carousel'}
IMAGE_EXTENSIONS_BY_FORMAT = {
    'JPEG': 'jpg',
    'PNG': 'png',
    'GIF': 'gif',
    'WEBP': 'webp',
}


def get_json_object():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else None


def clean_text(value, max_length, required=True):
    value = bleach.clean(str(value or ''), tags=[], strip=True)
    value = ' '.join(value.split())
    if required and not value:
        return None
    if len(value) > max_length:
        return None
    return value


def normalize_email_address(value):
    value = str(value or '').strip()
    if not value or len(value) > 150:
        return None
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        return None


def normalize_upload_url(value):
    """Return a canonical upload URL or None for external/traversal input."""
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace('\\', '/').lstrip('/')
    if not normalized.startswith(UPLOAD_URL_PREFIX):
        return None
    relative = normalized[len(UPLOAD_URL_PREFIX):]
    path = PurePosixPath(relative)
    if not relative or path.is_absolute() or '..' in path.parts:
        return None
    if any(part in {'', '.'} for part in path.parts):
        return None
    return f"{UPLOAD_URL_PREFIX}{path.as_posix()}"


def uploaded_file_is_referenced(file_url):
    normalized = normalize_upload_url(file_url)
    if not normalized:
        return False
    for reference_column in (
        Project.main_image_url,
        Photo.url,
        CarouselImage.url,
    ):
        stored_urls = db.session.query(reference_column).filter(
            reference_column.isnot(None)
        )
        if any(
            normalize_upload_url(stored_url) == normalized
            for (stored_url,) in stored_urls
        ):
            return True
    return False


def delete_upload_if_unreferenced(file_url):
    if uploaded_file_is_referenced(file_url):
        return False
    return delete_uploaded_file(file_url)


def safely_delete_upload_if_unreferenced(file_url):
    """Best-effort cleanup after a database transaction has committed."""
    try:
        return delete_upload_if_unreferenced(file_url)
    except Exception:
        logger.exception('Unable to clean up unreferenced upload %s', file_url)
        return False


def allowed_file(filename):
    """ფაილის გაფართოების შემოწმება - დაშვებულია თუ არა"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def generate_unique_filename(file_extension):
    """უნიკალური ფაილის სახელის გენერაცია კონფლიქტების თავიდან ასაცილებლად"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    return f"{timestamp}_{unique_id}.{file_extension}"

def save_uploaded_file(file, folder=''):
    """Validate, decode, and re-encode an image before storing it."""
    if not file or not file.filename or not allowed_file(file.filename):
        return None
    if folder not in UPLOAD_FOLDERS:
        return None

    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            file.stream.seek(0)
            with Image.open(file.stream) as image:
                image_format = (image.format or '').upper()
                width, height = image.size
                frame_count = getattr(image, 'n_frames', 1)
                if (
                    not width
                    or not height
                    or width * height > app.config['MAX_IMAGE_PIXELS']
                    or frame_count > 100
                ):
                    return None
                image.verify()
        file_extension = IMAGE_EXTENSIONS_BY_FORMAT.get(image_format)
        if not file_extension:
            return None
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        logger.warning('Rejected an invalid or unsafe image upload')
        return None

    unique_filename = generate_unique_filename(file_extension)
    folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder)
    os.makedirs(folder_path, exist_ok=True)
    file_path = os.path.join(folder_path, unique_filename)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            file.stream.seek(0)
            with Image.open(file.stream) as image:
                image.seek(0)
                image.load()
                has_alpha = image.mode in {'RGBA', 'LA'} or 'transparency' in image.info
                if image_format == 'JPEG':
                    sanitized = image.convert('RGB')
                    save_options = {'quality': 90, 'optimize': True}
                elif image_format == 'GIF':
                    sanitized = image.convert('RGBA' if has_alpha else 'RGB').convert('P')
                    save_options = {'optimize': True}
                else:
                    sanitized = image.convert('RGBA' if has_alpha else 'RGB')
                    save_options = {'optimize': True}
                try:
                    sanitized.save(file_path, format=image_format, **save_options)
                finally:
                    sanitized.close()
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            logger.exception('Failed to remove a partial upload')
        logger.exception('Failed to sanitize and save an uploaded image')
        return None
    return f"{UPLOAD_URL_PREFIX}{folder}/{unique_filename}"

def delete_uploaded_file(file_url):
    """Delete uploaded file from filesystem safely, preserving subfolders"""
    try:
        normalized = normalize_upload_url(file_url)
        if not normalized:
            return False
        upload_folder_abs = os.path.abspath(app.config['UPLOAD_FOLDER'])
        relative_subpath = os.path.normpath(normalized[len(UPLOAD_URL_PREFIX):])
        file_path_abs = os.path.abspath(os.path.join(upload_folder_abs, relative_subpath))
        if os.path.commonpath((upload_folder_abs, file_path_abs)) != upload_folder_abs:
            logger.warning('Blocked upload deletion outside the upload directory')
            return False
        if os.path.isfile(file_path_abs):
            os.remove(file_path_abs)
            return True
    except (OSError, ValueError):
        logger.exception('Failed to delete an uploaded file')
    return False

# ===== მთავარი ROUTES (გვერდები) =====
# მთავარი გვერდი - პორტფოლიო
@app.route('/')
def home():
    return render_template('index.html', is_my_page=False)

# მომხმარებლის პროფილის გვერდი (ავტორიზაცია საჭირო)
@app.route('/my-page')
@login_required
def my_page():
    return render_template('my_page.html', is_my_page=True)

# ადმინ პანელი (ავტორიზაცია და ადმინ უფლებები საჭირო)
@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        return "Forbidden", 403
    return render_template('admin.html')

# მომხმარებლების სია ადმინ პანელში
@app.route('/admin/users')
@login_required
def admin_users():
    if not current_user.is_admin:
        return "Forbidden", 403
    all_users = User.query.all()
    return render_template('admin_users.html', users=all_users)

# კონკრეტული მომხმარებლის ნახვა ადმინ პანელში
@app.route('/admin/user/<int:user_id>')
@login_required
def admin_view_user(user_id):
    if not current_user.is_admin:
        return "Forbidden", 403
    target_user = User.query.get_or_404(user_id)
    return render_template('admin_user_view.html', user=target_user)


# ===== API ROUTES (API endpoints) =====
# ყველა პროექტის მიღება JSON ფორმატში
@app.route('/api/projects')
def get_projects():
    try:
        # N+1 პრობლემის გადაჭრა: Subquery მოწონებების დასათვლელად
        likes_count_subquery = db.session.query(
            project_likes.c.project_id,
            func.count(project_likes.c.user_id).label('likes_count')
        ).group_by(project_likes.c.project_id).subquery()

        # მთავარი მოთხოვნა პროექტების და მოწონებების რაოდენობის მისაღებად
        query = db.session.query(
            Project,
            likes_count_subquery.c.likes_count
        ).outerjoin(
            likes_count_subquery, Project.id == likes_count_subquery.c.project_id
        ).options(selectinload(Project.photos))

        projects_with_counts = query.all()

        # Preload liked project ids for current user to avoid per-row membership checks
        liked_ids = set()
        if current_user.is_authenticated:
            rows = db.session.query(project_likes.c.project_id).filter(project_likes.c.user_id == current_user.id).all()
            liked_ids = {pid for (pid,) in rows}
        
        # Create JSON response
        projects_data = []
        for project, likes_count in projects_with_counts:
            # Get all photo URLs for this project (ordered)
            photo_urls = project_photo_urls(project)

            # Check if current user has liked this project
            is_liked = project.id in liked_ids if current_user.is_authenticated else False

            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': is_liked,
                'likes_count': likes_count or 0
            }
            projects_data.append(project_data)
        
        return jsonify({
            'success': True,
            'projects': projects_data,
            'count': len(projects_data)
        })
    
    except Exception as e:
        logger.error(f'Error fetching projects: {e}')
        return jsonify({
            'success': False,
            'error': 'პროექტების ჩატვირთვა ვერ მოხერხდა'
        }), 500

# API routes for project and upload management
def project_photo_urls(project):
    """Return one ordered, de-duplicated list with the main image first."""
    urls = []
    main_url = normalize_upload_url(project.main_image_url)
    if main_url:
        urls.append(main_url)
    for photo in sorted(project.photos, key=lambda item: item.order or 0):
        photo_url = normalize_upload_url(photo.url)
        if photo_url and photo_url not in urls:
            urls.append(photo_url)
    return urls


@app.route('/api/projects', methods=['POST'])
@admin_required
def create_project():
    created_files = []
    try:
        area = clean_text(request.form.get('area'), app.config['MAX_PROJECT_AREA_LENGTH'])
        main_image = request.files.get('main_image')
        if not area:
            return jsonify({'success': False, 'error': 'Area field is required or too long'}), 400
        if not main_image or not main_image.filename:
            return jsonify({'success': False, 'error': 'Main image is required'}), 400

        main_image_url = save_uploaded_file(main_image, 'main')
        if not main_image_url:
            return jsonify({'success': False, 'error': 'Invalid main image file format'}), 400
        created_files.append(main_image_url)

        project = Project(area=area, main_image_url=main_image_url)
        db.session.add(project)
        db.session.flush()

        saved_photos = []
        for order, photo_file in enumerate(request.files.getlist('gallery_photos')):
            if not photo_file or not photo_file.filename:
                continue
            photo_url = save_uploaded_file(photo_file, 'gallery')
            if not photo_url:
                db.session.rollback()
                for created_url in created_files:
                    delete_uploaded_file(created_url)
                return jsonify({'success': False, 'error': 'One or more gallery images are invalid'}), 400
            created_files.append(photo_url)
            saved_photos.append(photo_url)
            project.photos.append(Photo(url=photo_url, order=order))

        db.session.flush()
        response = jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': project_photo_urls(project),
            },
            'message': 'Project created successfully',
        })
        db.session.commit()
        return response, 201
    except Exception:
        db.session.rollback()
        for created_url in created_files:
            delete_uploaded_file(created_url)
        logger.exception('Error creating project')
        return jsonify({'success': False, 'error': 'პროექტის შექმნა ვერ მოხერხდა'}), 500


@app.route('/api/projects/empty', methods=['POST'])
@admin_required
def create_empty_project():
    try:
        project = Project(area='ახალი პროექტი', main_image_url='')
        db.session.add(project)
        db.session.flush()
        response = jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': [],
            },
            'message': 'Empty project created successfully',
        })
        db.session.commit()
        return response, 201
    except Exception:
        db.session.rollback()
        logger.exception('Error creating an empty project')
        return jsonify({'success': False, 'error': 'ცარიელი პროექტის შექმნა ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@admin_required
def delete_project(project_id):
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404

        area = project.area
        file_urls = set(project_photo_urls(project))
        photos_count = len(project.photos)
        main_image_url = project.main_image_url
        db.session.delete(project)
        db.session.flush()
        cleanup_candidates = sorted(
            file_url for file_url in file_urls
            if not uploaded_file_is_referenced(file_url)
        )
        db.session.commit()
        deleted_files = [
            file_url for file_url in cleanup_candidates
            if safely_delete_upload_if_unreferenced(file_url)
        ]
        return jsonify({
            'success': True,
            'message': f'Project {project_id} deleted successfully',
            'deleted_files': deleted_files,
            'project_info': {
                'id': project_id,
                'area': area,
                'main_image_url': main_image_url,
                'photos_count': photos_count,
            },
        }), 200
    except Exception:
        db.session.rollback()
        logger.exception('Error deleting project %s', project_id)
        return jsonify({'success': False, 'error': 'პროექტის წაშლა ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@admin_required
def update_project(project_id):
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404

        area = clean_text(request.form.get('area'), app.config['MAX_PROJECT_AREA_LENGTH'])
        if not area:
            return jsonify({'success': False, 'error': 'Area field is required or too long'}), 400

        old_main_url = normalize_upload_url(project.main_image_url) or ''
        current_urls = project_photo_urls(project)
        requested_main_url = old_main_url
        main_image_value = request.form.get('main_image_url')
        if main_image_value is not None:
            stripped_value = main_image_value.strip()
            if stripped_value:
                requested_main_url = normalize_upload_url(stripped_value)
                if not requested_main_url or requested_main_url not in current_urls:
                    return jsonify({'success': False, 'error': 'Invalid main image URL'}), 400
            else:
                requested_main_url = ''

        photos_order_json = request.form.get('photos_order')
        ordered_urls = current_urls
        if photos_order_json is not None:
            import json
            try:
                new_order = json.loads(photos_order_json)
            except (json.JSONDecodeError, TypeError):
                return jsonify({'success': False, 'error': 'Invalid photos order'}), 400
            if not isinstance(new_order, list) or not all(isinstance(url, str) for url in new_order):
                return jsonify({'success': False, 'error': 'Invalid photos order'}), 400
            ordered_urls = []
            for url in new_order:
                normalized_url = normalize_upload_url(url)
                if not normalized_url or normalized_url in ordered_urls:
                    return jsonify({'success': False, 'error': 'Invalid photos order'}), 400
                ordered_urls.append(normalized_url)
            if set(ordered_urls) != set(current_urls):
                return jsonify({'success': False, 'error': 'Invalid photos order'}), 400

        if requested_main_url != old_main_url:
            promoted_photo = next((
                photo for photo in project.photos
                if normalize_upload_url(photo.url) == requested_main_url
            ), None)
            old_main_photo = next((
                photo for photo in project.photos
                if normalize_upload_url(photo.url) == old_main_url
                and photo is not promoted_photo
            ), None)

            if promoted_photo is not None:
                if old_main_url and old_main_photo is None:
                    promoted_photo.url = old_main_url
                else:
                    project.photos.remove(promoted_photo)
            elif old_main_url and old_main_photo is None:
                project.photos.append(Photo(url=old_main_url))

        project.main_image_url = requested_main_url
        order_positions = {url: index for index, url in enumerate(ordered_urls)}
        fallback_order = len(order_positions)
        for photo in project.photos:
            normalized_url = normalize_upload_url(photo.url)
            if not normalized_url:
                continue
            photo.url = normalized_url
            photo.order = order_positions.get(normalized_url, fallback_order)
            if normalized_url not in order_positions:
                fallback_order += 1

        project.area = area
        db.session.flush()
        response = jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': project_photo_urls(project),
            },
            'message': 'Project updated successfully',
        })
        db.session.commit()
        return response, 200
    except Exception:
        db.session.rollback()
        logger.exception('Error updating project %s', project_id)
        return jsonify({'success': False, 'error': 'პროექტის განახლება ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>/photos', methods=['POST'])
@admin_required
def add_project_photos(project_id):
    created_files = []
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404

        photo_files = [item for item in request.files.getlist('photos') if item and item.filename]
        if not photo_files:
            return jsonify({'success': False, 'error': 'No photos provided'}), 400

        max_order = max((photo.order if photo.order is not None else -1 for photo in project.photos), default=-1)
        for photo_file in photo_files:
            photo_url = save_uploaded_file(photo_file, 'gallery')
            if not photo_url:
                db.session.rollback()
                for created_url in created_files:
                    delete_uploaded_file(created_url)
                return jsonify({'success': False, 'error': 'One or more photos are invalid'}), 400
            created_files.append(photo_url)
            max_order += 1
            project.photos.append(Photo(url=photo_url, order=max_order))

        db.session.flush()
        response = jsonify({
            'success': True,
            'message': f'{len(created_files)} photos added successfully',
            'added_photos': created_files,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': project_photo_urls(project),
            },
        })
        db.session.commit()
        return response, 200
    except Exception:
        db.session.rollback()
        for created_url in created_files:
            delete_uploaded_file(created_url)
        logger.exception('Error adding photos to project %s', project_id)
        return jsonify({'success': False, 'error': 'ფოტოების დამატება ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>/main-image', methods=['PUT'])
@admin_required
def update_project_main_image(project_id):
    new_main_image_url = None
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404
        main_image = request.files.get('main_image')
        if not main_image or not main_image.filename:
            return jsonify({'success': False, 'error': 'Main image file is required'}), 400

        new_main_image_url = save_uploaded_file(main_image, 'main')
        if not new_main_image_url:
            return jsonify({'success': False, 'error': 'Invalid main image file format'}), 400

        old_main_image_url = project.main_image_url
        project.main_image_url = new_main_image_url
        db.session.flush()
        response = jsonify({
            'success': True,
            'message': 'Main image updated successfully',
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': project_photo_urls(project),
            },
        })
        db.session.commit()
        if old_main_image_url and old_main_image_url != new_main_image_url:
            safely_delete_upload_if_unreferenced(old_main_image_url)
        return response, 200
    except Exception:
        db.session.rollback()
        if new_main_image_url:
            delete_uploaded_file(new_main_image_url)
        logger.exception('Error updating main image for project %s', project_id)
        return jsonify({'success': False, 'error': 'მთავარი ფოტოს განახლება ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>/main-image', methods=['DELETE'])
@admin_required
def delete_project_main_image(project_id):
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404
        if not project.main_image_url:
            return jsonify({'success': False, 'error': 'Project does not have a main image'}), 400

        old_main_image_url = project.main_image_url
        project.main_image_url = ''
        db.session.flush()
        should_delete_file = not uploaded_file_is_referenced(old_main_image_url)
        project_data = {
            'id': project.id,
            'area': project.area,
            'main_image_url': project.main_image_url,
            'photos': project_photo_urls(project),
        }
        db.session.commit()
        file_deleted = (
            safely_delete_upload_if_unreferenced(old_main_image_url)
            if should_delete_file else False
        )
        return jsonify({
            'success': True,
            'message': 'Main image deleted successfully',
            'deleted_main_image': {
                'url': old_main_image_url,
                'file_deleted': file_deleted,
            },
            'project': project_data,
        }), 200
    except Exception:
        db.session.rollback()
        logger.exception('Error deleting main image for project %s', project_id)
        return jsonify({'success': False, 'error': 'მთავარი ფოტოს წაშლა ვერ მოხერხდა'}), 500


@app.route('/api/projects/<int:project_id>/photos', methods=['DELETE'])
@admin_required
def delete_project_photo_by_url(project_id):
    try:
        project = Project.query.options(selectinload(Project.photos)).filter_by(id=project_id).first()
        if not project:
            return jsonify({'success': False, 'error': f'Project with ID {project_id} not found'}), 404
        photo_url = normalize_upload_url(request.form.get('photo_url'))
        if not photo_url:
            return jsonify({'success': False, 'error': 'Valid photo URL is required'}), 400

        photo = next((
            item for item in project.photos
            if normalize_upload_url(item.url) == photo_url
        ), None)
        if not photo:
            return jsonify({'success': False, 'error': 'Photo not found in this project'}), 404

        project.photos.remove(photo)
        db.session.flush()
        should_delete_file = not uploaded_file_is_referenced(photo_url)
        project_data = {
            'id': project.id,
            'area': project.area,
            'main_image_url': project.main_image_url,
            'photos': project_photo_urls(project),
        }
        db.session.commit()
        file_deleted = (
            safely_delete_upload_if_unreferenced(photo_url)
            if should_delete_file else False
        )
        return jsonify({
            'success': True,
            'message': 'Photo deleted successfully',
            'deleted_photo': {
                'url': photo_url,
                'file_deleted': file_deleted,
            },
            'project': project_data,
        }), 200
    except Exception:
        db.session.rollback()
        logger.exception('Error deleting photo from project %s', project_id)
        return jsonify({'success': False, 'error': 'ფოტოს წაშლა ვერ მოხერხდა'}), 500
# User authentication API endpoints

@app.route('/api/register', methods=['POST'])
@limiter.limit('5 per minute')
def register():
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400

    first_name = clean_text(data.get('first_name'), 70)
    last_name = clean_text(data.get('last_name'), 70)
    phone = clean_text(data.get('phone'), 50)
    email = normalize_email_address(data.get('email'))
    password = data.get('password')
    if not all((first_name, last_name, phone, email)) or not isinstance(password, str):
        return jsonify({'success': False, 'error': 'ყველა ველის სწორად შევსება აუცილებელია'}), 400
    if not 8 <= len(password) <= 128:
        return jsonify({'success': False, 'error': 'პაროლი უნდა შეიცავდეს 8-დან 128-მდე სიმბოლოს'}), 400
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({'success': False, 'error': 'მომხმარებელი ამ ელ-ფოსტით უკვე არსებობს'}), 409

    base_username = f'{first_name} {last_name}'[:140]
    username = base_username
    counter = 1
    while User.query.filter_by(username=username).first():
        suffix = f' {counter}'
        username = f'{base_username[:150 - len(suffix)]}{suffix}'
        counter += 1

    new_user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )
    new_user.set_password(password)
    db.session.add(new_user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'error': 'მომხმარებელი ამ მონაცემებით უკვე არსებობს'}), 409
    except Exception:
        db.session.rollback()
        logger.exception('Registration failed')
        return jsonify({'success': False, 'error': 'რეგისტრაცია ვერ მოხერხდა'}), 500

    return jsonify({'success': True, 'message': 'რეგისტრაცია წარმატებით დასრულდა'}), 201


@app.route('/api/login', methods=['POST'])
@limiter.limit('5 per minute')
def login():
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400
    email = normalize_email_address(data.get('email'))
    password = data.get('password')
    if not email or not isinstance(password, str) or not password:
        return jsonify({'success': False, 'error': 'ელ-ფოსტა და პაროლი სავალდებულოა'}), 400
    if len(password) > 128:
        return jsonify({'success': False, 'error': 'არასწორი ელ-ფოსტა ან პაროლი'}), 401

    try:
        user = User.query.filter(func.lower(User.email) == email).first()
        if user and user.check_password(password):
            login_user(user, remember=False, fresh=True)
            return jsonify({
                'success': True,
                'user': {'username': user.username, 'is_admin': user.is_admin},
            })
        return jsonify({'success': False, 'error': 'არასწორი ელ-ფოსტა ან პაროლი'}), 401
    except Exception:
        logger.exception('Login failed')
        return jsonify({'success': False, 'error': 'ავტორიზაცია ვერ მოხერხდა'}), 500


@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})


@app.route('/api/forgot-password', methods=['POST'])
@limiter.limit('3 per minute')
def forgot_password():
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400
    email = normalize_email_address(data.get('email'))
    if not email:
        return jsonify({'success': False, 'error': 'არასწორი ელ-ფოსტის ფორმატი'}), 400

    try:
        queue_reset_email(email)
        return jsonify({
            'success': True,
            'message': 'თუ ეს ელ-ფოსტა დარეგისტრირებულია, მიიღებთ პაროლის აღდგენის ინსტრუქციას',
        })
    except Exception:
        db.session.rollback()
        logger.exception('Forgot-password request failed')
        return jsonify({'success': False, 'error': 'მოთხოვნის დამუშავება ვერ მოხერხდა'}), 500


def find_user_for_reset_token(token):
    if not isinstance(token, str) or not 20 <= len(token) <= 256:
        return None
    token_digest = User.reset_token_digest(token)
    user = User.query.filter_by(reset_token=token_digest).first()
    return user if user and user.verify_reset_token(token) else None


@app.route('/api/reset-password', methods=['POST'])
@limiter.limit('5 per minute')
def reset_password():
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400
    token = data.get('token')
    new_password = data.get('password')
    if not isinstance(new_password, str) or not 8 <= len(new_password) <= 128:
        return jsonify({'success': False, 'error': 'პაროლი უნდა შეიცავდეს 8-დან 128-მდე სიმბოლოს'}), 400

    try:
        user = find_user_for_reset_token(token)
        if not user:
            return jsonify({'success': False, 'error': 'არასწორი ან ვადაგასული ტოკენი'}), 400
        user.set_password(new_password)
        user.clear_reset_token()
        user_id = user.id
        response = jsonify({'success': True, 'message': 'პაროლი წარმატებით შეიცვალა'})
        db.session.commit()
        logger.info('Password reset successful for user id=%s', user_id)
        return response
    except Exception:
        db.session.rollback()
        logger.exception('Password reset failed')
        return jsonify({'success': False, 'error': 'პაროლის შეცვლა ვერ მოხერხდა'}), 500


@app.route('/reset-password')
def reset_password_page():
    token = request.args.get('token')
    if not token:
        return redirect(url_for('home'))
    if not find_user_for_reset_token(token):
        return render_template('index.html', reset_error='არასწორი ან ვადაგასული ბმული')
    return render_template('index.html', reset_token=token)


def send_reset_email(to_email, username, reset_url):
    """Send a reset email without ever logging the secret reset URL."""
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    sender_email = app.config.get('MAIL_DEFAULT_SENDER', 'noreply@archub.ge')
    safe_username = html_escape(str(username), quote=True)
    safe_reset_url = html_escape(str(reset_url), quote=True)
    message = MIMEMultipart('alternative')
    message['Subject'] = 'Archub - პაროლის აღდგენა'
    message['From'] = sender_email
    message['To'] = to_email
    html = f"""
    <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #420092;">პაროლის აღდგენა</h2>
        <p>გამარჯობა, <strong>{safe_username}</strong>!</p>
        <p>მივიღეთ მოთხოვნა თქვენი პაროლის აღდგენაზე.</p>
        <p><a href="{safe_reset_url}">პაროლის შეცვლა</a></p>
        <p>ეს ბმული მოქმედებს <strong>1 საათის</strong> განმავლობაში.</p>
        <p>თუ თქვენ არ მოითხოვეთ პაროლის აღდგენა, უგულებელყოთ ეს შეტყობინება.</p>
      </div>
    </body></html>
    """
    message.attach(MIMEText(html, 'html', 'utf-8'))
    result = subprocess.run(
        ['/usr/sbin/sendmail', '-t', '-oi'],
        input=message.as_bytes(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=15,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError('sendmail rejected the password-reset message')
    logger.info('Password reset email accepted by sendmail')


def _process_reset_email(email):
    """Issue and synchronously hand a reset message to local sendmail."""
    with app.app_context():
        try:
            user = User.query.filter(func.lower(User.email) == email).first()
            if not user:
                return

            token = user.generate_reset_token()
            reset_url = f"{app.config['BASE_URL']}/reset-password?token={token}"
            recipient = user.email
            username = user.username
            db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception('Password reset token creation failed')
            return

        try:
            send_reset_email(recipient, username, reset_url)
        except Exception:
            # The persisted token is deliberately left to expire if sendmail
            # fails. Clearing it could race with a newer reset request.
            logger.exception('Password reset email delivery failed')


def _reap_reset_email_worker(process):
    """Reap a detached worker without coupling delivery to the request."""
    try:
        process.wait(timeout=30)
    except subprocess.TimeoutExpired:
        logger.warning('Password reset worker is still running after 30 seconds')
    except Exception:
        logger.exception('Unable to reap password reset worker')


def queue_reset_email(email):
    """Launch a detached worker so Passenger restarts cannot drop delivery."""
    process = subprocess.Popen(
        [sys.executable, '-m', 'app.reset_email_worker'],
        cwd=str(PROJECT_ROOT),
        stdin=subprocess.PIPE,
        stdout=None,
        stderr=None,
        text=True,
        close_fds=True,
        start_new_session=True,
    )
    try:
        process.stdin.write(email)
        process.stdin.close()
    except Exception:
        process.kill()
        process.wait(timeout=5)
        raise
    Thread(
        target=_reap_reset_email_worker,
        args=(process,),
        name='archub-password-reset-reaper',
        daemon=True,
    ).start()
    return process


@app.route('/api/status')
def status():
    try:
        if current_user.is_authenticated:
            return jsonify({
                'logged_in': True, 
                'user': {
                    'username': current_user.username, 
                    'is_admin': current_user.is_admin
                }
            })
        return jsonify({'logged_in': False})
    except Exception as e:
        logger.error(f'Error during login: {e}')
        return jsonify({
            'success': False,
            'error': 'ავტორიზაცია ვერ მოხერხდა'
        }), 500

@app.route('/api/projects/<int:project_id>/like', methods=['POST'])
@login_required
def like_project(project_id):
    try:
        if db.session.get(Project, project_id) is None:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        existing_like = db.session.query(project_likes).filter_by(
            user_id=current_user.id,
            project_id=project_id,
        ).first()
        if existing_like:
            db.session.execute(project_likes.delete().where(
                (project_likes.c.user_id == current_user.id) &
                (project_likes.c.project_id == project_id)
            ))
            liked = False
        else:
            db.session.execute(project_likes.insert().values(
                user_id=current_user.id,
                project_id=project_id,
            ))
            liked = True
        db.session.flush()
        likes_count = db.session.query(func.count(project_likes.c.user_id)).filter(
            project_likes.c.project_id == project_id
        ).scalar() or 0
        response = jsonify({
            'success': True,
            'liked': liked,
            'likes_count': likes_count,
        })
        db.session.commit()
        return response
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'error': 'Like state changed concurrently; retry'}), 409
    except Exception:
        db.session.rollback()
        logger.exception('Error updating like for project %s', project_id)
        return jsonify({'success': False, 'error': 'მოწონება ვერ მოხერხდა'}), 500
# API route to get user's liked projects
@app.route('/api/user/liked-projects')
@login_required
def get_user_liked_projects():
    try:
        # N+1 პრობლემის გადაჭრა: Subquery მოწონებების დასათვლელად
        likes_count_subquery = db.session.query(
            project_likes.c.project_id,
            func.count(project_likes.c.user_id).label('likes_count')
        ).group_by(project_likes.c.project_id).subquery()

        # მომხმარებლის მიერ მოწონებული პროექტები: join project_likes ტაბლოზე და ფილტრი მიმდინარე მომხმარებელზე
        liked_projects_with_counts = db.session.query(
            Project,
            likes_count_subquery.c.likes_count
        ).join(
            project_likes, Project.id == project_likes.c.project_id
        ).filter(
            project_likes.c.user_id == current_user.id
        ).outerjoin(
            likes_count_subquery, Project.id == likes_count_subquery.c.project_id
        ).options(selectinload(Project.photos)).all()

        # Create JSON response
        projects_data = []
        for project, likes_count in liked_projects_with_counts:
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]

            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': True,  # Always true for liked projects
                'likes_count': likes_count or 0
            }
            projects_data.append(project_data)

        return jsonify({
            'success': True,
            'projects': projects_data,
            'count': len(projects_data)
        })

    except Exception as e:
        logger.error(f'Error fetching liked projects: {e}')
        return jsonify({
            'success': False,
            'error': 'მოწონებული პროექტების ჩატვირთვა ვერ მოხერხდა'
        }), 500

# API route to get specific user's liked projects (for admin)
@app.route('/api/admin/user/<int:user_id>/liked-projects')
@admin_required
def get_admin_user_liked_projects(user_id):
    try:
        # Get the target user
        target_user = db.session.get(User, user_id)
        if not target_user:
            return jsonify({
                'success': False,
                'error': f'User with ID {user_id} not found'
            }), 404
        
        # N+1 პრობლემის გადაჭრა: Subquery მოწონებების დასათვლელად
        likes_count_subquery = db.session.query(
            project_likes.c.project_id,
            func.count(project_likes.c.user_id).label('likes_count')
        ).group_by(project_likes.c.project_id).subquery()
        
        # Get all liked projects for the target user with their like counts
        liked_projects_with_counts = db.session.query(
            Project,
            likes_count_subquery.c.likes_count
        ).join(
            project_likes, Project.id == project_likes.c.project_id
        ).filter(
            project_likes.c.user_id == user_id
        ).outerjoin(
            likes_count_subquery, Project.id == likes_count_subquery.c.project_id
        ).options(selectinload(Project.photos)).all()
        
        # Create JSON response
        projects_data = []
        for project, likes_count in liked_projects_with_counts:
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]
            
            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': True,  # Always true for liked projects
                'likes_count': likes_count or 0
            }
            projects_data.append(project_data)
        
        return jsonify({
            'success': True,
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'email': target_user.email
            },
            'projects': projects_data,
            'count': len(projects_data)
        })
    
    except Exception as e:
        logger.error(f'Error fetching liked projects for user {user_id}: {e}')
        return jsonify({
            'success': False,
            'error': 'მომხმარებლის მოწონებული პროექტების ჩატვირთვა ვერ მოხერხდა'
        }), 500

# API route to delete a user completely
@app.route('/api/admin/delete-user/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    try:
        # Find the user
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': f'მომხმარებელი ID {user_id} ვერ მოიძებნა'
            }), 404
        
        # Don't allow deleting yourself
        if user.id == current_user.id:
            return jsonify({
                'success': False,
                'error': 'საკუთარი თავის წაშლა არ შეიძლება'
            }), 400
        
        # Store username for response
        deleted_username = user.username
        deleted_email = user.email
        admin_username = current_user.username
        
        # Delete all liked projects associations (from project_likes table)
        # This will be handled by cascade, but let's be explicit
        db.session.execute(
            project_likes.delete().where(project_likes.c.user_id == user_id)
        )
        
        # Delete the user
        db.session.delete(user)
        response = jsonify({
            'success': True,
            'message': f'მომხმარებელი "{deleted_username}" წარმატებით წაიშალა',
            'deleted_user': {
                'id': user_id,
                'username': deleted_username,
                'email': deleted_email
            }
        })
        db.session.commit()
        logger.info(
            'User %s (ID: %s) deleted by admin %s',
            deleted_username,
            user_id,
            admin_username,
        )
        return response, 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error deleting user {user_id}: {e}')
        return jsonify({
            'success': False,
            'error': 'მომხმარებლის წაშლა ვერ მოხერხდა'
        }), 500

# Contact form API endpoint
@app.route('/api/contact', methods=['POST'])
@limiter.limit('10 per minute')
def contact_form():
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400

    sender_email = normalize_email_address(data.get('senderEmail'))
    raw_message = data.get('message')
    if not sender_email:
        return jsonify({'success': False, 'error': 'არასწორი ელ-ფოსტის ფორმატი'}), 400
    if not isinstance(raw_message, str):
        return jsonify({'success': False, 'error': 'message is required'}), 400
    message = bleach.clean(raw_message, tags=[], strip=True).strip()
    if not message or len(message) > app.config['MAX_CONTACT_MESSAGE_LENGTH']:
        return jsonify({'success': False, 'error': 'შეტყობინება ცარიელია ან ზედმეტად გრძელია'}), 400

    try:
        submission = ContactSubmission(sender_email=sender_email, message=message)
        db.session.add(submission)
        db.session.flush()
        submission_id = submission.id
        response = jsonify({
            'success': True,
            'message': 'Contact form submitted successfully',
            'submission_id': submission_id,
        })
        db.session.commit()
        logger.info('Contact form submission stored with id=%s', submission_id)
        return response, 201
    except Exception:
        db.session.rollback()
        logger.exception('Error processing contact form')
        return jsonify({'success': False, 'error': 'შეტყობინების გაგზავნა ვერ მოხერხდა'}), 500
# ===== CAROUSEL MANAGEMENT API ENDPOINTS =====

def serialize_carousel_image(image):
    return {
        'id': image.id,
        'url': image.url,
        'order': image.order,
        'is_active': image.is_active,
        'created_at': image.created_at.isoformat() if image.created_at else None,
    }


@app.route('/api/carousel')
def get_carousel_images():
    try:
        images = CarouselImage.query.filter_by(is_active=True).order_by(
            CarouselImage.order.asc(), CarouselImage.id.asc()
        ).all()
        return jsonify({
            'success': True,
            'images': [serialize_carousel_image(image) for image in images],
            'count': len(images),
        })
    except Exception:
        logger.exception('Error fetching carousel images')
        return jsonify({'success': False, 'error': 'კარუსელის ფოტოების ჩატვირთვა ვერ მოხერხდა'}), 500


@app.route('/api/carousel/all')
@admin_required
def get_all_carousel_images():
    try:
        images = CarouselImage.query.order_by(
            CarouselImage.order.asc(), CarouselImage.id.asc()
        ).all()
        return jsonify({
            'success': True,
            'images': [serialize_carousel_image(image) for image in images],
            'count': len(images),
        })
    except Exception:
        logger.exception('Error fetching all carousel images')
        return jsonify({'success': False, 'error': 'კარუსელის ფოტოების ჩატვირთვა ვერ მოხერხდა'}), 500


@app.route('/api/carousel', methods=['POST'])
@admin_required
def add_carousel_image():
    image_url = None
    try:
        image_file = request.files.get('image')
        if not image_file or not image_file.filename:
            return jsonify({'success': False, 'error': 'Image file is required'}), 400
        image_url = save_uploaded_file(image_file, 'carousel')
        if not image_url:
            return jsonify({'success': False, 'error': 'Invalid image file format'}), 400

        try:
            order = int(request.form.get('order', 0))
        except (TypeError, ValueError):
            delete_uploaded_file(image_url)
            return jsonify({'success': False, 'error': 'Order must be a valid integer'}), 400
        if not 0 <= order <= 10000:
            delete_uploaded_file(image_url)
            return jsonify({'success': False, 'error': 'Order must be between 0 and 10000'}), 400

        carousel_image = CarouselImage(url=image_url, order=order, is_active=True)
        db.session.add(carousel_image)
        db.session.flush()
        response = jsonify({
            'success': True,
            'message': 'Carousel image added successfully',
            'image': serialize_carousel_image(carousel_image),
        })
        db.session.commit()
        return response, 201
    except Exception:
        db.session.rollback()
        if image_url:
            delete_uploaded_file(image_url)
        logger.exception('Error adding carousel image')
        return jsonify({'success': False, 'error': 'კარუსელის ფოტოს დამატება ვერ მოხერხდა'}), 500


@app.route('/api/carousel/<int:image_id>/order', methods=['PUT'])
@admin_required
def update_carousel_image_order(image_id):
    data = get_json_object()
    if data is None:
        return jsonify({'success': False, 'error': 'JSON object is required'}), 400
    try:
        new_order = int(data.get('order'))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Order must be a valid integer'}), 400
    if not 0 <= new_order <= 10000:
        return jsonify({'success': False, 'error': 'Order must be between 0 and 10000'}), 400

    try:
        carousel_image = db.session.get(CarouselImage, image_id)
        if not carousel_image:
            return jsonify({'success': False, 'error': 'Carousel image not found'}), 404
        carousel_image.order = new_order
        response = jsonify({
            'success': True,
            'message': 'Carousel image order updated successfully',
            'image': serialize_carousel_image(carousel_image),
        })
        db.session.commit()
        return response
    except Exception:
        db.session.rollback()
        logger.exception('Error updating carousel image order %s', image_id)
        return jsonify({'success': False, 'error': 'კარუსელის რიგის განახლება ვერ მოხერხდა'}), 500


@app.route('/api/carousel/<int:image_id>/toggle', methods=['PUT'])
@admin_required
def toggle_carousel_image_status(image_id):
    try:
        carousel_image = db.session.get(CarouselImage, image_id)
        if not carousel_image:
            return jsonify({'success': False, 'error': 'Carousel image not found'}), 404
        carousel_image.is_active = not carousel_image.is_active
        response = jsonify({
            'success': True,
            'message': 'Carousel image status updated successfully',
            'image': serialize_carousel_image(carousel_image),
        })
        db.session.commit()
        return response
    except Exception:
        db.session.rollback()
        logger.exception('Error toggling carousel image status %s', image_id)
        return jsonify({'success': False, 'error': 'კარუსელის სტატუსის შეცვლა ვერ მოხერხდა'}), 500


@app.route('/api/carousel/<int:image_id>', methods=['DELETE'])
@admin_required
def delete_carousel_image(image_id):
    try:
        carousel_image = db.session.get(CarouselImage, image_id)
        if not carousel_image:
            return jsonify({'success': False, 'error': 'Carousel image not found'}), 404
        image_url = carousel_image.url
        db.session.delete(carousel_image)
        db.session.flush()
        should_delete_file = not uploaded_file_is_referenced(image_url)
        db.session.commit()
        file_deleted = (
            safely_delete_upload_if_unreferenced(image_url)
            if should_delete_file else False
        )
        return jsonify({
            'success': True,
            'message': 'Carousel image deleted successfully',
            'deleted_image': {
                'id': image_id,
                'url': image_url,
                'file_deleted': file_deleted,
            },
        })
    except Exception:
        db.session.rollback()
        logger.exception('Error deleting carousel image %s', image_id)
        return jsonify({'success': False, 'error': 'კარუსელის ფოტოს წაშლა ვერ მოხერხდა'}), 500
@app.route('/api/csrf-token')
def get_csrf_token():
    from flask_wtf.csrf import generate_csrf
    return jsonify({'csrf_token': generate_csrf()})

# Respect the selected environment when this module is run directly.
if __name__ == '__main__':
    app.run(debug=app.debug)
