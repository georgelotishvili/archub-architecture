from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db

# Many-to-Many კავშირის ცხრილი
project_likes = db.Table('project_likes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('project_id', db.Integer, db.ForeignKey('project.id'), primary_key=True)
)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)

    # კავშირი მოწონებულ პროექტებთან
    liked_projects = db.relationship('Project', secondary=project_likes, lazy='dynamic',
                                     backref=db.backref('liked_by_users', lazy='dynamic'))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

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
