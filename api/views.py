from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.contrib.auth.decorators import login_required
from datetime import datetime

from . import models

def login(request):
    if request.method == 'POST' and 'email' in request.POST and 'password' in request.POST:
        user = authenticate(request, username=request.POST['email'], password=request.POST['password'])
        if user is not None:
            login_user(request, user)
            data = {
                "email": user.email,
                "fullname": user.full_name,
            }
            return JsonResponse(data)
        else:
            return HttpResponseForbidden('<h1>Forbidden</h1>')
    return HttpResponseBadRequest('<h1>Bad Request</h1>')

def logout(request):
    logout_user(request)
    return HttpResponse('<h1>Logged Out</h1>')

@login_required(login_url='/')
def upload(request):
    if request.method == 'POST' and 'file' in request.FILES and 'tags' in request.POST and 'date' in request.POST:
        taken = datetime.fromisoformat(request.POST['date'])
        media = models.Media(owner=request.user, file=request.FILES['file'], taken=taken)
        media.save()

        tags = [t.strip() for t in request.POST['tags'].split(',')]
        for tag in tags:
            parts = [p.strip() for p in tag.split("/")]

            parent = None
            while len(parts) > 0:
                name = parts.pop(0)
                (parent, _) = models.Tag.objects.get_or_create(owner=request.user,
                                                               name=name,
                                                               parent=parent)

            media.tags.add(parent)
        return JsonResponse({})

    return HttpResponseBadRequest('<h1>Bad Request</h1>')
