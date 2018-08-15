from django.http import HttpResponse
from django.template import loader

def index(request):
    template = loader.get_template('app/index.html')
    context = {
        "authenticated": request.user.is_authenticated
    }
    if request.user.is_authenticated:
        context['email'] = request.user.email
        context['full_name'] = request.user.full_name
    return HttpResponse(template.render(context, request))
