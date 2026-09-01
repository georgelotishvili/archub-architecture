# Archub - არქიტექტურული პორტფოლიო

არქიტექტურული პროექტების პორტფოლიო ვებ-აპლიკაცია Flask-ზე.

## სწრაფი გაშვება

```bash
# 1. შექმენით იზოლირებული გარემო და დააყენეთ დამოკიდებულებები
python -m venv venv
# Windows: venv\\Scripts\\activate
# Linux/macOS: source venv/bin/activate
python -m pip install -r requirements.txt

# 2. განაახლეთ სქემა და გაუშვით აპლიკაცია
python -m flask --app app db upgrade
python start.py
```

სერვერი გაიხსნება: http://127.0.0.1:5000

## პროექტის სტრუქტურა

```
archub/
├── app/                      # Flask აპლიკაცია
│   ├── __init__.py           # მთავარი აპლიკაცია და API routes
│   ├── models.py             # მონაცემთა ბაზის მოდელები
│   └── extensions.py         # Flask გაფართოებები (db)
│
├── config.py                 # კონფიგურაცია (dev/prod/test)
├── start.py                  # გამშვები სკრიპტი
├── db_commands.py            # DB მართვის ბრძანებები
├── requirements.txt          # Python დამოკიდებულებები
│
├── static/                   # სტატიკური ფაილები
│   ├── css/                  # სტილები
│   │   ├── styles.css
│   │   └── admin.css
│   ├── js/                   # JavaScript
│   │   ├── script.js
│   │   └── admin.js
│   ├── fonts/                # შრიფტები
│   ├── images/               # სურათები
│   └── uploads/              # ატვირთული ფაილები (gitignore)
│
├── templates/                # HTML შაბლონები
│   ├── index.html            # მთავარი გვერდი
│   ├── my_page.html          # მომხმარებლის გვერდი
│   ├── admin.html            # ადმინ პანელი
│   └── admin_users.html      # მომხმარებლების მართვა
│
├── migrations/               # DB მიგრაციები (Alembic)
└── hosting/                  # სერვერის კონფიგურაცია
    ├── wsgi.py               # Gunicorn entry point
    ├── gunicorn.conf.py      # Gunicorn კონფიგი
    └── nginx.conf            # Nginx კონფიგი
```

## სერვერზე გაშვება (Production)

```bash
# Gunicorn-ით
gunicorn hosting.wsgi:application -c hosting/gunicorn.conf.py
```

### Environment ცვლადები (.env)

```env
FLASK_ENV=production
SECRET_KEY=replace-with-a-random-value-of-at-least-32-characters
BASE_URL=https://archub.ge
DATABASE_URL=sqlite:////absolute/path/to/database.db
```

## API Endpoints

| მეთოდი | URL | აღწერა |
|--------|-----|--------|
| GET | `/api/projects` | პროექტების სია |
| POST | `/api/projects` | პროექტის დამატება |
| DELETE | `/api/projects/<id>` | პროექტის წაშლა |
| POST | `/api/contact` | კონტაქტ ფორმა |
| GET | `/api/carousel` | კარუსელის სურათები |

## ბმულები

- **მთავარი**: http://127.0.0.1:5000
- **ადმინი**: http://127.0.0.1:5000/admin
- **API**: http://127.0.0.1:5000/api/projects

## Database ბრძანებები

```bash
# ნიმუშის მონაცემები
python db_commands.py create

# სტატისტიკა
python db_commands.py stats

# პროექტების წაშლა — შეუქცევადი, მოითხოვს მკაფიო დადასტურებას
python db_commands.py clear-projects --yes-i-understand
```

## მიგრაციები

```bash
flask db migrate -m "Description"
flask db upgrade
flask db check
```
