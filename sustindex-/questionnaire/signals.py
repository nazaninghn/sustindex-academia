"""
Auto-translation signals for questionnaire models
Automatically translates content when saved
"""

from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Survey, Category, Question, Choice
from deep_translator import GoogleTranslator
import logging

logger = logging.getLogger(__name__)

def translate_text(text, source='en', target='tr'):
    """
    Translate text using Google Translate
    Returns None if translation fails
    """
    try:
        # Remove HTML tags for translation
        import re
        clean_text = re.sub('<[^<]+?>', '', text).strip()
        
        if not clean_text:
            return None
        
        translator = GoogleTranslator(source=source, target=target)
        translated = translator.translate(clean_text)
        
        # If original had HTML tags, wrap translation in same tags
        if text.startswith('<p>') and text.endswith('</p>'):
            return f'<p>{translated}</p>'
        
        return translated
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
        return None


@receiver(pre_save, sender=Survey)
def auto_translate_survey(sender, instance, **kwargs):
    """Auto-translate survey name and description"""
    
    # If English is provided but Turkish is missing, translate to Turkish
    if instance.name_en and not instance.name_tr:
        translated = translate_text(instance.name_en, source='en', target='tr')
        if translated:
            instance.name_tr = translated
            logger.info(f"Auto-translated survey name to Turkish: {translated}")
    
    if instance.description_en and not instance.description_tr:
        translated = translate_text(instance.description_en, source='en', target='tr')
        if translated:
            instance.description_tr = translated
            logger.info(f"Auto-translated survey description to Turkish")
    
    # If Turkish is provided but English is missing, translate to English
    if instance.name_tr and not instance.name_en:
        translated = translate_text(instance.name_tr, source='tr', target='en')
        if translated:
            instance.name_en = translated
            logger.info(f"Auto-translated survey name to English: {translated}")
    
    if instance.description_tr and not instance.description_en:
        translated = translate_text(instance.description_tr, source='tr', target='en')
        if translated:
            instance.description_en = translated
            logger.info(f"Auto-translated survey description to English")
    
    # Set default text field if empty
    if not instance.name:
        instance.name = instance.name_en or instance.name_tr
    if not instance.description:
        instance.description = instance.description_en or instance.description_tr


@receiver(pre_save, sender=Category)
def auto_translate_category(sender, instance, **kwargs):
    """Auto-translate category name and description"""
    
    # English to Turkish
    if instance.name_en and not instance.name_tr:
        translated = translate_text(instance.name_en, source='en', target='tr')
        if translated:
            instance.name_tr = translated
            logger.info(f"Auto-translated category name to Turkish: {translated}")
    
    if instance.description_en and not instance.description_tr:
        translated = translate_text(instance.description_en, source='en', target='tr')
        if translated:
            instance.description_tr = translated
    
    # Turkish to English
    if instance.name_tr and not instance.name_en:
        translated = translate_text(instance.name_tr, source='tr', target='en')
        if translated:
            instance.name_en = translated
            logger.info(f"Auto-translated category name to English: {translated}")
    
    if instance.description_tr and not instance.description_en:
        translated = translate_text(instance.description_tr, source='tr', target='en')
        if translated:
            instance.description_en = translated
    
    # Set default text field if empty
    if not instance.name:
        instance.name = instance.name_en or instance.name_tr
    if not instance.description:
        instance.description = instance.description_en or instance.description_tr


@receiver(pre_save, sender=Question)
def auto_translate_question(sender, instance, **kwargs):
    """Auto-translate question text"""
    
    # English to Turkish
    if instance.text_en and not instance.text_tr:
        translated = translate_text(instance.text_en, source='en', target='tr')
        if translated:
            instance.text_tr = translated
            logger.info(f"Auto-translated question to Turkish: {instance.id}")
    
    # Turkish to English
    if instance.text_tr and not instance.text_en:
        translated = translate_text(instance.text_tr, source='tr', target='en')
        if translated:
            instance.text_en = translated
            logger.info(f"Auto-translated question to English: {instance.id}")
    
    # Set default text field if empty
    if not instance.text:
        instance.text = instance.text_en or instance.text_tr


@receiver(pre_save, sender=Choice)
def auto_translate_choice(sender, instance, **kwargs):
    """Auto-translate choice text"""
    
    # English to Turkish
    if instance.text_en and not instance.text_tr:
        translated = translate_text(instance.text_en, source='en', target='tr')
        if translated:
            instance.text_tr = translated
            logger.info(f"Auto-translated choice to Turkish: {translated}")
    
    # Turkish to English
    if instance.text_tr and not instance.text_en:
        translated = translate_text(instance.text_tr, source='tr', target='en')
        if translated:
            instance.text_en = translated
            logger.info(f"Auto-translated choice to English: {translated}")
    
    # Set default text field if empty
    if not instance.text:
        instance.text = instance.text_en or instance.text_tr
