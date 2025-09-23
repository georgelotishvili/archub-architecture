from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os

# Create Flask application instance
app = Flask(__name__)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

# Main route
@app.route('/')
def home():
    return render_template('index.html')

# Admin route
@app.route('/admin')
def admin():
    return render_template('admin.html')

# Run the server in debug mode when app.py is run directly
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
