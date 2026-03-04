#!/usr/bin/env python
"""
Auto-translate ALL existing content using Google Translate
"""

import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from questionnaire.models import Survey, Category, Question, Choice
from deep_translator import GoogleTranslator

def translate_text(text, source='en', target='tr'):
    """Translate text using Google Translate"""
    try:
        # Remove HTML tags for translation
        clean_text = re.sub('<[^<]+?>', '', text).strip()
        
        if not clean_text or len(clean_text) < 2:
            return None
        
        translator = GoogleTranslator(source=source, target=target)
        translated = translator.translate(clean_text)
        
        # If original had HTML tags, wrap translation in same tags
        if text.startswith('<p>') and text.endswith('</p>'):
            return f'<p>{translated}</p>'
        
        return translated
    except Exception as e:
        print(f"   ⚠️  Translation failed: {e}")
        return None

def auto_translate_all():
    """Auto-translate all content"""
    
    print("\n" + "="*60)
    print("Auto-Translating ALL Content (English → Turkish)")
    print("="*60)
    
    # Translate Surveys
    print("\n=== Translating Surveys ===")
    surveys = Survey.objects.all()
    for survey in surveys:
        print(f"\nSurvey: {survey.name}")
        
        if not survey.name_tr or survey.name_tr == survey.name_en:
            print("  🔄 Translating name...")
            translated = translate_text(survey.name_en or survey.name, source='en', target='tr')
            if translated:
                survey.name_tr = translated
                print(f"  ✅ {translated}")
        
        if not survey.description_tr or survey.description_tr == survey.description_en:
            if survey.description_en or survey.description:
                print("  🔄 Translating description...")
                translated = translate_text(survey.description_en or survey.description, source='en', target='tr')
                if translated:
                    survey.description_tr = translated
                    print(f"  ✅ {translated[:50]}...")
        
        survey.save()
    
    # Translate Categories
    print("\n=== Translating Categories ===")
    categories = Category.objects.all()
    for category in categories:
        print(f"\nCategory: {category.name}")
        
        if not category.name_tr or category.name_tr == category.name_en:
            print("  🔄 Translating name...")
            translated = translate_text(category.name_en or category.name, source='en', target='tr')
            if translated:
                category.name_tr = translated
                print(f"  ✅ {translated}")
        
        if not category.description_tr or category.description_tr == category.description_en:
            if category.description_en or category.description:
                print("  🔄 Translating description...")
                translated = translate_text(category.description_en or category.description, source='en', target='tr')
                if translated:
                    category.description_tr = translated
                    print(f"  ✅ {translated[:50]}...")
        
        category.save()
    
    # Translate Questions
    print("\n=== Translating Questions ===")
    questions = Question.objects.all()
    for i, question in enumerate(questions, 1):
        clean_text = re.sub('<[^<]+?>', '', question.text).strip()
        print(f"\n{i}. {clean_text[:60]}...")
        
        if not question.text_tr or question.text_tr == question.text_en:
            print("  🔄 Translating...")
            translated = translate_text(question.text_en or question.text, source='en', target='tr')
            if translated:
                question.text_tr = translated
                clean_tr = re.sub('<[^<]+?>', '', translated).strip()
                print(f"  ✅ {clean_tr[:60]}...")
                question.save()
    
    # Translate Choices
    print("\n=== Translating Choices ===")
    choices = Choice.objects.all()
    translated_count = 0
    
    for i, choice in enumerate(choices, 1):
        if not choice.text_tr or choice.text_tr == choice.text_en:
            print(f"{i}. {choice.text[:40]}... ", end='')
            translated = translate_text(choice.text_en or choice.text, source='en', target='tr')
            if translated:
                choice.text_tr = translated
                choice.save()
                print(f"→ {translated[:40]}...")
                translated_count += 1
            else:
                print("❌")
    
    print("\n" + "="*60)
    print("✅ Auto-Translation Completed!")
    print("="*60)
    print(f"\nSummary:")
    print(f"  Surveys: {surveys.count()}")
    print(f"  Categories: {categories.count()}")
    print(f"  Questions: {questions.count()}")
    print(f"  Choices: {choices.count()} ({translated_count} newly translated)")
    print("\n✨ All content is now bilingual!")

if __name__ == '__main__':
    try:
        auto_translate_all()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
