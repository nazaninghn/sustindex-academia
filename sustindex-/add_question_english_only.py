#!/usr/bin/env python
"""
Add questions in ENGLISH ONLY - Auto-translates to Turkish
Just enter English text, Turkish translation happens automatically!
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from questionnaire.models import Survey, Category, Question, Choice

def add_english_question():
    """Add a question in English - auto-translates to Turkish"""
    
    print("\n" + "="*60)
    print("Add Question (English Only - Auto-Translates to Turkish)")
    print("="*60)
    
    # Select Survey
    surveys = Survey.objects.filter(is_active=True)
    if not surveys.exists():
        print("\n❌ No active surveys found!")
        return
    
    print("\nAvailable Surveys:")
    for survey in surveys:
        print(f"  [{survey.id}] {survey.name}")
    
    survey_id = input("\nSelect Survey ID: ")
    try:
        survey = Survey.objects.get(id=survey_id)
    except Survey.DoesNotExist:
        print("❌ Invalid survey ID!")
        return
    
    # Select Category
    categories = Category.objects.filter(survey=survey)
    if not categories.exists():
        categories = Category.objects.all()
    print("\nAvailable Categories:")
    for cat in categories:
        print(f"  [{cat.id}] {cat.name}")
    
    category_id = input("\nSelect Category ID: ")
    try:
        category = Category.objects.get(id=category_id)
    except Category.DoesNotExist:
        print("❌ Invalid category ID!")
        return
    
    # Question Text (English only)
    print("\n" + "-"*60)
    print("QUESTION TEXT (English)")
    print("-"*60)
    text_en = input("Question: ").strip()
    
    if not text_en:
        print("❌ Question text is required!")
        return
    
    # Allow multiple choices?
    allow_multiple = input("\nAllow multiple choices? (y/n) [n]: ").lower() == 'y'
    
    # Get order
    last_order = Question.objects.filter(survey=survey).count()
    order = input(f"\nDisplay order [{last_order + 1}]: ").strip()
    order = int(order) if order else last_order + 1
    
    # Create Question (signals will auto-translate)
    print("\n🔄 Creating question and auto-translating to Turkish...")
    question = Question.objects.create(
        survey=survey,
        category=category,
        text=f'<p>{text_en}</p>',
        text_en=f'<p>{text_en}</p>',
        # text_tr will be auto-filled by signal
        order=order,
        allow_multiple=allow_multiple,
        is_active=True
    )
    
    print(f"✅ Question created with ID: {question.id}")
    print(f"   English: {text_en}")
    if question.text_tr:
        import re
        clean_tr = re.sub('<[^<]+?>', '', question.text_tr).strip()
        print(f"   Turkish (auto): {clean_tr}")
    
    # Add Choices
    print("\n" + "-"*60)
    print("ADD CHOICES (English only)")
    print("-"*60)
    print("Enter choices (press Enter with empty text to finish)")
    
    choice_order = 1
    while True:
        print(f"\n--- Choice {choice_order} ---")
        choice_en = input("Choice: ").strip()
        if not choice_en:
            break
        
        score = input("Score [0]: ").strip()
        score = int(score) if score else 0
        
        # Create Choice (signals will auto-translate)
        print("🔄 Translating...")
        choice = Choice.objects.create(
            question=question,
            text=choice_en,
            text_en=choice_en,
            # text_tr will be auto-filled by signal
            score=score,
            order=choice_order
        )
        
        print(f"✅ Choice {choice_order} added")
        print(f"   English: {choice_en}")
        if choice.text_tr:
            print(f"   Turkish (auto): {choice.text_tr}")
        
        choice_order += 1
    
    print("\n" + "="*60)
    print(f"✅ Question added successfully with {choice_order - 1} choices!")
    print("="*60)
    print(f"\nQuestion ID: {question.id}")
    print(f"Survey: {survey.name}")
    print(f"Category: {category.name}")
    print(f"English: {text_en}")
    if question.text_tr:
        import re
        clean_tr = re.sub('<[^<]+?>', '', question.text_tr).strip()
        print(f"Turkish (auto-translated): {clean_tr}")
    print(f"Choices: {choice_order - 1}")
    print("\n✨ All translations were done automatically!")

if __name__ == '__main__':
    try:
        add_english_question()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
