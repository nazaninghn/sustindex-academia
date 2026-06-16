"""
URL configuration for sustindex project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns
from django.views.generic import TemplateView, RedirectView
from django.http import JsonResponse

def api_root(request):
    """API root endpoint"""
    # L3: read FRONTEND_URL from settings so staging/production URLs are
    # reflected without a code change (was hardcoded 'http://localhost:3000').
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    return JsonResponse({
        'message': 'Sustindex API Server',
        'version': '1.0',
        'status': 'running',
        'endpoints': {
            'admin': '/en/admin/',
            'api': '/api/v1/',
            'api_docs': '/api/v1/docs/',
        },
        'frontend': frontend_url,
    })


def health_check(request):
    """
    Lightweight liveness probe — no DB queries, no auth required.
    Used by the frontend login page to pre-warm the Render dyno so users
    don't experience the 30-60 s cold-start delay when they click Sign In.
    Also suitable as a Render health-check URL or UptimeRobot ping target.
    """
    return JsonResponse({'status': 'ok'}, status=200)

try:
    from questionnaire.autocomplete import CategoryAutocomplete
    AUTOCOMPLETE_AVAILABLE = CategoryAutocomplete is not None
except (ImportError, AttributeError):
    AUTOCOMPLETE_AVAILABLE = False
    CategoryAutocomplete = None

# Fix M-22: import via django.conf.settings, not directly from the settings module.
# Importing from the module creates a circular-import risk and bypasses Django's
# settings loading machinery (lazy settings, env overrides, test settings).
# Fix CRIT-01: fall back to checking INSTALLED_APPS when REST_FRAMEWORK_INSTALLED is
# not explicitly set (the default was False which silently disabled all API routes).
from django.conf import settings as _settings
_rf_explicit = getattr(_settings, 'REST_FRAMEWORK_INSTALLED', None)
REST_FRAMEWORK_INSTALLED = (
    _rf_explicit
    if _rf_explicit is not None
    else 'rest_framework' in getattr(_settings, 'INSTALLED_APPS', [])
)

# Admin panel settings
admin.site.site_header = "Sustindex Admin Panel"
admin.site.site_title = "Sustindex Admin"
admin.site.index_title = "Welcome to Sustindex Admin"

# URLs without language prefix
urlpatterns = [
    path('', api_root, name='api-root'),          # Root endpoint
    path('health/', health_check, name='health'),  # Liveness probe / wakeup ping
    path('admin/', RedirectView.as_view(url='/en/admin/', permanent=False)),  # Redirect to admin with language
    path('i18n/', include('django.conf.urls.i18n')),
]

# Add API routes only if REST framework is installed
if REST_FRAMEWORK_INSTALLED:
    urlpatterns.append(path('api/v1/', include('api_urls')))

# Add autocomplete URL only if available
if AUTOCOMPLETE_AVAILABLE:
    from django.contrib.auth.decorators import login_required
    urlpatterns.append(
        # Fix BH-3: CategoryAutocomplete is unauthenticated by default in DAL;
        # wrap with login_required so category names are not leaked to anonymous visitors.
        path('autocomplete/category/', login_required(CategoryAutocomplete.as_view()), name='category-autocomplete')
    )

# URLs with language prefix (Only Admin and API - Frontend is Next.js)
urlpatterns += i18n_patterns(
    path('admin/', admin.site.urls),
    # Old template-based URLs are disabled - Use Next.js frontend at localhost:3000
    # path('', TemplateView.as_view(template_name='home.html'), name='home'),
    # path('accounts/', include('accounts.urls')),
    # path('questionnaire/', include('questionnaire.urls')),
    # path('elearning/', include('elearning.urls')),
    # path('reports/', include('reports.urls')),
)

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# ── Media file serving ────────────────────────────────────────────────────────
#
# SECURITY NOTE (C-1):
#   In development (DEBUG=True) Django serves /media/ files directly.
#   In production (DEBUG=False) raw /media/ URLs return 404 — all file access
#   must go through authenticated API endpoints:
#
#     • User documents  →  /api/v1/documents/{id}/download/
#     • Question files  →  /api/v1/questions/{id}/attachment/
#
# PRODUCTION TODO: migrate file storage to Cloudinary / AWS S3 and replace
# both download views with signed URL redirects.  This removes the need for
# Django to stream files at all and eliminates the security exposure entirely.
#
# Render note: Render does NOT put nginx in front of gunicorn, so we cannot
# delegate /media/ to a reverse-proxy in the current stack — the authenticated
# API views above are the secure alternative until object storage is wired up.

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
