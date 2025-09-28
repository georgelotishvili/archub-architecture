# ===== ARCHUB - არქიტექტურული პორტფოლიო ვებ-აპლიკაცია =====
# ეს არის მთავარი Flask აპლიკაციის ფაილი
# შეიცავს: API endpoints, routes, file upload ფუნქციები, authentication
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from config import config
from PIL import Image
import bleach
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ===== FLASK აპლიკაციის ინიციალიზაცია =====
# Flask აპლიკაციის შექმნა
app = Flask(__name__)

# CORS-ის ინიციალიზაცია (Cross-Origin Resource Sharing)
# CORS ინიციალიზდება კონფიგურაციის ჩატვირთვის შემდეგ; აქ ვრთავთ მხოლოდ CSRF-ს
csrf = CSRFProtect(app)

# კონფიგურაციის არჩევა FLASK_ENV ცვლადის მიხედვით
config_name = os.getenv('FLASK_ENV', 'default')
app.config.from_object(config[config_name])

# CORS კონფიგურაცია გარემოზე დაყრდნობით
if config_name == 'production':
    CORS(app, resources={r"/api/*": {"origins": [os.getenv('CORS_ORIGIN', 'https://archub.ge')]}}, supports_credentials=True)
else:
    CORS(app, supports_credentials=True)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, app=app)

# ატვირთული ფაილების საქაღალდის შექმნა (თუ არ არსებობს)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

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

# ===== გაფართოებების ინიციალიზაცია =====
# SQLAlchemy ბაზის ინიციალიზაცია
from extensions import db
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
from models import Project, Photo, User, CarouselImage, project_likes, ContactSubmission

