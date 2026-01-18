# Archub - არქიტექტურული პორტფოლიო ვებ-საიტი

არქიტექტურული პროექტების პორტფოლიო ვებ-აპლიკაცია Flask-ზე.

## სწრაფი გაშვება (ლოკალურად)

### 1. დააყენეთ Python დამოკიდებულებები:
```bash
pip install -r requirements.txt
```

### 2. გაუშვით აპლიკაცია:
```bash
python start.py
```

სერვერი ავტომატურად:
- შექმნის საჭირო საქაღალდეებს
- შექმნის მონაცემთა ბაზას
- გაუშვებს სერვერს მისამართზე: http://127.0.0.1:5000

## ფაილების სტრუქტურა

```
archub/
├── start.py              # მთავარი გამშვები ფაილი
├── app.py                # Flask აპლიკაცია
├── config.py             # კონფიგურაცია
├── models.py             # მონაცემთა ბაზის მოდელები
├── requirements.txt      # Python დამოკიდებულებები
├── .env.example          # გარემოს ცვლადების მაგალითი
├── templates/            # HTML შაბლონები
├── static/               # სტატიკური ფაილები
│   ├── styles.css
│   ├── script.js
│   └── uploads/          # ატვირთული ფაილები
└── hosting/              # სერვერის კონფიგურაცია
```

## სერვერზე დეპლოიმენტი (Production)

### Gunicorn-ით:
```bash
gunicorn "start:create_app()" -w 4 -b 0.0.0.0:8000
```

### Environment ცვლადები:
დააკოპირეთ `.env.example` როგორც `.env` და შეცვალეთ მნიშვნელობები:
```
FLASK_ENV=production
SECRET_KEY=თქვენი-საიდუმლო-გასაღები
DATABASE_URL=postgresql://user:pass@localhost/archub
```

## ბმულები

- **მთავარი გვერდი**: http://127.0.0.1:5000
- **ადმინ პანელი**: http://127.0.0.1:5000/admin
- **API**: http://127.0.0.1:5000/api/projects

## Usage

### Main Website
- Visit `http://127.0.0.1:5000` to view the main portfolio website
- Browse through architectural projects in the carousel
- Click on projects to view photo galleries
- Use the contact form to send messages

### Admin Panel
- Visit `http://127.0.0.1:5000/admin` to access the admin panel
- Add new projects with images
- Delete existing projects
- Manage project galleries

### API Endpoints

- `GET /api/projects` - Retrieve all projects
- `POST /api/projects` - Create a new project
- `DELETE /api/projects/<id>` - Delete a project
- `POST /api/contact` - Submit contact form

## Database Management

### Create Sample Data
```bash
python db_commands.py create
```

### Show Database Statistics
```bash
python db_commands.py stats
```

### Clear All Data
```bash
python db_commands.py clear
```

## Development

### File Upload Configuration
- Uploaded files are stored in `static/uploads/`
- Supported formats: PNG, JPG, JPEG, GIF, WEBP
- Maximum file size: 16MB

### Database Migrations
```bash
# Create a new migration
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade
```

### Adding New Features
1. Update the database models in `app.py`
2. Create and run migrations
3. Add API endpoints as needed
4. Update frontend JavaScript for new functionality

## Production Deployment

### Environment Variables
Set the following environment variables for production:

```bash
export FLASK_ENV=production
export SECRET_KEY=your-secret-key-here
export DATABASE_URL=your-production-database-url
```

### WSGI Server
For production, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

### Email Configuration
To enable email functionality for contact forms:

1. Install Flask-Mail:
```bash
pip install Flask-Mail
```

2. Add email configuration to `app.py`:
```python
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'
```

3. Uncomment the email sending code in the contact form endpoint

## Troubleshooting

### Common Issues

1. **Database not found**: Run `python -c "from app import app, db; app.app_context().push(); db.create_all()"`

2. **Migration errors**: Delete the `migrations` folder and recreate it:
```bash
rm -rf migrations
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

3. **File upload errors**: Ensure the `static/uploads` directory exists and has write permissions

4. **Port already in use**: Change the port in `app.py` or kill the process using the port

### Debug Mode
The application runs in debug mode by default. For production, set:
```python
app.run(debug=False)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.

Test deploy — 2025-10-01
