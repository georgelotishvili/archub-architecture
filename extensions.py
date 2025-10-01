# ===== ARCHUB - გაფართოებების ფაილი =====
# ეს ფაილი შეიცავს Flask გაფართოებების ინიციალიზაციას
# SQLAlchemy, LoginManager და სხვა გაფართოებები

from flask_sqlalchemy import SQLAlchemy

# ===== გაფართოებების ინიციალიზაცია =====
# SQLAlchemy ბაზის ობიექტის შექმნა
db = SQLAlchemy()