# ===== FLASK-LOGIN კონფიგურაცია =====
# მომხმარებლის ჩატვირთვის ფუნქცია Flask-Login-ისთვის
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ===== ფაილის ატვირთვის დამხმარე ფუნქციები =====
def allowed_file(filename):
    """ფაილის გაფართოების შემოწმება - დაშვებულია თუ არა"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def generate_unique_filename(original_filename):
    """უნიკალური ფაილის სახელის გენერაცია კონფლიქტების თავიდან ასაცილებლად"""
    # ფაილის გაფართოების მიღება
    file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
    
    # უნიკალური ფაილის სახელის გენერაცია დროის ნიშნით და UUID-ით
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    
    if file_extension:
        return f"{timestamp}_{unique_id}.{file_extension}"
    else:
        return f"{timestamp}_{unique_id}"

def save_uploaded_file(file, folder=''):
    """Save uploaded file and return the URL path (with image verification)"""
    if file and allowed_file(file.filename):
        unique_filename = generate_unique_filename(file.filename)

        # Ensure folder exists
        folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder)
        os.makedirs(folder_path, exist_ok=True)

        # Verify image content using Pillow
        try:
            file.stream.seek(0)
            with Image.open(file.stream) as img:
                img.verify()
        except Exception:
            return None
        finally:
            try:
                file.stream.seek(0)
            except Exception:
                pass

        # Save file
        file_path = os.path.join(folder_path, unique_filename)
        file.save(file_path)

        # Return URL path (relative to static folder)
        return f"static/uploads/{folder}/{unique_filename}"
    return None

def delete_uploaded_file(file_url):
    """Delete uploaded file from filesystem safely, preserving subfolders"""
    try:
        if not file_url:
            return False

        # Normalize and strip leading slash
        normalized = file_url.replace('\\', '/').lstrip('/')

        # Only allow deletions inside static/uploads/
        prefix = 'static/uploads/'
        if not normalized.startswith(prefix):
            return False

        # Compute absolute paths safely
        upload_folder_abs = os.path.abspath(app.config['UPLOAD_FOLDER'])
        relative_subpath = os.path.normpath(normalized[len(prefix):])
        file_path_abs = os.path.abspath(os.path.join(upload_folder_abs, relative_subpath))

        # Ensure final path is still within uploads dir
        if not file_path_abs.startswith(upload_folder_abs):
            print(f"SECURITY WARNING: Attempted to delete file outside of upload folder: {file_url}")
            return False

        if os.path.exists(file_path_abs):
            os.remove(file_path_abs)
            return True
    except Exception as e:
        print(f"Error deleting file {file_url}: {e}")
    return False

# ===== მთავარი ROUTES (გვერდები) =====
# მთავარი გვერდი - პორტფოლიო
@app.route('/')
def home():
    return render_template('index.html')

# მომხმარებლის პროფილის გვერდი (ავტორიზაცია საჭირო)
@app.route('/my-page')
@login_required
def my_page():
    return render_template('my_page.html')

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
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]

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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to create new project with file uploads
@app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია პროექტის შექმნა
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Check if request has files
        if 'main_image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Main image is required'
            }), 400
        
        # Get form data
        area = request.form.get('area')
        if not area:
            return jsonify({
                'success': False,
                'error': 'Area field is required'
            }), 400
        # sanitize
        area = bleach.clean(area, tags=[], strip=True)
        
        # Get main image file
        main_image = request.files['main_image']
        if main_image.filename == '':
            return jsonify({
                'success': False,
                'error': 'Main image file is required'
            }), 400
        
        # Save main image
        main_image_url = save_uploaded_file(main_image, 'main')
        if not main_image_url:
            return jsonify({
                'success': False,
                'error': 'Invalid main image file format'
            }), 400
        
        # Create new project
        project = Project(
            area=area,
            main_image_url=main_image_url
        )
        
        db.session.add(project)
        db.session.flush()  # Get the project ID
        
        # Handle gallery photos
        gallery_photos = request.files.getlist('gallery_photos')
        saved_photos = []
        
        for photo_file in gallery_photos:
            if photo_file and photo_file.filename != '':
                photo_url = save_uploaded_file(photo_file, 'gallery')
                if photo_url:
                    photo = Photo(
                        url=photo_url,
                        project_id=project.id
                    )
                    db.session.add(photo)
                    saved_photos.append(photo_url)
        
        # Commit all changes
        db.session.commit()
        
        # Get all photos for this project (including main image)
        all_photos = [main_image_url] + saved_photos
        
        # Return created project data
        return jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': all_photos
            },
            'message': 'Project created successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to create empty project
@app.route('/api/projects/empty', methods=['POST'])
@login_required
def create_empty_project():
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია პროექტის შექმნა
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Create new empty project with default area
        project = Project(
            area='ახალი პროექტი',
            main_image_url=''
        )
        
        db.session.add(project)
        db.session.commit()
        
        # Return created project data
        return jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': []
            },
            'message': 'Empty project created successfully'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to delete a project
@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია პროექტის წაშლა
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project
        project = Project.query.get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Get all photos for this project
        photos = project.photos
        
        # Delete uploaded files from filesystem
        deleted_files = []
        failed_deletions = []
        
        # Delete main image file
        if project.main_image_url:
            if delete_uploaded_file(project.main_image_url):
                deleted_files.append(project.main_image_url)
            else:
                failed_deletions.append(project.main_image_url)
        
        # Delete gallery photo files
        for photo in photos:
            if delete_uploaded_file(photo.url):
                deleted_files.append(photo.url)
            else:
                failed_deletions.append(photo.url)
        
        # Delete from database (photos will be deleted automatically due to cascade)
        db.session.delete(project)
        db.session.commit()
        
        # Prepare response
        response_data = {
            'success': True,
            'message': f'Project {project_id} deleted successfully',
            'deleted_files': deleted_files,
            'project_info': {
                'id': project_id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos_count': len(photos)
            }
        }
        
        # Add warning if some files couldn't be deleted
        if failed_deletions:
            response_data['warning'] = f'Some files could not be deleted: {failed_deletions}'
        
        return jsonify(response_data), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to update a project
@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია პროექტის რედაქტირება
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project in the database
        project = Project.query.options(selectinload(Project.photos)).get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Get new area value from request form
        new_area = request.form.get('area')
        if not new_area:
            return jsonify({
                'success': False,
                'error': 'Area field is required'
            }), 400
        # sanitize
        new_area = bleach.clean(new_area, tags=[], strip=True)
        
        # Update the project's area field
        project.area = new_area
        
        # Save changes to database
        db.session.commit()
        
        # Get all photos for this project
        photo_urls = [photo.url for photo in project.photos]
        
        # Return updated project in JSON format
        return jsonify({
            'success': True,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls
            },
            'message': 'Project updated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to add photos to an existing project
@app.route('/api/projects/<int:project_id>/photos', methods=['POST'])
@login_required
def add_project_photos(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია ფოტოების დამატება
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project in the database
        project = Project.query.options(selectinload(Project.photos)).get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Check if request has files
        if 'photos' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No photos provided'
            }), 400
        
        # Get uploaded photos
        photos = request.files.getlist('photos')
        if not photos or photos[0].filename == '':
            return jsonify({
                'success': False,
                'error': 'No photos provided'
            }), 400
        
        saved_photos = []
        
        # Save each photo
        for photo_file in photos:
            if photo_file and photo_file.filename != '':
                photo_url = save_uploaded_file(photo_file, 'gallery')
                if photo_url:
                    photo = Photo(
                        url=photo_url,
                        project_id=project.id
                    )
                    db.session.add(photo)
                    saved_photos.append(photo_url)
        
        # Commit all changes
        db.session.commit()
        
        # Get all photos for this project
        all_photos = [photo.url for photo in project.photos]
        
        return jsonify({
            'success': True,
            'message': f'{len(saved_photos)} photos added successfully',
            'added_photos': saved_photos,
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': all_photos
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to update main image of a project
@app.route('/api/projects/<int:project_id>/main-image', methods=['PUT'])
@login_required
def update_project_main_image(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია მთავარი ფოტოს განახლება
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project in the database
        project = Project.query.options(selectinload(Project.photos)).get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Check if request has file
        if 'main_image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Main image file is required'
            }), 400
        
        # Get uploaded main image
        main_image = request.files['main_image']
        if main_image.filename == '':
            return jsonify({
                'success': False,
                'error': 'Main image file is required'
            }), 400
        
        # Delete old main image file if exists
        if project.main_image_url:
            delete_uploaded_file(project.main_image_url)
        
        # Save new main image
        new_main_image_url = save_uploaded_file(main_image, 'main')
        if not new_main_image_url:
            return jsonify({
                'success': False,
                'error': 'Invalid main image file format'
            }), 400
        
        # Update project's main image URL
        project.main_image_url = new_main_image_url
        
        # Commit changes
        db.session.commit()
        
        # Get all photos for this project
        all_photos = [photo.url for photo in project.photos]
        
        return jsonify({
            'success': True,
            'message': 'Main image updated successfully',
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': all_photos
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to delete main image of a project
@app.route('/api/projects/<int:project_id>/main-image', methods=['DELETE'])
@login_required
def delete_project_main_image(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია მთავარი ფოტოს წაშლა
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project in the database
        project = Project.query.options(selectinload(Project.photos)).get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Check if project has main image
        if not project.main_image_url:
            return jsonify({
                'success': False,
                'error': 'Project does not have a main image'
            }), 400
        
        # Delete main image file from filesystem
        file_deleted = delete_uploaded_file(project.main_image_url)
        
        # Set main image URL to empty (or you could set it to None)
        old_main_image_url = project.main_image_url
        project.main_image_url = ''
        
        # Commit changes
        db.session.commit()
        
        # Get all photos for this project
        all_photos = [photo.url for photo in project.photos]
        
        return jsonify({
            'success': True,
            'message': 'Main image deleted successfully',
            'deleted_main_image': {
                'url': old_main_image_url,
                'file_deleted': file_deleted
            },
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': all_photos
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to delete a photo from a project by URL
@app.route('/api/projects/<int:project_id>/photos', methods=['DELETE'])
@login_required
def delete_project_photo_by_url(project_id):
    try:
        # უსაფრთხოების შემოწმება: მხოლოდ ადმინისტრატორს შეუძლია ფოტოს წაშლა
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403

        # Find the project in the database
        project = Project.query.options(selectinload(Project.photos)).get(project_id)
        if not project:
            return jsonify({
                'success': False,
                'error': f'Project with ID {project_id} not found'
            }), 404
        
        # Get photo URL from request
        photo_url = request.form.get('photo_url')
        if not photo_url:
            return jsonify({
                'success': False,
                'error': 'Photo URL is required'
            }), 400
        
        # Find the photo by URL
        photo = Photo.query.filter_by(url=photo_url, project_id=project_id).first()
        if not photo:
            return jsonify({
                'success': False,
                'error': f'Photo with URL {photo_url} not found in project {project_id}'
            }), 404
        
        # Delete the photo file from filesystem
        file_deleted = delete_uploaded_file(photo.url)
        
        # Delete from database
        db.session.delete(photo)
        db.session.commit()
        
        # Get remaining photos for this project
        remaining_photos = [p.url for p in project.photos]
        
        return jsonify({
            'success': True,
            'message': 'Photo deleted successfully',
            'deleted_photo': {
                'id': photo.id,
                'url': photo.url,
                'file_deleted': file_deleted
            },
            'project': {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': remaining_photos
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# User authentication API endpoints

@app.route('/api/register', methods=['POST'])
@limiter.limit('5 per minute')
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'success': False, 'error': 'ყველა ველის შევსება აუცილებელია'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'მომხმარებელი ამ ელ-ფოსტით უკვე არსებობს'}), 409

    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'error': 'მომხმარებელი ამ სახელით უკვე არსებობს'}), 409

    new_user = User(username=username, email=email)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({'success': True, 'message': 'რეგისტრაცია წარმატებით დასრულდა'}), 201

@app.route('/api/login', methods=['POST'])
@limiter.limit('5 per minute')
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        # Validate required fields
        if not email or not password:
            return jsonify({
                'success': False, 
                'error': 'ელ-ფოსტა და პაროლი სავალდებულოა'
            }), 400

        # Validate email format
        try:
            validate_email(email)
        except EmailNotValidError:
            return jsonify({
                'success': False, 
                'error': 'არასწორი ელ-ფოსტის ფორმატი'
            }), 400

        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            login_user(user)
            return jsonify({
                'success': True, 
                'user': {
                    'username': user.username, 
                    'is_admin': user.is_admin
                }
            })

        return jsonify({
            'success': False, 
            'error': 'არასწორი ელ-ფოსტა ან პაროლი'
        }), 401

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    try:
        logout_user()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<int:project_id>/like', methods=['POST'])
@login_required
def like_project(project_id):
    try:
        project = Project.query.get_or_404(project_id)
        
        if project in current_user.liked_projects:
            current_user.liked_projects.remove(project)
            liked = False
        else:
            current_user.liked_projects.append(project)
            liked = True
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'liked': liked, 
            'likes_count': project.liked_by_users.count()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to get specific user's liked projects (for admin)
@app.route('/api/admin/user/<int:user_id>/liked-projects')
@login_required
def get_admin_user_liked_projects(user_id):
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403
        
        # Get the target user
        target_user = User.query.get(user_id)
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
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Contact form API endpoint
@app.route('/api/contact', methods=['POST'])
@limiter.limit('10 per minute')
def contact_form():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        # Extract required fields
        sender_email = data.get('senderEmail')
        message = data.get('message')
        
        # Validate required fields
        if not sender_email:
            return jsonify({
                'success': False,
                'error': 'senderEmail is required'
            }), 400
        
        if not message:
            return jsonify({
                'success': False,
                'error': 'message is required'
            }), 400
        
        # Validate email format
        try:
            validate_email(sender_email)
        except EmailNotValidError:
            return jsonify({
                'success': False,
                'error': 'არასწორი ელ-ფოსტის ფორმატი'
            }), 400

        # Log contact form submission
        print(f"Contact form submission from {sender_email}: {message[:50]}...")
        
        # Save to database
        submission = ContactSubmission(
            sender_email=sender_email,
            message=message
        )
        db.session.add(submission)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Contact form submitted successfully',
            'data': {
                'senderEmail': sender_email,
                'message': message,
                'timestamp': datetime.now().isoformat()
            }
        }), 200
        
    except Exception as e:
        print(f"Error processing contact form: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

# ===== CAROUSEL MANAGEMENT API ENDPOINTS =====

# API route to get all carousel images
@app.route('/api/carousel')
def get_carousel_images():
    try:
        # Query all active carousel images ordered by order field
        carousel_images = CarouselImage.query.filter_by(is_active=True).order_by(CarouselImage.order.asc()).all()
        
        # Create JSON response
        images_data = []
        for image in carousel_images:
            image_data = {
                'id': image.id,
                'url': image.url,
                'order': image.order,
                'is_active': image.is_active,
                'created_at': image.created_at.isoformat() if image.created_at else None
            }
            images_data.append(image_data)
        
        return jsonify({
            'success': True,
            'images': images_data,
            'count': len(images_data)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to add new carousel image
@app.route('/api/carousel', methods=['POST'])
@login_required
def add_carousel_image():
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403
        
        # Check if request has file
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Image file is required'
            }), 400
        
        # Get uploaded image
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Image file is required'
            }), 400
        
        # Save image file
        image_url = save_uploaded_file(image_file, 'carousel')
        if not image_url:
            return jsonify({
                'success': False,
                'error': 'Invalid image file format'
            }), 400
        
        # Get order from form data (optional)
        order = request.form.get('order', 0)
        try:
            order = int(order)
        except (ValueError, TypeError):
            order = 0
        
        # Create new carousel image
        carousel_image = CarouselImage(
            url=image_url,
            order=order,
            is_active=True
        )
        
        db.session.add(carousel_image)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Carousel image added successfully',
            'image': {
                'id': carousel_image.id,
                'url': carousel_image.url,
                'order': carousel_image.order,
                'is_active': carousel_image.is_active,
                'created_at': carousel_image.created_at.isoformat() if carousel_image.created_at else None
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to update carousel image order
@app.route('/api/carousel/<int:image_id>/order', methods=['PUT'])
@login_required
def update_carousel_image_order(image_id):
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403
        
        # Find the carousel image
        carousel_image = CarouselImage.query.get(image_id)
        if not carousel_image:
            return jsonify({
                'success': False,
                'error': f'Carousel image with ID {image_id} not found'
            }), 404
        
        # Get new order from request
        data = request.get_json()
        new_order = data.get('order')
        
        if new_order is None:
            return jsonify({
                'success': False,
                'error': 'Order field is required'
            }), 400
        
        try:
            new_order = int(new_order)
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Order must be a valid integer'
            }), 400
        
        # Update order
        carousel_image.order = new_order
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Carousel image order updated successfully',
            'image': {
                'id': carousel_image.id,
                'url': carousel_image.url,
                'order': carousel_image.order,
                'is_active': carousel_image.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to toggle carousel image active status
@app.route('/api/carousel/<int:image_id>/toggle', methods=['PUT'])
@login_required
def toggle_carousel_image_status(image_id):
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403
        
        # Find the carousel image
        carousel_image = CarouselImage.query.get(image_id)
        if not carousel_image:
            return jsonify({
                'success': False,
                'error': f'Carousel image with ID {image_id} not found'
            }), 404
        
        # Toggle active status
        carousel_image.is_active = not carousel_image.is_active
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Carousel image {"activated" if carousel_image.is_active else "deactivated"} successfully',
            'image': {
                'id': carousel_image.id,
                'url': carousel_image.url,
                'order': carousel_image.order,
                'is_active': carousel_image.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# API route to delete carousel image
@app.route('/api/carousel/<int:image_id>', methods=['DELETE'])
@login_required
def delete_carousel_image(image_id):
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'error': 'Access denied. Admin privileges required.'
            }), 403
        
        # Find the carousel image
        carousel_image = CarouselImage.query.get(image_id)
        if not carousel_image:
            return jsonify({
                'success': False,
                'error': f'Carousel image with ID {image_id} not found'
            }), 404
        
        # Delete image file from filesystem
        file_deleted = delete_uploaded_file(carousel_image.url)
        
        # Delete from database
        db.session.delete(carousel_image)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Carousel image deleted successfully',
            'deleted_image': {
                'id': image_id,
                'url': carousel_image.url,
                'file_deleted': file_deleted
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/csrf-token')
def get_csrf_token():
    from flask_wtf.csrf import generate_csrf
    return jsonify({'csrf_token': generate_csrf()})

# Run the server in debug mode when app.py is run directly
if __name__ == '__main__':
    app.run(debug=True)
