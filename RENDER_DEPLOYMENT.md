# Render.com Deployment Guide - Sustindex Academia

## مراحل Deploy کردن پروژه روی Render.com

### مرحله 1: آماده‌سازی Backend (Django)

#### 1.1 ایجاد PostgreSQL Database
1. وارد داشبورد Render شوید: https://dashboard.render.com
2. روی **New +** کلیک کنید و **PostgreSQL** را انتخاب کنید
3. تنظیمات زیر را وارد کنید:
   - **Name**: `sustindex-db`
   - **Database**: `sustindex`
   - **User**: `sustindex`
   - **Region**: Frankfurt (یا نزدیک‌ترین منطقه)
   - **Plan**: Free یا Starter
4. روی **Create Database** کلیک کنید
5. بعد از ساخت، **Internal Database URL** را کپی کنید

#### 1.2 Deploy کردن Backend
1. روی **New +** کلیک کنید و **Web Service** را انتخاب کنید
2. Repository خود را متصل کنید: `https://github.com/nazaninghn/sustindex-academia`
3. تنظیمات زیر را وارد کنید:
   - **Name**: `sustindex-backend`
   - **Region**: Frankfurt
   - **Branch**: `main`
   - **Root Directory**: `sustindex-`
   - **Runtime**: Python 3
   - **Build Command**: `bash build.sh`
   - **Start Command**: `gunicorn sustindex.wsgi:application --bind 0.0.0.0:$PORT --workers 2`
   - **Plan**: Starter یا بالاتر (Free برای تست)

4. **Environment Variables** را اضافه کنید:
   ```
   DATABASE_URL = [Internal Database URL که کپی کردید]
   SECRET_KEY = [یک کلید تصادفی 50 کاراکتری]
   DEBUG = False
   ALLOWED_HOSTS = sustindex-backend.onrender.com
   DJANGO_SETTINGS_MODULE = sustindex.settings
   WEB_CONCURRENCY = 2
   ```

5. روی **Create Web Service** کلیک کنید

#### 1.3 تنظیمات Django Settings
فایل `sustindex-/sustindex/settings.py` را بررسی کنید که این تنظیمات را داشته باشد:

```python
import os
import dj_database_url

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Database
if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "https://sustindex-frontend.onrender.com",
    "http://localhost:3000",
]

CORS_ALLOW_CREDENTIALS = True
```

### مرحله 2: Deploy کردن Frontend (Next.js)

#### 2.1 ایجاد Web Service برای Frontend
1. روی **New +** کلیک کنید و **Web Service** را انتخاب کنید
2. همان Repository را انتخاب کنید
3. تنظیمات زیر را وارد کنید:
   - **Name**: `sustindex-frontend`
   - **Region**: Frankfurt
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter یا بالاتر

4. **Environment Variables** را اضافه کنید:
   ```
   NEXT_PUBLIC_API_URL = https://sustindex-backend.onrender.com
   NODE_ENV = production
   ```

5. روی **Create Web Service** کلیک کنید

### مرحله 3: تنظیمات نهایی

#### 3.1 به‌روزرسانی CORS در Backend
بعد از deploy شدن frontend، URL آن را به CORS اضافه کنید:
```python
CORS_ALLOWED_ORIGINS = [
    "https://sustindex-frontend.onrender.com",  # URL واقعی frontend
]
```

#### 3.2 ایجاد Superuser
از طریق Render Shell:
1. به سرویس Backend بروید
2. روی **Shell** کلیک کنید
3. دستور زیر را اجرا کنید:
```bash
python manage.py createsuperuser
```

#### 3.3 ایجاد Sample Data
```bash
python create_sample_data.py
```

### مرحله 4: تست و بررسی

1. **Backend URL**: `https://sustindex-backend.onrender.com/api/v1/`
2. **Frontend URL**: `https://sustindex-frontend.onrender.com`
3. **Admin Panel**: `https://sustindex-backend.onrender.com/en/admin/`

### نکات مهم

#### Performance
- Free plan بعد از 15 دقیقه بی‌فعالیت خاموش می‌شود
- برای production از Starter plan یا بالاتر استفاده کنید
- برای بهبود سرعت از CDN استفاده کنید

#### Database Backup
- از داشبورد Render می‌توانید backup بگیرید
- برای production حتماً backup منظم تنظیم کنید

#### Monitoring
- Logs را از داشبورد Render بررسی کنید
- برای مشکلات از **Shell** استفاده کنید

#### Custom Domain
برای اتصال دامنه اختصاصی:
1. به تنظیمات سرویس بروید
2. روی **Custom Domain** کلیک کنید
3. دامنه خود را اضافه کنید
4. DNS records را طبق راهنمای Render تنظیم کنید

### مشکلات رایج و راه‌حل

#### 1. Build Failed
- بررسی کنید که `requirements.txt` کامل باشد
- لاگ‌های build را بررسی کنید
- مطمئن شوید Python version درست است

#### 2. Database Connection Error
- `DATABASE_URL` را بررسی کنید
- مطمئن شوید که database ساخته شده است
- Internal URL را استفاده کنید نه External

#### 3. Static Files Not Loading
- `collectstatic` را در build.sh بررسی کنید
- `STATIC_ROOT` و `STATIC_URL` را چک کنید
- Whitenoise نصب باشد

#### 4. CORS Errors
- `CORS_ALLOWED_ORIGINS` را بررسی کنید
- Frontend URL را دقیق وارد کنید
- `CORS_ALLOW_CREDENTIALS = True` باشد

### هزینه‌ها (تقریبی)

- **Free Plan**: $0/ماه (محدودیت دارد)
- **Starter Plan**: $7/ماه برای هر سرویس
- **PostgreSQL Starter**: $7/ماه
- **جمع برای Production**: حدود $21/ماه (Backend + Frontend + Database)

### Alternative: استفاده از Docker

اگر می‌خواهید از Docker استفاده کنید:
1. Dockerfile برای backend و frontend بسازید
2. از Docker Compose برای local development استفاده کنید
3. روی Render از Docker deploy کنید

### پشتیبانی

- Documentation: https://render.com/docs
- Community: https://community.render.com
- Support: از داشبورد Render تیکت باز کنید

---

## چک‌لیست Deploy

- [ ] PostgreSQL Database ساخته شد
- [ ] Backend deploy شد
- [ ] Frontend deploy شد
- [ ] Environment variables تنظیم شدند
- [ ] CORS تنظیم شد
- [ ] Superuser ساخته شد
- [ ] Sample data اضافه شد
- [ ] تست login/register
- [ ] تست questionnaire
- [ ] تست PDF export
- [ ] بررسی responsive design
- [ ] تست دو زبانه بودن

موفق باشید! 🚀
