from importlib.util import find_spec

INSTALLED_APPS = [
    'rest_framework',
    'api',
    'app',
]

if find_spec("django_extensions") is not None:
    INSTALLED_APPS.insert(0, 'django_extensions')

LOGGING = {
    'loggers': {
        'app': {
            'level': 'DEBUG',
        },
        'api': {
            'level': 'DEBUG',
        },
        'celery': {
            'level': 'WARNING',
        },
    },
}
