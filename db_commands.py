#!/usr/bin/env python3
"""
Database management commands for the Archub project
"""

from app import app, db, Project, Photo
from models import User

def create_sample_data():
    """Create sample projects and photos for testing"""
    with app.app_context():
        # Check if data already exists
        if Project.query.first():
            print("Sample data already exists!")
            return
        
        # Create sample projects
        projects_data = [
            {
                "area": "120 კვ.მ",
                "main_image_url": "static/photos/pro 1.png",
                "photos": [
                    "static/photos/pro 1.png",
                    "static/photos/pro 2.jpg",
                    "static/photos/pro 3.png"
                ]
            },
            {
                "area": "85 კვ.მ",
                "main_image_url": "static/photos/pro 4.jpg",
                "photos": [
                    "static/photos/pro 4.jpg",
                    "static/photos/pro 5.jpg"
                ]
            }
        ]
        
        for project_data in projects_data:
            # Create project
            project = Project(
                area=project_data["area"],
                main_image_url=project_data["main_image_url"]
            )
            db.session.add(project)
            db.session.flush()  # Get the project ID
            
            # Add photos to project
            for photo_url in project_data["photos"]:
                photo = Photo(
                    url=photo_url,
                    project_id=project.id
                )
                db.session.add(photo)
        
        db.session.commit()
        print("Sample data created successfully!")

def show_database_stats():
    """Show database statistics"""
    with app.app_context():
        project_count = Project.query.count()
        photo_count = Photo.query.count()
        
        print(f"Database Statistics:")
        print(f"  Projects: {project_count}")
        print(f"  Photos: {photo_count}")
        
        if project_count > 0:
            print(f"\nProjects:")
            for project in Project.query.all():
                photo_count = len(project.photos)
                print(f"  - {project.area} (ID: {project.id}) - {photo_count} photos")

def clear_database():
    """Clear all data from database"""
    with app.app_context():
        Photo.query.delete()
        Project.query.delete()
        db.session.commit()
        print("Database cleared!")

def make_admin(email):
    """Make a user admin by email"""
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        if user:
            user.is_admin = True
            db.session.commit()
            print(f"User {user.username} ({user.email}) is now an admin.")
        else:
            print(f"User with email {email} not found.")

def list_users():
    """List all users in the database"""
    with app.app_context():
        users = User.query.all()
        if users:
            print(f"Found {len(users)} users:")
            for user in users:
                admin_status = "Admin" if user.is_admin else "User"
                print(f"  - {user.username} ({user.email}) - {admin_status}")
        else:
            print("No users found in database.")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "create":
            create_sample_data()
        elif command == "stats":
            show_database_stats()
        elif command == "clear":
            clear_database()
        elif command == "list-users":
            list_users()
        elif command == "make-admin":
            if len(sys.argv) > 2:
                email = sys.argv[2]
                make_admin(email)
            else:
                print("Usage: python db_commands.py make-admin <email>")
        else:
            print("Available commands: create, stats, clear, list-users, make-admin")
    else:
        print("Database Management Commands:")
        print("  python db_commands.py create  - Create sample data")
        print("  python db_commands.py stats   - Show database statistics")
        print("  python db_commands.py clear   - Clear all data")
        print("  python db_commands.py list-users - List all users")
        print("  python db_commands.py make-admin <email> - Make user admin")
