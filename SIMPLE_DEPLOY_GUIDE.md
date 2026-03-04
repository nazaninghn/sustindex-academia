# راهنمای ساده Deploy روی Render

## مهم: فرانت و بک جدا هستند و باید جداگانه deploy شوند

---

## مرحله 1️⃣: Database (5 دقیقه)

1. برو به: https://dashboard.render.com
2. کلیک کن: **New +** → **PostgreSQL**
3. پر کن:
   - Name: `sustindex-db`
   - Region: Frankfurt
   - Plan: **Starter** ($7/ماه) یا Free (برای تست)
4. کلیک کن: **Create Database**
5. صبر کن تا ساخته بشه (2-3 دقیقه)
6. **Internal Database URL** رو کپی کن و یه جایی ذخیره کن

---

## مرحله 2️⃣: Backend - Django (10 دقیقه)

1. کلیک کن: **New +** → **Web Service**
2. Connect کن: `github.com/nazaninghn/sustindex-academia`
3. پر کن:
   ```
   Name: sustindex-backend
   Region: Frankfurt
   Branch: main
   Root Directory: sustindex-
   Runtime: Python 3
   Build Command: bash build.sh
   Start Command: gunicorn sustindex.wsgi:application --bind 0.0.0.0:$PORT --workers 2
   Instance Type: Starter ($7/ماه)
   ```

4. **Environment Variables** اضافه کن:
   ```
   DATABASE_URL = [اون URL که کپی کردی]
   SECRET_KEY = django-insecure-your-secret-key-here-make-it-50-chars
   DEBUG = False
   ALLOWED_HOSTS = sustindex-backend.onrender.com
   DJANGO_SETTINGS_MODULE = sustindex.settings
   WEB_CONCURRENCY = 2
   ```

5. کلیک کن: **Create Web Service**
6. صبر کن تا deploy بشه (5-10 دقیقه)
7. بعد از deploy، URL رو کپی کن: `https://sustindex-backend.onrender.com`

---

## مرحله 3️⃣: Frontend - Next.js (10 دقیقه)

1. کلیک کن: **New +** → **Web Service**
2. همون Repository رو انتخاب کن
3. پر کن:
   ```
   Name: sustindex-frontend
   Region: Frankfurt
   Branch: main
   Root Directory: frontend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   Instance Type: Starter ($7/ماه)
   ```

4. **Environment Variables** اضافه کن:
   ```
   NEXT_PUBLIC_API_URL = https://sustindex-backend.onrender.com
   NODE_ENV = production
   ```

5. کلیک کن: **Create Web Service**
6. صبر کن تا deploy بشه (5-10 دقیقه)

---

## مرحله 4️⃣: تنظیمات نهایی (5 دقیقه)

### 4.1 به‌روزرسانی CORS در Backend

1. برو به Backend service
2. کلیک کن: **Environment**
3. یک متغیر جدید اضافه کن:
   ```
   CORS_ALLOWED_ORIGINS = https://sustindex-frontend.onrender.com
   ```
4. کلیک کن: **Save Changes**
5. Backend خودکار restart می‌شه

### 4.2 تست سایت

1. برو به: `https://sustindex-frontend.onrender.com`
2. کلیک کن: **Sign In**
3. لاگین کن با: `admin` / `admin123`
4. اگر کار کرد، تمام! 🎉

### 4.3 Admin Panel

برو به: `https://sustindex-backend.onrender.com/en/admin/`
- Username: `admin`
- Password: `admin123`

---

## 💰 هزینه کل

| سرویس | Plan | قیمت/ماه |
|-------|------|----------|
| PostgreSQL | Starter | $7 |
| Backend | Starter | $7 |
| Frontend | Starter | $7 |
| **جمع** | | **$21** |

### نکته: Free Plan
می‌تونی برای تست از Free plan استفاده کنی، ولی:
- بعد از 15 دقیقه بی‌فعالیت خاموش می‌شه
- اولین بار که کسی میاد سایت، 30-60 ثانیه طول می‌کشه تا روشن بشه
- برای production مناسب نیست

---

## ❓ مشکلات رایج

### Backend deploy نمی‌شه
- چک کن: `requirements.txt` کامل باشه
- چک کن: `DATABASE_URL` درست وارد شده
- لاگ‌ها رو ببین: **Logs** tab

### Frontend به Backend وصل نمی‌شه
- چک کن: `NEXT_PUBLIC_API_URL` درست باشه
- چک کن: CORS تنظیم شده باشه
- چک کن: Backend در حال اجراست

### Static files نمایش داده نمی‌شن
- چک کن: `collectstatic` در build.sh اجرا شده
- چک کن: Whitenoise نصب باشه

---

## 🔄 به‌روزرسانی سایت

وقتی کد رو تغییر دادی:
1. `git add -A`
2. `git commit -m "توضیحات تغییرات"`
3. `git push origin main`
4. Render خودکار deploy می‌کنه! (Auto-deploy)

---

## 📞 پشتیبانی

- Render Docs: https://render.com/docs
- Community: https://community.render.com

---

موفق باشید! 🚀
