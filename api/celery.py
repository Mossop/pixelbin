import os
import logging

from celery import Celery, shared_task
from celery.utils.log import get_task_logger

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
    fn_name = '%s.%s' % (func.__module__, func.__name__)

    def call_task(*args, **kwargs):
        if TEST_MODE:
            logger = logging.getLogger(fn_name)
            return instance.apply((logger, ) + args, kwargs)

        logger = get_task_logger(func.__name__)
        return instance.apply_async((logger, ) + args, kwargs)

    return call_task
