# Django Admin Panel - راهنمای استفاده

## دسترسی به Admin Panel

### URL های صحیح:
- ✅ `http://localhost:8000/en/admin/` (با language prefix)
- ✅ `http://localhost:8000/tr/admin/` (Turkish)
- ✅ `http://localhost:8000/admin/` (redirect می‌شه به /en/admin/)

### اطلاعات ورود:
```
Username: admin
Password: admin123
```

یا:
```
Username: testuser
Password: test123
```

## بخش‌های مهم Admin Panel

### 1. Surveys (نظرسنجی‌ها)
مسیر: Admin → Questionnaire → Surveys

**کارهایی که می‌تونی انجام بدی:**
- ✅ ساخت Survey جدید
- ✅ ویرایش Survey موجود
- ✅ فعال/غیرفعال کردن Survey
- ✅ کپی کردن Survey (Duplicate)
- ✅ مشاهده تعداد سوالات و Sessions

**فیلدهای مهم:**
- `Name`: نام نظرسنجی
- `Description`: توضیحات
- `Is Active`: فعال/غیرفعال
- `Allow Multiple Attempts`: اجازه تلاش مجدد
- `Show Results Immediately`: نمایش فوری نتایج

### 2. Categories (دسته‌بندی‌ها)
مسیر: Admin → Questionnaire → Categories

**کارهایی که می‌تونی انجام بدی:**
- ✅ ساخت Category جدید
- ✅ تنظیم وزن‌های ESG (Environmental, Social, Governance)
- ✅ تنظیم ترتیب نمایش
- ✅ تنظیم حداکثر امتیاز

**فیلدهای مهم:**
- `Name`: نام دسته
- `Order`: ترتیب نمایش (0, 10, 20, ...)
- `Environmental Weight`: وزن محیط زیستی (0-1)
- `Social Weight`: وزن اجتماعی (0-1)
- `Governance Weight`: وزن حکمرانی (0-1)
- `Max Score`: حداکثر امتیاز (معمولاً 100)

**نکته مهم:** مجموع وزن‌ها باید 1.0 باشد!
مثال: E=0.4, S=0.3, G=0.3

### 3. Questions (سوالات)
مسیر: Admin → Questionnaire → Questions

**کارهایی که می‌تونی انجام بدی:**
- ✅ اضافه کردن سوال جدید
- ✅ ویرایش سوال موجود
- ✅ فعال/غیرفعال کردن سوال
- ✅ کپی کردن سوال (Duplicate)
- ✅ اضافه کردن گزینه‌ها (Choices) به سوال

**فیلدهای مهم:**
- `Survey`: انتخاب نظرسنجی
- `Category`: انتخاب دسته
- `Text`: متن سوال (HTML supported)
- `Order`: ترتیب نمایش
- `Allow Multiple`: چند گزینه‌ای یا تک گزینه‌ای
- `Is Active`: فعال/غیرفعال
- `Attachment`: فایل ضمیمه (اختیاری)

**نحوه اضافه کردن سوال:**
1. روی "Add Question" کلیک کن
2. Survey و Category رو انتخاب کن
3. متن سوال رو بنویس
4. Order رو تنظیم کن (مثلاً 100, 110, 120, ...)
5. اگر می‌خوای چند گزینه‌ای باشه، "Allow Multiple" رو فعال کن
6. در قسمت "Choices" (پایین صفحه)، گزینه‌ها رو اضافه کن:
   - Text: متن گزینه
   - Score: امتیاز (0-100)
   - Order: ترتیب نمایش
7. Save کن

### 4. Choices (گزینه‌ها)
معمولاً از داخل Question اضافه می‌شن، ولی می‌تونی مستقل هم مدیریتشون کنی.

مسیر: Admin → Questionnaire → Choices

**فیلدهای مهم:**
- `Question`: سوالی که این گزینه براش هست
- `Text`: متن گزینه
- `Score`: امتیاز (0-100)
- `Order`: ترتیب نمایش

**نکات امتیازدهی:**
- بهترین پاسخ: 100
- خوب: 70-80
- متوسط: 40-60
- ضعیف: 20-30
- بدترین پاسخ: 0

### 5. Survey Sessions (دوره‌های نظرسنجی)
مسیر: Admin → Questionnaire → Survey Sessions

**کارهایی که می‌تونی انجام بدی:**
- ✅ ساخت Session جدید
- ✅ تنظیم تاریخ شروع و پایان
- ✅ فعال/غیرفعال کردن Session
- ✅ مشاهده وضعیت (Open, Upcoming, Closed)

**فیلدهای مهم:**
- `Survey`: انتخاب نظرسنجی
- `Name`: نام دوره
- `Start Date`: تاریخ شروع
- `End Date`: تاریخ پایان
- `Is Active`: فعال/غیرفعال

### 6. Questionnaire Attempts (تلاش‌های کاربران)
مسیر: Admin → Questionnaire → Questionnaire Attempts

**کارهایی که می‌تونی انجام بدی:**
- ✅ مشاهده تلاش‌های کاربران
- ✅ مشاهده پیشرفت (Progress)
- ✅ مشاهده امتیازات (E, S, G)
- ✅ مشاهده Grade (A+, A, B, ...)
- ✅ محاسبه مجدد امتیازات (Recalculate Scores)
- ✅ علامت‌گذاری به عنوان تکمیل شده

