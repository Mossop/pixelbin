from django.http import HttpResponse
from django.template import loader
from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def index(request):
    template = loader.get_template('app/index.html')
    state = {
        "user": None,
    }
    if request.user.is_authenticated:
        state["user"] = {
            "email": request.user.email,
            "fullname": request.user.full_name,
        }

    context = {
        "state": state
    }
    return HttpResponse(template.render(context, request))
