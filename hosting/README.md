# Archub production hosting guide

This folder contains deployment templates for two supported production modes:

- Gunicorn behind Nginx: `hosting.wsgi:application`
- cPanel/Passenger: `hosting/wsgi.py`, which exports `application`

Both WSGI entry points select `FLASK_ENV=production` before importing the Flask
application. Production startup fails closed when `SECRET_KEY` is absent, weak,
or still uses a development placeholder.

## Files

- `wsgi.py` — Gunicorn/WSGI entry point
- `gunicorn.conf.py` — Gunicorn process settings
- `nginx.conf` — HTTPS reverse proxy and static-file template
- `archub.service` — systemd service template
- `cpanel.htaccess` — account-specific cPanel/Passenger template
- `ENV_EXAMPLE.txt` — valid, secret-free dotenv example
- `Procfile` — process definition for Procfile-compatible platforms

## Ubuntu: Gunicorn and Nginx

The tested dependency baseline supports Python 3.10+. Python 3.11 or newer is
recommended for a new server.

1. Put the application in `/opt/archub` and create a dedicated virtualenv:

   ```bash
   cd /opt/archub
   python3 -m venv venv
   venv/bin/python -m pip install --upgrade pip
   venv/bin/python -m pip install -r requirements.txt
   venv/bin/python -m pip check
   ```

2. Create the production environment file and restrict its permissions:

   ```bash
   cp hosting/ENV_EXAMPLE.txt .env
   chmod 600 .env
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Paste the generated value into `SECRET_KEY=`. Keep `.env` outside version
   control and never send it in screenshots or support messages.

3. Apply database migrations before restarting the application:

   ```bash
   venv/bin/python -m flask --app app db upgrade
   ```

   SQLite is supported and is the current default. Back up `database.db` before
   every deployment. PostgreSQL remains an optional alternative through
   `DATABASE_URL`; migrate data deliberately rather than changing the URL on a
   live installation.

4. Verify the WSGI entry point:

   ```bash
   venv/bin/gunicorn --check-config \
     -c hosting/gunicorn.conf.py hosting.wsgi:application
   ```

5. Install `hosting/archub.service` as `/etc/systemd/system/archub.service`,
   then run:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now archub
   sudo systemctl status archub
   ```

6. Install `hosting/nginx.conf` as the site configuration, provision a TLS
   certificate for `archub.ge` and `www.archub.ge`, and validate before reload:

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   curl --fail https://archub.ge/healthz
   ```

The Nginx template and Flask both enforce a 16 MB request limit. Keep those
values synchronized if the application limit changes.

## cPanel/Passenger

For this account, the app root is `/home/archubge/public_html/archub` and the
Python 3.11 virtualenv is `/home/archubge/virtualenv/public_html/archub/3.11`.
Do not overwrite the working domain-root `.htaccess` during an application
deploy. It is host-managed runtime configuration, is backed up separately, and
currently includes the account-specific `PassengerAppLogFile`. The file
`hosting/cpanel.htaccess` is a reference for a new installation only: merge it
with the provider-approved live configuration and verify every Passenger path
before any manual replacement. The automated deploy deliberately preserves the
live file. The startup file is `hosting/wsgi.py`, which exports `application`
and selects production before importing the app.

After changing Python files or dependencies, restart Passenger from cPanel or:

```bash
mkdir -p tmp
touch tmp/restart.txt
```

The service account must be able to write `static/uploads/`, the SQLite database
(when used), and the application log directory. It does not need root access.

## Procfile-compatible platforms

The included Procfile runs:

```text
web: gunicorn -c hosting/gunicorn.conf.py hosting.wsgi:application
```

Set all values from `ENV_EXAMPLE.txt` in the platform's secret/environment
manager; do not commit a populated `.env` file.

## Pre-deployment verification

Install development tooling in a clean virtualenv and run:

```bash
python -m pip install -r requirements-dev.txt
python -m pip check
python -m pip_audit --strict
python -m pytest -q
```

Also verify that `BASE_URL` and `CORS_ORIGIN` are exactly `https://archub.ge`,
HTTPS is active, `/healthz` returns HTTP 200, and a current database/upload backup
exists before replacing production files.
