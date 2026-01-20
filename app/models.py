# ===== ARCHUB - მონაცემთა ბაზის მოდელები =====
# ეს ფაილი შეიცავს ყველა მონაცემთა ბაზის მოდელს
# მოდელები: User (მომხმარებელი), Project (პროექტი), Photo (ფოტო)

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from app.extensions import db
import secrets

# ===== მრავალ-მრავალ კავშირის ცხრილი =====
# მომხმარებლებისა და მოწონებული პროექტების კავშირი
project_likes = db.Table('project_likes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('project_id', db.Integer, db.ForeignKey('project.id'), primary_key=True)
)

# ===== მომხმარებლის მოდელი =====
class User(UserMixin, db.Model):
    """მომხმარებლის მოდელი - შეიცავს მომხმარებლის ძირითად ინფორმაციას"""
    id = db.Column(db.Integer, primary_key=True)  # უნიკალური ID
    username = db.Column(db.String(150), unique=True, nullable=False)  # მომხმარებლის სახელი (გენერირდება ავტომატურად)
    email = db.Column(db.String(150), unique=True, nullable=False)  # ელ-ფოსტა
    password_hash = db.Column(db.String(256), nullable=False)  # დაშიფრული პაროლი
    is_admin = db.Column(db.Boolean, default=False)  # ადმინისტრატორის სტატუსი
    
    # მომხმარებლის პირადი ინფორმაცია
    first_name = db.Column(db.String(100), nullable=True)  # სახელი
    last_name = db.Column(db.String(100), nullable=True)  # გვარი
    phone = db.Column(db.String(50), nullable=True)  # ტელეფონის ნომერი
    
    # პაროლის აღდგენის ველები
    reset_token = db.Column(db.String(100), unique=True, nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    # კავშირი მოწონებულ პროექტებთან (მრავალ-მრავალ კავშირი)
    liked_projects = db.relationship('Project', secondary=project_likes, lazy='dynamic',
                                     backref=db.backref('liked_by_users', lazy='dynamic'))

    def set_password(self, password):
        """პაროლის დაშიფვრა და შენახვა"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """პაროლის შემოწმება"""
        return check_password_hash(self.password_hash, password)
    
    def generate_reset_token(self):
        """პაროლის აღდგენის ტოკენის გენერირება (მოქმედებს 1 საათი)"""
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        return self.reset_token
    
    def verify_reset_token(self, token):
        """ტოკენის შემოწმება"""
        if self.reset_token != token:
            return False
        if self.reset_token_expiry is None or datetime.utcnow() > self.reset_token_expiry:
            return False
        return True
    
    def clear_reset_token(self):
        """ტოკენის წაშლა გამოყენების შემდეგ"""
        self.reset_token = None
        self.reset_token_expiry = None

    def __repr__(self):
        return f'<User {self.username}>'

# ===== პროექტის მოდელი =====
class Project(db.Model):
    """პროექტის მოდელი - შეიცავს არქიტექტურული პროექტის ინფორმაციას"""
    id = db.Column(db.Integer, primary_key=True)  # უნიკალური ID
    area = db.Column(db.String(100), nullable=False)  # პროექტის ფართობი
    main_image_url = db.Column(db.String(200), nullable=True, default='')  # მთავარი სურათის URL
    
    # კავშირი Photo მოდელთან (ერთ-მრავალ კავშირი)
    photos = db.relationship('Photo', backref='project', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Project {self.id}: {self.area}>'

# ===== ფოტოს მოდელი =====
class Photo(db.Model):
    """ფოტოს მოდელი - შეიცავს პროექტის ფოტოების ინფორმაციას"""
    id = db.Column(db.Integer, primary_key=True)  # უნიკალური ID
    url = db.Column(db.String(200), nullable=False)  # ფოტოს URL
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)  # პროექტის ID
    order = db.Column(db.Integer, default=0)  # ფოტოს რიგითობა პროექტში
    
    def __repr__(self):
        return f'<Photo {self.id}: {self.url}>'

# ===== კარუსელის ფოტოს მოდელი =====
class CarouselImage(db.Model):
    """კარუსელის ფოტოს მოდელი - შეიცავს მთავარი გვერდის კარუსელის ფოტოების ინფორმაციას"""
    id = db.Column(db.Integer, primary_key=True)  # უნიკალური ID
    url = db.Column(db.String(200), nullable=False)  # ფოტოს URL
    order = db.Column(db.Integer, default=0)  # ფოტოს რიგითობა კარუსელში
    is_active = db.Column(db.Boolean, default=True)  # არის თუ არა ფოტო აქტიური
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # შექმნის თარიღი
    
    def __repr__(self):
        return f'<CarouselImage {self.id}: {self.url}>'

# ===== კონტაქტის ფორმის მოდელი =====
class ContactSubmission(db.Model):
    """კონტაქტის ფორმის მოდელი - შეიცავს შემოსულ შეტყობინებებს"""
    id = db.Column(db.Integer, primary_key=True)
    sender_email = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f'<ContactSubmission {self.id} from {self.sender_email}>'