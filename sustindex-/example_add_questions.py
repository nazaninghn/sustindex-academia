#!/usr/bin/env python
"""
Example: How to add questions to Sustindex
این فایل یک مثال کامل از اضافه کردن سوالات است
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from questionnaire.models import Survey, Category, Question, Choice


def example_1_simple_question():
    """مثال 1: اضافه کردن یک سوال ساده"""
    print("\n" + "="*60)
    print("Example 1: Adding a Simple Question")
    print("="*60)
    
    # دریافت Survey و Category
    survey = Survey.objects.get(id=1)
    category = Category.objects.get(name='Environmental')
    
    # ساخت سوال
    question = Question.objects.create(
        survey=survey,
        category=category,
        text='Does your company measure its carbon footprint?',
        order=200,  # بعد از سوالات موجود
        allow_multiple=False,
        is_active=True
    )
    
    # اضافه کردن گزینه‌ها
    choices_data = [
        ('Yes, annually with third-party verification', 100),
        ('Yes, annually without verification', 80),
        ('Yes, but not regularly', 50),
        ('Planning to start', 25),
        ('No', 0),
    ]
    
    for idx, (text, score) in enumerate(choices_data):
        Choice.objects.create(
            question=question,
            text=text,
            score=score,
            order=idx
        )
    
    print(f"✓ Question created: {question.text}")
    print(f"✓ Added {len(choices_data)} choices")
    print(f"✓ Question ID: {question.id}")


def example_2_multiple_choice():
    """مثال 2: سوال چند گزینه‌ای"""
    print("\n" + "="*60)
    print("Example 2: Multiple Choice Question")
    print("="*60)
    
    survey = Survey.objects.get(id=1)
    category = Category.objects.get(name='Social')
    
    question = Question.objects.create(
        survey=survey,
        category=category,
        text='Which employee benefits does your company provide? (Select all that apply)',
        order=201,
        allow_multiple=True,  # چند گزینه‌ای
        is_active=True
    )
    
    choices_data = [
        ('Health insurance', 25),
        ('Retirement plan', 25),
        ('Paid parental leave', 25),
        ('Professional development budget', 25),
    ]
    
    for idx, (text, score) in enumerate(choices_data):
        Choice.objects.create(
            question=question,
            text=text,
            score=score,
            order=idx
        )
    
    print(f"✓ Multiple choice question created: {question.text}")
    print(f"✓ Users can select multiple answers")


def example_3_batch_questions():
    """مثال 3: اضافه کردن چند سوال یکجا"""
    print("\n" + "="*60)
    print("Example 3: Adding Multiple Questions at Once")
    print("="*60)
    
    survey = Survey.objects.get(id=1)
    
    questions_data = [
        {
            'category': 'Environmental',
            'text': 'What percentage of your waste is recycled?',
            'order': 202,
            'choices': [
                ('75-100%', 100),
                ('50-74%', 75),
                ('25-49%', 50),
                ('1-24%', 25),
                ('0%', 0),
            ]
        },
        {
            'category': 'Governance',
            'text': 'Does your board have independent directors?',
            'order': 203,
            'choices': [
                ('Yes, majority are independent', 100),
                ('Yes, some are independent', 70),
                ('No, but planning to add', 30),
                ('No', 0),
            ]
        },
    ]
    
    for q_data in questions_data:
        category = Category.objects.get(name=q_data['category'])
        
        question = Question.objects.create(
            survey=survey,
            category=category,
            text=q_data['text'],
            order=q_data['order'],
            allow_multiple=False,
            is_active=True
        )
        
        for idx, (text, score) in enumerate(q_data['choices']):
            Choice.objects.create(
                question=question,
                text=text,
                score=score,
                order=idx
            )
        
        print(f"✓ Added: {q_data['text'][:50]}...")
    
    print(f"\n✓ Total questions added: {len(questions_data)}")


def show_current_questions():
    """نمایش سوالات موجود"""
    print("\n" + "="*60)
    print("Current Questions in Database")
    print("="*60)
    
    survey = Survey.objects.get(id=1)
    questions = Question.objects.filter(survey=survey, is_active=True).order_by('category', 'order')
    
    current_category = None
    for q in questions:
        if q.category != current_category:
            current_category = q.category
            print(f"\n📁 {current_category.name}")
            print("-" * 60)
        
        print(f"  {q.id}. {q.text[:60]}...")
        print(f"     Choices: {q.choices.count()} | Multiple: {q.allow_multiple}")
    
    print("\n" + "="*60)
    print(f"Total: {questions.count()} questions")
    print("="*60)


if __name__ == '__main__':
    print("\n" + "="*60)
    print("SUSTINDEX - QUESTION EXAMPLES")
    print("="*60)
    
    # نمایش سوالات فعلی
    show_current_questions()
    
    # پرسیدن از کاربر
    print("\nDo you want to run the examples?")
    print("1. Example 1: Simple question")
    print("2. Example 2: Multiple choice question")
    print("3. Example 3: Batch questions")
    print("4. Run all examples")
    print("5. Exit")
    
    choice = input("\nSelect option (1-5): ").strip()
    
    if choice == '1':
        example_1_simple_question()
    elif choice == '2':
        example_2_multiple_choice()
    elif choice == '3':
        example_3_batch_questions()
    elif choice == '4':
        example_1_simple_question()
        example_2_multiple_choice()
        example_3_batch_questions()
    elif choice == '5':
        print("\n👋 Goodbye!")
    else:
        print("\n❌ Invalid option!")
    
    # نمایش سوالات نهایی
    if choice in ['1', '2', '3', '4']:
        show_current_questions()
