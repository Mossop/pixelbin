from django.http import HttpResponse
from django.template import loader
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings

from api.serializers.state import serialize_state
from api.metadata import get_js_spec
from base.utils import CONFIG

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
        "metadata": get_js_spec(),
    }
    return HttpResponse(template.render(context, request))
