from django.apps import AppConfig

from base.signals import wsgi_startup

# pylint: disable=unused-argument
def startup(sender, **kwargs):
    # pylint: disable=import-outside-toplevel
    from .models import Media
    from .tasks import PROCESS_VERSION, process_media
    needs_processing = Media.objects.exclude(process_version=PROCESS_VERSION)
    for media in needs_processing:
        process_media.delay(media.id)

class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        wsgi_startup.connect(startup)
