import importlib

AUTH_USER_MODEL = 'api.User'

SILENCED_SYSTEM_CHECKS = ["models.W027"]

INSTALLED_APPS = [
    'rest_framework',
    'django_mysql',
    'api',
    'app',
]

if importlib.util.find_spec("django_extensions") is not None:
    INSTALLED_APPS.insert(0, 'django_extensions')
