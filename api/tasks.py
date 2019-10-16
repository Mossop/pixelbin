from celery import shared_task
from django.db import transaction

from .models import Media

@shared_task
@transaction.atomic
def process_media(media_id):
    try:
        media = Media.objects.get(id=media_id)
        media.process()
        media.save()
    except Media.DoesNotExist:
        pass
