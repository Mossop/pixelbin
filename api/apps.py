from django.apps import AppConfig

from base.signals import wsgi_startup

# pylint: disable=unused-argument
def startup(sender, **kwargs):
    # pylint: disable=import-outside-toplevel
    from .models import Media
    from .tasks import PROCESS_VERSION, process_new_file, process_metadata

    for media in Media.objects.exclude(process_version=PROCESS_VERSION).filter(new_file=False):
        process_metadata.delay(media.id)

    for media in Media.objects.filter(new_file=True):
        process_new_file.delay(media.id)

class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        wsgi_startup.connect(startup)
