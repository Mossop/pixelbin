from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseForbidden, FileResponse
from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.contrib.auth.decorators import login_required
from django.db import transaction
from datetime import datetime
import filetype
from PIL import Image

from . import models
from .utils import *

def has_all_fields(dictionary, fields):
    for field in fields:
        if field not in dictionary:
            return False
    return True

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
@transaction.atomic
def upload(request):
    if request.method == 'POST' and 'file' in request.FILES and has_all_fields(request.POST, ['tags', 'date', 'height', 'width']):
        # filetype only considers the first 261 bytes of a file
        header = next(request.FILES['file'].chunks(261))
        mimetype = filetype.guess_mime(header)
        if mimetype is None:
            return HttpResponseBadRequest('<h1>Unknown file type</h1>')
        elif not (mimetype.startswith('image/') or mimetype.startswith('video/')):
            return HttpResponseBadRequest('<h1>Unsupported file type "%s"</h1>' % mimetype)

        taken = datetime.fromisoformat(request.POST['date'])
        media = models.Media(owner=request.user, file=request.FILES['file'], taken=taken,
                             mimetype=mimetype, width=request.POST['width'], height=request.POST['height'])
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

@login_required(login_url='/login')
def untagged(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = models.Media.objects.filter(owner=request.user, tags=None)

    return JsonResponse({
        "media": [m.asJS() for m in media]
    })

@login_required(login_url='/login')
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

@login_required(login_url='/login')
def metadata(request, id):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = models.Media.objects.get(id=id, owner=request.user)
    return JsonResponse(media.asJS())

@login_required(login_url='/login')
def download(request, id):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = models.Media.objects.get(id=id, owner=request.user)
    return FileResponse(media.file)
