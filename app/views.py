from django.http import HttpResponse
from django.template import loader
from django.views.decorators.csrf import ensure_csrf_cookie

from api.utils import build_state

@ensure_csrf_cookie
def index(request):
    template = loader.get_template('app/index.html')
    context = {
        "state": build_state(request)
    }
    return HttpResponse(template.render(context, request))
