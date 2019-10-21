import importlib

AUTH_USER_MODEL = 'api.User'

INSTALLED_APPS = [
    'rest_framework',
    'api',
    'app',
]

if importlib.util.find_spec("django_extensions") is not None:
    INSTALLED_APPS.insert(0, 'django_extensions')
