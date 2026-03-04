import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from questionnaire.models import Survey, Category, Question, Choice

print('🚀 Creating sample ESG survey...\n')

# Create Survey
survey, created = Survey.objects.get_or_create(
    name='ESG Assessment 2024',
    defaults={
        'description': 'Comprehensive Environmental, Social, and Governance assessment',
        'is_active': True,
        'allow_multiple_attempts': True,
        'show_results_immediately': True,
    }
)
print(f'✅ Survey: {survey.name}')

# Create Categories
categories_data = [
    {
        'name': 'Environmental',
        'description': 'Environmental sustainability practices',
        'order': 1,
        'environmental_weight': 1.0,
        'social_weight': 0.0,
        'governance_weight': 0.0,
        'max_score': 100
    },
    {
        'name': 'Social',
        'description': 'Social responsibility and employee welfare',
        'order': 2,
        'environmental_weight': 0.0,
        'social_weight': 1.0,
        'governance_weight': 0.0,
        'max_score': 100
    },
    {
        'name': 'Governance',
        'description': 'Corporate governance and ethics',
        'order': 3,
        'environmental_weight': 0.0,
        'social_weight': 0.0,
        'governance_weight': 1.0,
        'max_score': 100
    }
]

categories = {}
for cat_data in categories_data:
    cat, created = Category.objects.get_or_create(
        name=cat_data['name'],
        defaults=cat_data
    )
    categories[cat_data['name']] = cat
    print(f'✅ Category: {cat.name}')

# Create Questions
questions_data = [
    # Environmental Questions
    {
        'category': 'Environmental',
        'text': 'Does your organization have a carbon emission reduction strategy?',
        'order': 1,
        'choices': [
            {'text': 'Yes, with clear targets and regular monitoring', 'score': 25},
            {'text': 'Yes, but without specific targets', 'score': 15},
            {'text': 'Planning to implement', 'score': 5},
            {'text': 'No', 'score': 0},
        ]
    },
    {
        'category': 'Environmental',
        'text': 'What percentage of your energy comes from renewable sources?',
        'order': 2,
        'choices': [
            {'text': 'More than 75%', 'score': 25},
            {'text': '50-75%', 'score': 20},
            {'text': '25-50%', 'score': 10},
            {'text': 'Less than 25%', 'score': 5},
            {'text': 'None', 'score': 0},
        ]
    },
    {
        'category': 'Environmental',
        'text': 'Does your organization have a waste management and recycling program?',
        'order': 3,
        'choices': [
            {'text': 'Comprehensive program with zero-waste goals', 'score': 25},
            {'text': 'Active recycling program', 'score': 15},
            {'text': 'Basic waste separation', 'score': 8},
            {'text': 'No formal program', 'score': 0},
        ]
    },
    {
        'category': 'Environmental',
        'text': 'How does your organization manage water resources?',
        'order': 4,
        'choices': [
            {'text': 'Advanced water conservation and recycling systems', 'score': 25},
            {'text': 'Water-saving measures in place', 'score': 15},
            {'text': 'Monitoring water usage', 'score': 8},
            {'text': 'No specific measures', 'score': 0},
        ]
    },
    
    # Social Questions
    {
        'category': 'Social',
        'text': 'Does your organization provide equal opportunities regardless of gender, race, or background?',
        'order': 1,
        'choices': [
            {'text': 'Yes, with documented policies and regular audits', 'score': 25},
            {'text': 'Yes, with written policies', 'score': 15},
            {'text': 'Informal commitment', 'score': 5},
            {'text': 'No formal policy', 'score': 0},
        ]
    },
    {
        'category': 'Social',
        'text': 'What employee development programs does your organization offer?',
        'order': 2,
        'choices': [
            {'text': 'Comprehensive training, mentorship, and career development', 'score': 25},
            {'text': 'Regular training programs', 'score': 15},
            {'text': 'Occasional training opportunities', 'score': 8},
            {'text': 'No formal programs', 'score': 0},
        ]
    },
    {
        'category': 'Social',
        'text': 'How does your organization ensure workplace health and safety?',
        'order': 3,
        'choices': [
            {'text': 'Certified safety management system with regular audits', 'score': 25},
            {'text': 'Documented safety procedures and training', 'score': 15},
            {'text': 'Basic safety measures', 'score': 8},
            {'text': 'Minimal safety provisions', 'score': 0},
        ]
    },
    {
        'category': 'Social',
        'text': 'Does your organization engage in community development initiatives?',
        'order': 4,
        'choices': [
            {'text': 'Active programs with measurable community impact', 'score': 25},
            {'text': 'Regular community engagement', 'score': 15},
            {'text': 'Occasional community activities', 'score': 8},
            {'text': 'No community programs', 'score': 0},
        ]
    },
    
    # Governance Questions
    {
        'category': 'Governance',
        'text': 'Does your organization have a code of ethics and conduct?',
        'order': 1,
        'choices': [
            {'text': 'Yes, comprehensive and regularly updated', 'score': 25},
            {'text': 'Yes, documented code of ethics', 'score': 15},
            {'text': 'Informal guidelines', 'score': 5},
            {'text': 'No formal code', 'score': 0},
        ]
    },
    {
        'category': 'Governance',
        'text': 'How transparent is your organization\'s financial reporting?',
        'order': 2,
        'choices': [
            {'text': 'Fully transparent with independent audits', 'score': 25},
            {'text': 'Regular financial reports', 'score': 15},
            {'text': 'Basic financial disclosure', 'score': 8},
            {'text': 'Limited transparency', 'score': 0},
        ]
    },
    {
        'category': 'Governance',
        'text': 'Does your organization have anti-corruption policies?',
        'order': 3,
        'choices': [
            {'text': 'Comprehensive policies with whistleblower protection', 'score': 25},
            {'text': 'Written anti-corruption policies', 'score': 15},
            {'text': 'Basic guidelines', 'score': 8},
            {'text': 'No formal policies', 'score': 0},
        ]
    },
    {
        'category': 'Governance',
        'text': 'How diverse is your organization\'s leadership?',
        'order': 4,
        'choices': [
            {'text': 'Highly diverse with inclusion targets', 'score': 25},
            {'text': 'Moderately diverse leadership', 'score': 15},
            {'text': 'Limited diversity', 'score': 8},
            {'text': 'No diversity focus', 'score': 0},
        ]
    },
]

print('\n📝 Creating questions and choices...')
for q_data in questions_data:
    question, created = Question.objects.get_or_create(
        survey=survey,
        category=categories[q_data['category']],
        text=q_data['text'],
        defaults={
            'order': q_data['order'],
            'is_active': True,
            'allow_multiple': False,
        }
    )
    
    if created:
        for choice_data in q_data['choices']:
            Choice.objects.create(
                question=question,
                text=choice_data['text'],
                score=choice_data['score'],
                order=q_data['choices'].index(choice_data) + 1
            )
        print(f'   ✅ {question.text[:60]}...')

print('\n' + '='*50)
print('✅ Sample data created successfully!')
print('='*50)
print(f'\n📊 Summary:')
print(f'   - Survey: {Survey.objects.count()}')
print(f'   - Categories: {Category.objects.count()}')
print(f'   - Questions: {Question.objects.count()}')
print(f'   - Choices: {Choice.objects.count()}')
print('\n🌐 You can now:')
print('   1. Login to admin: http://127.0.0.1:8000/admin/')
print('   2. View API: http://127.0.0.1:8000/api/v1/')
print('   3. Access frontend: http://localhost:3000')
print('\n🔑 Admin credentials:')
print('   Username: admin')
print('   Password: admin123')
