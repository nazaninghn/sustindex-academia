import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sustindex.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Create test user
username = 'testuser'
email = 'test@example.com'
password = 'test123'

user, created = User.objects.get_or_create(
    username=username,
    defaults={
        'email': email,
        'company_name': 'Test Company',
        'phone': '+1234567890',
        'membership_type': 'free',
    }
)

if created:
    user.set_password(password)
    user.save()
    print('✅ Test user created successfully!')
else:
    user.set_password(password)
    user.save()
    print('✅ Test user password updated!')

print('\n🔑 Test User Credentials:')
print(f'   Username: {username}')
print(f'   Password: {password}')
print(f'   Email: {email}')
print('\n🔑 Admin Credentials:')
print('   Username: admin')
print('   Password: admin123')
