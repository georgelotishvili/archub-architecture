# Archub - არქიტექტურული პორტფოლიო

არქიტექტურული პროექტების პორტფოლიო ვებ-აპლიკაცია Flask-ზე.

## სწრაფი გაშვება

```bash
# 1. დააყენეთ დამოკიდებულებები
pip install -r requirements.txt

# 2. გაუშვით აპლიკაცია
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
gunicorn "start:create_app()" -c hosting/gunicorn.conf.py
```

### Environment ცვლადები (.env)

```env
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:pass@localhost/archub
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

# გასუფთავება
python db_commands.py clear
```

## მიგრაციები

```bash
flask db migrate -m "Description"
flask db upgrade
flask db downgrade
```
