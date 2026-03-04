from django.apps import AppConfig


class QuestionnaireConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'questionnaire'
    
    def ready(self):
        """Import signals when app is ready"""
        import questionnaire.signals
