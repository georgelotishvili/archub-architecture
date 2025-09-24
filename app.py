# ===== ARCHUB - არქიტექტურული პორტფოლიო ვებ-აპლიკაცია =====
# ეს არის მთავარი Flask აპლიკაციის ფაილი
# შეიცავს: API endpoints, routes, file upload ფუნქციები, authentication

from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from config import config

# ===== FLASK აპლიკაციის ინიციალიზაცია =====
# Flask აპლიკაციის შექმნა
app = Flask(__name__)

# CORS-ის ინიციალიზაცია (Cross-Origin Resource Sharing)
CORS(app)

# კონფიგურაციის არჩევა FLASK_ENV ცვლადის მიხედვით
config_name = os.getenv('FLASK_ENV', 'default')
app.config.from_object(config[config_name])

# ატვირთული ფაილების საქაღალდის შექმნა (თუ არ არსებობს)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ===== გაფართოებების ინიციალიზაცია =====
# SQLAlchemy ბაზის ინიციალიზაცია
from extensions import db
db.init_app(app)
migrate = Migrate(app, db)

# LoginManager-ის ინიციალიზაცია (მომხმარებლის ავტორიზაციისთვის)
login_manager = LoginManager()
login_manager.init_app(app)

# მოდელების იმპორტი models.py ფაილიდან
from models import Project, Photo, User, project_likes

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
    """Save uploaded file and return the URL path"""
    if file and allowed_file(file.filename):
        # Generate unique filename
        unique_filename = generate_unique_filename(file.filename)
        
        # Create folder path
        folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # Save file
        file_path = os.path.join(folder_path, unique_filename)
        file.save(file_path)
        
        # Return URL path (relative to static folder)
        return f"static/uploads/{folder}/{unique_filename}"
    return None

def delete_uploaded_file(file_url):
    """Delete uploaded file from filesystem"""
    try:
        if file_url and file_url.startswith('static/uploads/'):
            basedir = os.path.abspath(os.path.dirname(__file__))
            file_path = os.path.join(basedir, file_url)
            if os.path.exists(file_path):
                os.remove(file_path)
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
        # Query all projects from database
        projects = Project.query.all()
        
        # Create JSON response
        projects_data = []
        for project in projects:
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]
            
            # Check if current user has liked this project
            is_liked = False
            if current_user.is_authenticated:
                is_liked = project in current_user.liked_projects
            
            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': is_liked,
                'likes_count': project.liked_by_users.count()
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
def create_project():
    try:
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
def create_empty_project():
    try:
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
def delete_project(project_id):
    try:
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
def update_project(project_id):
    try:
        # Find the project in the database
        project = Project.query.get(project_id)
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
def add_project_photos(project_id):
    try:
        # Find the project in the database
        project = Project.query.get(project_id)
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
def update_project_main_image(project_id):
    try:
        # Find the project in the database
        project = Project.query.get(project_id)
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
def delete_project_main_image(project_id):
    try:
        # Find the project in the database
        project = Project.query.get(project_id)
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
def delete_project_photo_by_url(project_id):
    try:
        # Find the project in the database
        project = Project.query.get(project_id)
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
        # Get all liked projects for current user
        liked_projects = current_user.liked_projects.all()
        
        # Create JSON response
        projects_data = []
        for project in liked_projects:
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]
            
            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': True,  # Always true for liked projects
                'likes_count': project.liked_by_users.count()
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
        
        # Get all liked projects for the target user
        liked_projects = target_user.liked_projects.all()
        
        # Create JSON response
        projects_data = []
        for project in liked_projects:
            # Get all photo URLs for this project
            photo_urls = [photo.url for photo in project.photos]
            
            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls,
                'is_liked': True,  # Always true for liked projects
                'likes_count': project.liked_by_users.count()
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
        
        # Log contact form submission
        print(f"Contact form submission from {sender_email}: {message[:50]}...")
        
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

# Run the server in debug mode when app.py is run directly
if __name__ == '__main__':
    app.run(debug=True)