**اطلاعات نمایش داده شده:**
- User: کاربر
- Survey: نظرسنجی
- Session: دوره
- Status: وضعیت (Completed / In Progress)
- Progress: درصد پیشرفت
- Scores: امتیازات E, S, G
- Grade: نمره کلی

**Actions مفید:**
- `Recalculate scores`: محاسبه مجدد امتیازات
- `Mark as completed`: علامت‌گذاری به عنوان تکمیل شده

### 7. Answers (پاسخ‌های کاربران)
مسیر: Admin → Questionnaire → Answers

**کارهایی که می‌تونی انجام بدی:**
- ✅ مشاهده پاسخ‌های کاربران
- ✅ مشاهده گزینه‌های انتخاب شده
- ✅ مشاهده فایل‌های آپلود شده (Documents)

### 8. Users (کاربران)
مسیر: Admin → Accounts → Users

**کارهایی که می‌تونی انجام بدی:**
- ✅ ساخت کاربر جدید
- ✅ ویرایش اطلاعات کاربر
- ✅ تنظیم دسترسی‌ها (Permissions)
- ✅ فعال/غیرفعال کردن کاربر

## نکات مهم

### 1. ترتیب نمایش (Order)
از اعداد با فاصله استفاده کن تا بتونی بعداً سوال جدید بین آن‌ها اضافه کنی:
```
0, 10, 20, 30, 40, ...
```

### 2. وزن‌های Category
مجموع وزن‌ها باید 1.0 باشد:
```python
Environmental: 0.4
Social: 0.3
Governance: 0.3
Total: 1.0 ✓
```

### 3. امتیازدهی
- تک گزینه‌ای: امتیاز گزینه انتخاب شده
- چند گزینه‌ای: مجموع امتیازات گزینه‌های انتخاب شده

### 4. فعال/غیرفعال کردن
- Survey غیرفعال → در Frontend نمایش داده نمی‌شه
- Question غیرفعال → در نظرسنجی نمایش داده نمی‌شه
- Session غیرفعال → کاربران نمی‌تونن شروع کنن

## مثال عملی: اضافه کردن یک سوال کامل

### مرحله 1: رفتن به Questions
1. به Admin Panel برو: `http://localhost:8000/en/admin/`
2. Login کن (admin/admin123)
3. روی "Questions" کلیک کن
4. روی "Add Question" کلیک کن

### مرحله 2: پر کردن فرم
```
Survey: ESG Assessment 2024
Category: Environmental
Text: Does your company have a renewable energy policy?
Order: 100
Allow Multiple: ☐ (خالی بذار برای تک گزینه‌ای)
Is Active: ☑ (تیک بزن)
```

### مرحله 3: اضافه کردن Choices
در قسمت "Choices" پایین صفحه:

**Choice 1:**
```
Text: Yes, fully implemented with targets
Score: 100
Order: 0
```

**Choice 2:**
```
Text: Yes, but without specific targets
Score: 70
Order: 1
```

**Choice 3:**
```
Text: In development
Score: 40
Order: 2
```

**Choice 4:**
```
Text: No
Score: 0
Order: 3
```

### مرحله 4: Save
روی "Save" کلیک کن.

## Troubleshooting

### مشکل: Admin Panel باز نمی‌شه
- ✅ مطمئن شو Backend اجرا شده: `http://localhost:8000/`
- ✅ از URL صحیح استفاده کن: `http://localhost:8000/en/admin/`
- ✅ Static files رو جمع‌آوری کن: `python manage.py collectstatic`

### مشکل: سوال در Frontend نمایش داده نمی‌شه
- ✅ بررسی کن `Is Active` تیک خورده باشه
- ✅ بررسی کن Survey فعال باشه
- ✅ بررسی کن حداقل یک Choice داشته باشه

### مشکل: امتیازات اشتباه محاسبه می‌شه
- ✅ وزن‌های Category رو بررسی کن (مجموع = 1.0)
- ✅ امتیازات Choice رو بررسی کن
- ✅ در Attempts، روی "Recalculate Scores" کلیک کن

### مشکل: نمی‌تونم Login کنم
- ✅ Username: `admin` (حروف کوچک)
- ✅ Password: `admin123`
- ✅ اگر کار نکرد، superuser جدید بساز:
  ```bash
  python manage.py createsuperuser
  ```

## دستورات مفید Terminal

### ساخت Superuser جدید
```bash
python manage.py createsuperuser
```

### جمع‌آوری Static Files
```bash
python manage.py collectstatic --noinput
```

### مشاهده لیست کاربران
```bash
python manage.py shell -c "from accounts.models import User; [print(f'{u.username} - {u.email}') for u in User.objects.all()]"
```

### Reset Password یک کاربر
```bash
python manage.py shell
```
```python
from accounts.models import User
user = User.objects.get(username='admin')
user.set_password('newpassword123')
user.save()
```

## نتیجه‌گیری

Admin Panel ابزار قدرتمندی برای مدیریت سوالات، کاربران و نتایج است. برای شروع:

1. به `http://localhost:8000/en/admin/` برو
2. با `admin/admin123` login کن
3. از بخش Questions شروع کن
4. سوال جدید اضافه کن
5. Choices رو اضافه کن
6. Save کن و در Frontend تست کن

موفق باشی! 🚀
