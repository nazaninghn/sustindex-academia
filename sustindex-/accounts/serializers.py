from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CompanyProfile, MembershipHistory

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'membership_type', 'company_name', 'phone', 'created_at']
        # Fix H-01: lock privilege fields so no code path (including an indirect
        # call to update()) can accidentally allow a user to escalate themselves.
        # Note: is_staff and is_superuser are intentionally NOT in `fields` so
        # they are never serialized to API clients.  They are omitted from
        # read_only_fields here because listing a field as read-only when it is
        # not in `fields` has no effect and is misleading.
        read_only_fields = ['id', 'created_at', 'membership_type']


class UserRegistrationSerializer(serializers.ModelSerializer):
    # Fix L-18: max_length=128 prevents multi-megabyte bcrypt DoS attempts.
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 
                  'first_name', 'last_name', 'company_name', 'phone']
    
    def validate_email(self, value):
        # Fix C-03: reject blank / whitespace-only emails before the uniqueness check.
        # The original `if value:` silently accepted "" and " " as valid emails,
        # letting multiple accounts share an empty email address.
        if not value or not value.strip():
            raise serializers.ValidationError("Email is required.")
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.strip().lower()

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        # Fix C-04: run Django's AUTH_PASSWORD_VALIDATORS at registration time.
        # Previously only change_password and reset_password did this, leaving
        # registration open to weak passwords like "password" or "12345678".
        # Fix R5-M-02: pass a temporary User instance so UserAttributeSimilarity-
        # Validator can compare the password against username/email.  Without a
        # user object that validator is skipped entirely.
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        temp_user = User(
            username=data.get('username', ''),
            email=data.get('email', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
        )
        try:
            validate_password(data['password'], temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
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
        # L2: explicit field list — prevents accidental exposure if new
        # sensitive fields are added to the model in the future.
        # Fix R7-15: removed `user` FK from non-staff output — get_queryset() already
        # scopes records to the requesting user, so exposing the user PK is redundant
        # for regular users and a minor privacy concern (leaks internal user IDs to
        # the frontend).  Staff can access the user via the admin interface.
        fields = ['id', 'membership_type', 'start_date', 'end_date', 'is_active']
        read_only_fields = ['id', 'start_date']
