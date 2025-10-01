Archub Hosting Guide

This folder contains production deployment templates for running the app online. Choose the scenario that matches your hosting environment.

What’s included
- wsgi.py: WSGI entrypoint (app object) for Gunicorn or any WSGI server
- gunicorn.conf.py: Production Gunicorn settings
- nginx.conf: Example Nginx site config (reverse proxy, static files)
- archub.service: Example systemd unit to run Gunicorn as a service
- ENV_EXAMPLE.txt: Environment variables required in production
- Procfile: For platforms that use Procfile (Heroku-like)

Quick start (Ubuntu server)
1) Install system packages
   - Python 3.10+, venv, Nginx
   - Optionally PostgreSQL if you won’t use SQLite

2) Upload the project to /opt/archub (or any folder)

3) Create and activate venv, then install dependencies
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4) Copy env example and edit values
```
cp hosting/ENV_EXAMPLE.txt .env
```
Edit .env values (SECRET_KEY, DATABASE_URL, etc.).

5) Initialize the database (first time)
```
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```
or if you use migrations:
```
flask db upgrade
```

6) Test locally with Gunicorn
```
gunicorn -c hosting/gunicorn.conf.py hosting.wsgi:app
```

7) Configure Nginx
   - Copy hosting/nginx.conf to /etc/nginx/sites-available/archub
   - ln -s /etc/nginx/sites-available/archub /etc/nginx/sites-enabled/
   - sudo nginx -t && sudo systemctl reload nginx

8) Run as a service (recommended)
   - Copy hosting/archub.service to /etc/systemd/system/archub.service
   - sudo systemctl daemon-reload
   - sudo systemctl enable --now archub

Heroku-like platforms (optional)
- Use hosting/Procfile to define the web process:
  web: gunicorn -c hosting/gunicorn.conf.py hosting.wsgi:app

Paths referenced (update if different)
- Project root: /opt/archub
- Virtualenv: /opt/archub/venv
- Socket file (if using UDS): /opt/archub/run/gunicorn.sock
- Static files: /opt/archub/static

Security and production notes
- Set FLASK_ENV=production and a strong SECRET_KEY.
- Prefer PostgreSQL in production and set DATABASE_URL accordingly.
- Ensure static/uploads is writable by the app service user.
- Configure HTTPS in Nginx (use Certbot or your CA certificates).
- Consider moving user uploads to object storage (e.g., S3) for scalability.


