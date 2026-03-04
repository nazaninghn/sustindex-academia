#!/usr/bin/env python
"""
Interactive script to add questions to the questionnaire
Usage: python add_question_interactive.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from questionnaire.models import Survey, Category, Question, Choice


def list_surveys():
    """List all available surveys"""
    surveys = Survey.objects.all()
    print("\n" + "="*60)
    print("Available Surveys:")
    print("="*60)
    for survey in surveys:
        status = "✓ Active" if survey.is_active else "✗ Inactive"
        print(f"{survey.id}. {survey.name} ({status})")
        print(f"   Questions: {survey.get_total_questions()}")
    print("="*60)
    return surveys


def list_categories():
    """List all available categories"""
    categories = Category.objects.all().order_by('order')
    print("\n" + "="*60)
    print("Available Categories:")
    print("="*60)
    for cat in categories:
        print(f"{cat.id}. {cat.name} (Order: {cat.order})")
        print(f"   Weights - E: {cat.environmental_weight}, S: {cat.social_weight}, G: {cat.governance_weight}")
        print(f"   Questions: {cat.questions.filter(is_active=True).count()}")
    print("="*60)
    return categories


def add_question():
    """Interactive function to add a new question"""
    print("\n" + "="*60)
    print("ADD NEW QUESTION")
    print("="*60)
    
    # Select survey
    surveys = list_surveys()
    if not surveys:
        print("❌ No surveys found! Please create a survey first.")
        return
    
    survey_id = input("\nEnter Survey ID: ").strip()
    try:
        survey = Survey.objects.get(id=survey_id)
        print(f"✓ Selected Survey: {survey.name}")
    except Survey.DoesNotExist:
        print("❌ Survey not found!")
        return
    
    # Select category
    categories = list_categories()
    if not categories:
        print("❌ No categories found! Please create a category first.")
        return
    
    category_id = input("\nEnter Category ID: ").strip()
    try:
        category = Category.objects.get(id=category_id)
        print(f"✓ Selected Category: {category.name}")
    except Category.DoesNotExist:
        print("❌ Category not found!")
        return
    
    # Question details
    print("\n" + "-"*60)
    print("Question Details:")
    print("-"*60)
    
    text = input("Question Text: ").strip()
    if not text:
        print("❌ Question text cannot be empty!")
        return
    
    order = input("Display Order (default: 0): ").strip()
    order = int(order) if order else 0
    
    allow_multiple = input("Allow Multiple Choices? (y/n, default: n): ").strip().lower()
    allow_multiple = allow_multiple == 'y'
    
    is_active = input("Is Active? (y/n, default: y): ").strip().lower()
    is_active = is_active != 'n'
    
    # Create question
    question = Question.objects.create(
        survey=survey,
        category=category,
        text=text,
        order=order,
        allow_multiple=allow_multiple,
        is_active=is_active
    )
    
    print(f"\n✓ Question created successfully! (ID: {question.id})")
    
    # Add choices
    print("\n" + "-"*60)
    print("Add Choices:")
    print("-"*60)
    print("Enter choices one by one. Type 'done' when finished.")
    
    choice_order = 0
    while True:
        print(f"\nChoice #{choice_order + 1}:")
        choice_text = input("  Text (or 'done' to finish): ").strip()
        
        if choice_text.lower() == 'done':
            break
        
        if not choice_text:
            print("  ⚠ Choice text cannot be empty!")
            continue
        
        score = input("  Score: ").strip()
        try:
            score = int(score)
        except ValueError:
            print("  ⚠ Invalid score! Using 0.")
            score = 0
        
        Choice.objects.create(
            question=question,
            text=choice_text,
            score=score,
            order=choice_order
        )
        
        print(f"  ✓ Choice added!")
        choice_order += 1
    
    # Summary
    print("\n" + "="*60)
    print("QUESTION ADDED SUCCESSFULLY!")
    print("="*60)
    print(f"Survey: {survey.name}")
    print(f"Category: {category.name}")
    print(f"Question: {text}")
    print(f"Choices: {question.choices.count()}")
    print(f"Allow Multiple: {allow_multiple}")
    print(f"Active: {is_active}")
    print("="*60)


def main():
    """Main function"""
    print("\n" + "="*60)
    print("SUSTINDEX - QUESTION MANAGEMENT")
    print("="*60)
    
    while True:
        print("\nOptions:")
        print("1. Add New Question")
        print("2. List Surveys")
        print("3. List Categories")
        print("4. Exit")
        
        choice = input("\nSelect option: ").strip()
        
        if choice == '1':
            add_question()
        elif choice == '2':
            list_surveys()
        elif choice == '3':
            list_categories()
        elif choice == '4':
            print("\n👋 Goodbye!")
            break
        else:
            print("❌ Invalid option!")


if __name__ == '__main__':
    main()
