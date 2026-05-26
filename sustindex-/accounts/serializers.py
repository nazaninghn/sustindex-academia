from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CompanyProfile, MembershipHistory

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'membership_type', 'company_name', 'phone', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 
                  'first_name', 'last_name', 'company_name', 'phone']
    
    def validate_email(self, value):
        # Fix F: Django's AbstractUser doesn't enforce unique emails — do it here.
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class CompanyProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = CompanyProfile
        # Fix HIGH: explicit field list instead of '__all__' so new model fields
        # (e.g. additional_data, logo) are not accidentally exposed without review.
        fields = [
            'id', 'user', 'company_name', 'registration_number',
            'address', 'website', 'industry', 'employee_count',
        ]


class MembershipHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipHistory
        fields = '__all__'
