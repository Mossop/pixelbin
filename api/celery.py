import os

from celery import Celery, shared_task

from base.config import TEST_MODE

# set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'base.settings')

APP = Celery('pixelbin', broker='redis://redis:6379/0')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
APP.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
APP.autodiscover_tasks()

def task(func):
    instance = shared_task(func)

    def call_task(*args, **kwargs):
        if TEST_MODE:
            return instance.apply(args, kwargs)
        else:
            return instance.apply_async(args, kwargs)

    return call_task
