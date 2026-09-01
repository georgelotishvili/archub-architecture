# ===== ARCHUB - გაფართოებების ფაილი =====
# ეს ფაილი შეიცავს Flask გაფართოებების ინიციალიზაციას
# SQLAlchemy, LoginManager და სხვა გაფართოებები

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine

# ===== გაფართოებების ინიციალიზაცია =====
# SQLAlchemy ბაზის ობიექტის შექმნა
db = SQLAlchemy()


@event.listens_for(Engine, 'connect')
def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    """Enable SQLite referential integrity for every application connection."""
    module_name = type(dbapi_connection).__module__
    if not module_name.startswith('sqlite3'):
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute('PRAGMA foreign_keys=ON')
    finally:
        cursor.close()
