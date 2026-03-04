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
    return JsonResponse({
        'message': 'Sustindex API Server',
        'version': '1.0',
        'status': 'running',
        'endpoints': {
            'admin': '/en/admin/',
            'api': '/api/v1/',
            'api_docs': '/api/v1/docs/',
        },
        'frontend': 'http://localhost:3000'
    })

try:
    from questionnaire.autocomplete import CategoryAutocomplete
    AUTOCOMPLETE_AVAILABLE = CategoryAutocomplete is not None
except (ImportError, AttributeError):
    AUTOCOMPLETE_AVAILABLE = False
    CategoryAutocomplete = None

# Check if REST framework is installed
try:
    from sustindex.settings import REST_FRAMEWORK_INSTALLED
except ImportError:
    REST_FRAMEWORK_INSTALLED = False

# Admin panel settings
admin.site.site_header = "Sustindex Admin Panel"
admin.site.site_title = "Sustindex Admin"
admin.site.index_title = "Welcome to Sustindex Admin"

# URLs without language prefix
urlpatterns = [
    path('', api_root, name='api-root'),  # Root endpoint
    path('admin/', RedirectView.as_view(url='/en/admin/', permanent=False)),  # Redirect to admin with language
    path('i18n/', include('django.conf.urls.i18n')),
]

# Add API routes only if REST framework is installed
if REST_FRAMEWORK_INSTALLED:
    urlpatterns.append(path('api/v1/', include('api_urls')))

# Add autocomplete URL only if available
if AUTOCOMPLETE_AVAILABLE:
    urlpatterns.append(
        path('autocomplete/category/', CategoryAutocomplete.as_view(), name='category-autocomplete')
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
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
