# Quick Start - Render Deployment

## مراحل سریع Deploy

### 1. Backend (Django)
```bash
# در Render Dashboard:
New + → Web Service
Repository: github.com/nazaninghn/sustindex-academia
Root Directory: sustindex-
Build Command: bash build.sh
Start Command: gunicorn sustindex.wsgi:application --bind 0.0.0.0:$PORT --workers 2
```

**Environment Variables:**
- `DATABASE_URL`: از PostgreSQL که ساختید
- `SECRET_KEY`: یک کلید 50 کاراکتری تصادفی
- `DEBUG`: False
- `ALLOWED_HOSTS`: sustindex-backend.onrender.com

### 2. Frontend (Next.js)
```bash
# در Render Dashboard:
New + → Static Site یا Web Service
Repository: github.com/nazaninghn/sustindex-academia
Root Directory: frontend
Build Command: npm install && npm run build
Start Command: npm start
```

**Environment Variables:**
- `NEXT_PUBLIC_API_URL`: https://sustindex-backend.onrender.com

### 3. Database
```bash
New + → PostgreSQL
Name: sustindex-db
Plan: Starter ($7/month) یا Free
```

### 4. بعد از Deploy
1. به admin panel بروید: `https://your-backend.onrender.com/en/admin/`
2. با `admin/admin123` لاگین کنید
3. سوالات را از طریق admin panel اضافه کنید

---

برای جزئیات بیشتر: `RENDER_DEPLOYMENT.md`
