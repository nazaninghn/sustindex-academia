# Deploy همه چیز روی یک سرویس Render

## راه حل: Django + Next.js Static Build

این راه حل فقط **یک Web Service** نیاز دارد که هم Backend و هم Frontend را serve می‌کند.

---

## مرحله 1: آماده‌سازی Next.js برای Static Export

### 1.1 تغییر next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: '../sustindex-/staticfiles/frontend',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  },
}

module.exports = nextConfig
```

### 1.2 تغییر package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next build"
  }
}
```

---

## مرحله 2: تنظیمات Django

### 2.1 تغییر settings.py

```python
# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = [
    BASE_DIR / 'staticfiles' / 'frontend',
]

# Whitenoise
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # اضافه کنید
    # ... بقیه middleware ها
]

WHITENOISE_ROOT = BASE_DIR / 'staticfiles' / 'frontend'
WHITENOISE_INDEX_FILE = True
```

### 2.2 تغییر urls.py

```python
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api_urls')),
    
    # Frontend - باید آخر باشد
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

---

## مرحله 3: تغییر build.sh

```bash
#!/usr/bin/env bash
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Building Frontend..."
cd ../frontend
npm install
npm run build
cd ../sustindex-

echo "Collecting static files..."
python manage.py collectstatic --no-input

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser..."
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Admin created')
EOF

echo "Build completed!"
```

---

## مرحله 4: Deploy روی Render

### فقط یک Web Service:

```
Name: sustindex-app
Region: Frankfurt
Branch: main
Root Directory: sustindex-
Runtime: Python 3
Build Command: bash build.sh
Start Command: gunicorn sustindex.wsgi:application --bind 0.0.0.0:$PORT
Instance Type: Starter ($7/ماه)
```

### Environment Variables:

```
DATABASE_URL = [از PostgreSQL]
SECRET_KEY = your-secret-key-50-chars
DEBUG = False
ALLOWED_HOSTS = sustindex-app.onrender.com
DJANGO_SETTINGS_MODULE = sustindex.settings
NEXT_PUBLIC_API_URL = /api/v1
```

---

## 💰 هزینه کل

| سرویس | Plan | قیمت/ماه |
|-------|------|----------|
| PostgreSQL | Starter | $7 |
| Web Service (Backend+Frontend) | Starter | $7 |
| **جمع** | | **$14** |

**صرفه‌جویی: $7/ماه** 🎉

---

## ⚠️ محدودیت‌ها

این روش برای پروژه شما کار **نمی‌کند** چون:

1. ❌ Next.js App Router با `useRouter` و client components نمی‌تواند static export شود
2. ❌ صفحات dynamic مثل `[id]` مشکل دارند
3. ❌ API calls در client-side مشکل دارند

---

## ✅ راه حل پیشنهادی: Monorepo با Docker

اگر حتماً می‌خواهید یک سرویس داشته باشید، باید از Docker استفاده کنید:

### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18 AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11
WORKDIR /app
COPY sustindex-/requirements.txt ./
RUN pip install -r requirements.txt
COPY sustindex-/ ./
COPY --from=frontend /app/frontend/.next ./frontend/.next
COPY --from=frontend /app/frontend/public ./frontend/public

CMD ["gunicorn", "sustindex.wsgi:application"]
```

اما این روش پیچیده است و نیاز به تنظیمات بیشتری دارد.

---

## 🎯 نتیجه‌گیری

**بهترین راه حل برای پروژه شما:**

### گزینه 1: دو سرویس جدا (پیشنهادی) ✅
- Backend: $7/ماه
- Frontend: $7/ماه  
- Database: $7/ماه
- **جمع: $21/ماه**
- ✅ ساده، قابل اطمینان، مقیاس‌پذیر

### گزینه 2: Vercel (Frontend) + Render (Backend)
- Backend + Database: $14/ماه (Render)
- Frontend: **رایگان** (Vercel)
- **جمع: $14/ماه**
- ✅ ارزان‌تر، Frontend سریع‌تر

---

## 🚀 پیشنهاد نهایی: Vercel + Render

### Backend روی Render:
- PostgreSQL: $7/ماه
- Django Backend: $7/ماه

### Frontend روی Vercel:
- Next.js: **رایگان** (تا 100GB bandwidth)
- Deploy خودکار از GitHub
- CDN جهانی
- سرعت بالا

**جمع: $14/ماه** و Frontend خیلی سریع‌تر! 🎉

---

می‌خواهید کدام روش را انتخاب کنید؟
1. دو سرویس Render ($21/ماه)
2. Vercel + Render ($14/ماه) ⭐ پیشنهادی
