# Question Management Guide

این راهنما نحوه اضافه کردن، ویرایش و مدیریت سوالات در سیستم Sustindex را توضیح می‌دهد.

## روش‌های اضافه کردن سوال

### 1. Django Admin Panel (توصیه می‌شود برای کار دستی)

ساده‌ترین روش برای اضافه کردن سوال:

1. به Admin Panel بروید: http://localhost:8000/admin/
2. Login کنید (admin/admin123)
3. به بخش "Questions" بروید
4. روی "Add Question" کلیک کنید
5. فرم را پر کنید:
   - Survey: انتخاب کنید
   - Category: انتخاب کنید
   - Question Text: متن سوال
   - Order: ترتیب نمایش
   - Allow Multiple: چند گزینه‌ای یا تک گزینه‌ای
   - Is Active: فعال/غیرفعال
6. در قسمت Choices، گزینه‌ها را اضافه کنید
7. Save کنید

**مزایا:**
- رابط کاربری گرافیکی
- ویرایش آسان
- مشاهده فوری تغییرات
- مناسب برای تست و کار دستی

### 2. اسکریپت Interactive (add_question_interactive.py)

برای اضافه کردن سوال از طریق Terminal:

```bash
cd sustindex-academia/sustindex-
python add_question_interactive.py
```

این اسکریپت به صورت تعاملی از شما می‌پرسد:
- کدام Survey؟
- کدام Category؟
- متن سوال؟
- ترتیب نمایش؟
- چند گزینه‌ای یا تک گزینه‌ای؟
- گزینه‌ها و امتیازات؟

**مزایا:**
- سریع و راحت
- نیاز به کد نویسی ندارد
- مناسب برای اضافه کردن چند سوال

### 3. اسکریپت Simple (add_question_simple.py)

برای اضافه کردن دسته‌جمعی سوالات:

1. فایل `add_question_simple.py` را باز کنید
2. لیست `QUESTIONS` را ویرایش کنید:

```python
QUESTIONS = [
    {
        'survey_id': 1,
        'category_id': 1,
        'text': 'متن سوال شما',
        'order': 100,
        'allow_multiple': False,
        'is_active': True,
        'choices': [
            {'text': 'گزینه 1', 'score': 100, 'order': 0},
            {'text': 'گزینه 2', 'score': 50, 'order': 1},
            {'text': 'گزینه 3', 'score': 0, 'order': 2},
        ]
    },
    # سوالات بیشتر...
]
```

3. اجرا کنید:

```bash
python add_question_simple.py
```

**مزایا:**
- اضافه کردن دسته‌جمعی
- قابل استفاده مجدد
- مناسب برای import داده‌های زیاد

### 4. Django Shell

برای کار پیشرفته و برنامه‌نویسی:

```bash
python manage.py shell
```

```python
from questionnaire.models import Survey, Category, Question, Choice

# دریافت Survey و Category
survey = Survey.objects.get(id=1)
category = Category.objects.get(id=1)

# ساخت سوال
question = Question.objects.create(
    survey=survey,
    category=category,
    text='آیا شرکت شما سیاست محیط زیستی دارد؟',
    order=100,
    allow_multiple=False,
    is_active=True
)

# اضافه کردن گزینه‌ها
Choice.objects.create(
    question=question,
    text='بله، کاملاً پیاده‌سازی شده',
    score=100,
    order=0
)

Choice.objects.create(
    question=question,
    text='بله، اما ناقص',
    score=70,
    order=1
)

Choice.objects.create(
    question=question,
    text='خیر',
    score=0,
    order=2
)
```

**مزایا:**
- کنترل کامل
- مناسب برای عملیات پیچیده
- قابلیت اتوماسیون

### 5. API (برای Frontend یا External Apps)

اگر می‌خواهید از Frontend یا برنامه خارجی سوال اضافه کنید، باید API endpoint اضافه کنید.

## ساختار داده‌ها

### Survey (نظرسنجی)
- `name`: نام نظرسنجی
- `description`: توضیحات
- `is_active`: فعال/غیرفعال
- `allow_multiple_attempts`: اجازه تلاش مجدد
- `show_results_immediately`: نمایش فوری نتایج

### Category (دسته‌بندی)
- `name`: نام دسته
- `order`: ترتیب نمایش
- `environmental_weight`: وزن محیط زیستی (0-1)
- `social_weight`: وزن اجتماعی (0-1)
- `governance_weight`: وزن حکمرانی (0-1)
- `max_score`: حداکثر امتیاز (معمولاً 100)

### Question (سوال)
- `survey`: ارجاع به Survey
- `category`: ارجاع به Category
- `text`: متن سوال (HTML supported)
- `order`: ترتیب نمایش
- `allow_multiple`: چند گزینه‌ای؟
- `is_active`: فعال/غیرفعال
- `attachment`: فایل ضمیمه (اختیاری)

