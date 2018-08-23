from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.contrib.auth.decorators import login_required
from datetime import datetime
from PIL import Image

from . import models
from .utils import *

def login(request):
    if request.method == 'POST' and 'email' in request.POST and 'password' in request.POST:
        user = authenticate(request, username=request.POST['email'], password=request.POST['password'])
        if user is not None:
            login_user(request, user)
            return JsonResponse(build_state(request))
        else:
            return HttpResponseForbidden('<h1>Forbidden</h1>')
    return HttpResponseBadRequest('<h1>Bad Request</h1>')

def logout(request):
    logout_user(request)
    return JsonResponse(build_state(request))

@login_required(login_url='/login')
def upload(request):
    if request.method == 'POST' and 'file' in request.FILES and 'tags' in request.POST and 'date' in request.POST:
        taken = datetime.fromisoformat(request.POST['date'])
        media = models.Media(owner=request.user, file=request.FILES['file'], taken=taken)
        if 'latitude' in request.POST and 'longitude' in request.POST:
            media.latitude = float(request.POST['latitude'])
            media.longitude = float(request.POST['longitude'])
        media.save()

        tags = [t.strip() for t in request.POST['tags'].split(',')]
        for tag in tags:
            parts = [p.strip() for p in tag.split("/")]
            if any([p == "" for p in parts]):
                continue

            parent = None
            while len(parts) > 0:
                name = parts.pop(0)
                (parent, _) = models.Tag.objects.get_or_create(owner=request.user,
                                                               name=name,
                                                               parent=parent)

            media.tags.add(parent)
        return JsonResponse({
            "tags": build_tags(request)
        })

    return HttpResponseBadRequest('<h1>Bad Request</h1>')

def list(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    # First filter down to only the media the user has access to
    media = models.Media.objects.filter(owner=request.user)

    if 'includeTag' in request.GET:
        tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('includeTag')]

        if 'includeType' in request.GET and request.GET['includeType'] == 'or':
            ids = [tag.id for tag in union([tag.descendants() for tag in tags])]
            media = media.filter(tags__id__in=ids)
        else:
            for tag in tags:
                ids = [tag.id for tag in tag.descendants()]
                media = media.filter(tags__id__in=ids)

        media = media.distinct()

    if 'excludeTag' in request.GET:
        tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('excludeTag')]
        ids = [tag.id for tag in union([tag.descendants() for tag in tags])]
        media = media.exclude(tags__id__in=ids)

    return JsonResponse({
        "media": [m.asJS() for m in media]
    })

def thumbnail(request, id):
    if request.method != 'GET' or 'size' not in request.GET:
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    size = int(request.GET['size'])
    media = models.Media.objects.get(id=id, owner=request.user)
    im = Image.open(media.file)
    im.thumbnail([size, size])

    response = HttpResponse(content_type="image/jpeg")
    im.save(response, 'JPEG')
    return response
