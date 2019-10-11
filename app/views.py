from django.http import HttpResponse
from django.template import loader
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings

from api.serializers import serialize_state
from base.utils import config

@ensure_csrf_cookie
def index(request):
    template = loader.get_template('app/index.html')
    context = {
        "config": {
            "debug": settings.DEBUG,
        },
        "state": serialize_state(request),
        "paths": {
            "static": settings.STATIC_URL,
        },
        "keys": {
            "MAPS": config.get('keys', 'maps'),
        },
    }
    return HttpResponse(template.render(context, request))
