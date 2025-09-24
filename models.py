# ===== ARCHUB - მონაცემთა ბაზის მოდელები =====
# ეს ფაილი შეიცავს ყველა მონაცემთა ბაზის მოდელს
# მოდელები: User (მომხმარებელი), Project (პროექტი), Photo (ფოტო)

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db

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
    username = db.Column(db.String(150), unique=True, nullable=False)  # მომხმარებლის სახელი
    email = db.Column(db.String(150), unique=True, nullable=False)  # ელ-ფოსტა
    password_hash = db.Column(db.String(256), nullable=False)  # დაშიფრული პაროლი
    is_admin = db.Column(db.Boolean, default=False)  # ადმინისტრატორის სტატუსი

    # კავშირი მოწონებულ პროექტებთან (მრავალ-მრავალ კავშირი)
    liked_projects = db.relationship('Project', secondary=project_likes, lazy='dynamic',
                                     backref=db.backref('liked_by_users', lazy='dynamic'))

    def set_password(self, password):
        """პაროლის დაშიფვრა და შენახვა"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """პაროლის შემოწმება"""
        return check_password_hash(self.password_hash, password)

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
    
    def __repr__(self):
        return f'<Photo {self.id}: {self.url}>'