### Choice (گزینه)
- `question`: ارجاع به Question
- `text`: متن گزینه
- `score`: امتیاز (0-100)
- `order`: ترتیب نمایش

## نکات مهم

### امتیازدهی
- امتیازات معمولاً بین 0 تا 100 هستند
- بهترین پاسخ: 100
- بدترین پاسخ: 0
- پاسخ‌های میانی: 25, 50, 75

### وزن‌های Category
- مجموع وزن‌ها باید 1.0 باشد
- مثال: E=0.4, S=0.3, G=0.3
- یا: E=0.5, S=0.3, G=0.2

### ترتیب نمایش (Order)
- از اعداد 0, 10, 20, 30, ... استفاده کنید
- فاصله بگذارید برای اضافه کردن سوالات جدید بین آن‌ها

### سوالات چند گزینه‌ای
- `allow_multiple=True` برای سوالاتی که کاربر می‌تواند چند گزینه انتخاب کند
- امتیاز نهایی = مجموع امتیازات گزینه‌های انتخاب شده

## مثال‌های کاربردی

### مثال 1: سوال ساده تک گزینه‌ای

```python
question = Question.objects.create(
    survey_id=1,
    category_id=1,
    text='آیا شرکت شما گزارش پایداری منتشر می‌کند؟',
    order=10,
    allow_multiple=False,
    is_active=True
)

choices = [
    ('بله، سالانه', 100),
    ('بله، هر دو سال یکبار', 70),
    ('در حال آماده‌سازی', 40),
    ('خیر', 0),
]

for idx, (text, score) in enumerate(choices):
    Choice.objects.create(
        question=question,
        text=text,
        score=score,
        order=idx
    )
```

### مثال 2: سوال چند گزینه‌ای

```python
question = Question.objects.create(
    survey_id=1,
    category_id=2,
    text='کدام برنامه‌های آموزشی را برای کارکنان ارائه می‌دهید؟',
    order=20,
    allow_multiple=True,  # چند گزینه‌ای
    is_active=True
)

choices = [
    ('آموزش ایمنی', 25),
    ('آموزش تنوع و شمول', 25),
    ('توسعه مهارت‌های حرفه‌ای', 25),
    ('آموزش پایداری', 25),
]

for idx, (text, score) in enumerate(choices):
    Choice.objects.create(
        question=question,
        text=text,
        score=score,
        order=idx
    )
```

## مشاهده داده‌های موجود

### لیست Surveys

```bash
python manage.py shell
```

```python
from questionnaire.models import Survey
for s in Survey.objects.all():
    print(f"{s.id}. {s.name} - {s.get_total_questions()} questions")
```

### لیست Categories

```python
from questionnaire.models import Category
for c in Category.objects.all():
    print(f"{c.id}. {c.name} (E:{c.environmental_weight}, S:{c.social_weight}, G:{c.governance_weight})")
```

### لیست Questions یک Survey

```python
from questionnaire.models import Question
survey_id = 1
for q in Question.objects.filter(survey_id=survey_id, is_active=True):
    print(f"{q.id}. {q.category.name} - {q.text[:50]}...")
    for choice in q.choices.all():
        print(f"   - {choice.text} ({choice.score})")
```

## Troubleshooting

### خطا: Survey not found
- مطمئن شوید Survey ID صحیح است
- با `Survey.objects.all()` لیست کنید

### خطا: Category not found
- مطمئن شوید Category ID صحیح است
- با `Category.objects.all()` لیست کنید

### سوال در Frontend نمایش داده نمی‌شود
- بررسی کنید `is_active=True` باشد
- بررسی کنید Survey فعال باشد
- بررسی کنید حداقل یک Choice داشته باشد

### امتیازات اشتباه محاسبه می‌شود
- وزن‌های Category را بررسی کنید (مجموع = 1.0)
- امتیازات Choice را بررسی کنید
- در Admin Panel روی "Recalculate Scores" کلیک کنید

## دستورات مفید

```bash
# لیست همه سوالات
python manage.py shell -c "from questionnaire.models import Question; print(Question.objects.count())"

# لیست سوالات فعال
python manage.py shell -c "from questionnaire.models import Question; print(Question.objects.filter(is_active=True).count())"

# غیرفعال کردن همه سوالات یک Category
python manage.py shell -c "from questionnaire.models import Question; Question.objects.filter(category_id=1).update(is_active=False)"

# حذف همه سوالات یک Survey (احتیاط!)
python manage.py shell -c "from questionnaire.models import Question; Question.objects.filter(survey_id=1).delete()"
```

## نتیجه‌گیری

برای شروع، از **Django Admin Panel** استفاده کنید. برای اضافه کردن دسته‌جمعی، از **add_question_simple.py** استفاده کنید.
