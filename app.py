from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from config import config

# Create Flask application instance
app = Flask(__name__)

# Configuration selection based on FLASK_ENV
config_name = os.getenv('FLASK_ENV', 'default')
app.config.from_object(config[config_name])

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Database Models
class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    area = db.Column(db.String(100), nullable=False)
    main_image_url = db.Column(db.String(200), nullable=False)
    
    # Relationship with Photo model
    photos = db.relationship('Photo', backref='project', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Project {self.id}: {self.area}>'

class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(200), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    
    def __repr__(self):
        return f'<Photo {self.id}: {self.url}>'

# Helper functions for file upload
def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def generate_unique_filename(original_filename):
    """Generate unique filename to avoid conflicts"""
    # Get file extension
    file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
    
    # Generate unique filename with timestamp and UUID
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

# Main route
@app.route('/')
def home():
    return render_template('index.html')

# Admin route
@app.route('/admin')
def admin():
    return render_template('admin.html')

# API test route
@app.route('/test-api')
def test_api():
    return app.send_static_file('test_api.html')

# Upload test route
@app.route('/test-upload')
def test_upload():
    return app.send_static_file('test_upload.html')

# Delete test route
@app.route('/test-delete')
def test_delete():
    return app.send_static_file('test_delete.html')

# API route to get all projects
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
            
            project_data = {
                'id': project.id,
                'area': project.area,
                'main_image_url': project.main_image_url,
                'photos': photo_urls
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
        
        # Print received data to console (for development)
        print("=" * 50)
        print("CONTACT FORM SUBMISSION")
        print("=" * 50)
        print(f"Sender Email: {sender_email}")
        print(f"Message: {message}")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        # TODO: In a real application, here would be the email sending logic
        # For example, using Flask-Mail:
        # from flask_mail import Mail, Message
        # mail = Mail(app)
        # msg = Message(
        #     subject='New Contact Form Submission',
        #     sender=sender_email,
        #     recipients=['admin@archub.ge']
        # )
        # msg.body = f"From: {sender_email}\n\nMessage:\n{message}"
        # mail.send(msg)
        
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
