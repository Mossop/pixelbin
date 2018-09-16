import os
import sys
import shutil
import tempfile
import hashlib

from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseRedirect
from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import cache_control
from django.db import transaction
from datetime import datetime
import filetype
from PIL import Image

from . import models
from .utils import *
from .video import read_metadata, extract_poster
from .backblaze import backblaze

def has_all_fields(dictionary, fields):
    for field in fields:
        if field not in dictionary:
            return False
    return True

def login(request):
    if request.method == 'POST' and has_all_fields(request.POST, ['email', 'password']):
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
    if request.method == 'POST' and 'file' in request.FILES and has_all_fields(request.POST, ['tags', 'date']):
        # filetype only considers the first 261 bytes of a file
        header = next(request.FILES['file'].chunks(261))
        mimetype = filetype.guess_mime(header)
        if mimetype is None:
            return HttpResponseBadRequest('<h1>Unknown file type</h1>')
        elif not (mimetype.startswith('image/') or mimetype.startswith('video/')):
            return HttpResponseBadRequest('<h1>Unsupported file type "%s"</h1>' % mimetype)

        taken = datetime.fromisoformat(request.POST['date'])

        with transaction.atomic():
            media = models.Media(owner=request.user, taken=taken,
                                mimetype=mimetype, width=0, height=0)
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
            os.makedirs(media.root_path, exist_ok=True)

        try:
            (fd, temppath) = tempfile.mkstemp()
            f = os.fdopen(fd, mode="wb")
            try:
                sha = hashlib.sha1()
                for chunk in request.FILES['file'].chunks():
                    sha.update(chunk)
                    f.write(chunk)
                f.close()

                f = open(temppath, 'rb')
                media.storage_id = backblaze.upload(media.storage_path, sha.hexdigest(), f, mimetype)
                f.close()

                if mimetype.startswith('image/'):
                    im = Image.open(temppath)
                    media.width = im.width
                    media.height = im.height

                    im.thumbnail([500, 500])
                    im.save(media.preview_path, 'JPEG')
                else:
                    metadata = read_metadata(temppath)
                    media.width = metadata['width']
                    media.height = metadata['height']

                    poster_path = extract_poster(temppath)

                    try:
                        im = Image.open(poster_path)
                        im.thumbnail([500, 500])
                        im.save(media.preview_path, 'JPEG')
                    finally:
                        os.remove(poster_path)

                media.save()
            finally:
                os.remove(temppath)
        except:
            media.delete()
            raise

        return JsonResponse({
            "tags": build_tags(request),
            "media": media.asJS(),
        })

    return HttpResponseBadRequest('<h1>Bad Request</h1>')

@login_required(login_url='/login')
def delete(request):
    if request.method == 'POST' and 'id' in request.POST:
        media = models.Media.objects.get(id=request.POST['id'], owner=request.user)
        media.delete()

        return HttpResponse("OK")

@login_required(login_url='/login')
def untagged(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = models.Media.objects.filter(owner=request.user, tags=None)

    return JsonResponse({
        "media": [m.asJS() for m in media]
    })

def search_media(owner, include_tags, include_type, exclude_tags):
    # First filter down to only the media the user has access to
    media = models.Media.objects.filter(owner=owner)

    if len(include_tags) > 0:
        if include_type == 'OR':
            ids = [tag.id for tag in union([tag.descendants() for tag in include_tags])]
            media = media.filter(tags__id__in=ids)
        else:
            for tag in include_tags:
                ids = [tag.id for tag in tag.descendants()]
                media = media.filter(tags__id__in=ids)

        media = media.distinct()

    if len(exclude_tags) > 0:
        ids = [tag.id for tag in union([tag.descendants() for tag in exclude_tags])]
        media = media.exclude(tags__id__in=ids)

    return media

def shared_media(share_id):
    search = models.TagSearch.objects.get(id=share_id)
    return search_media(search.owner, search.include_tags.all(), search.include_type, search.exclude_tags.all())

@login_required(login_url='/login')
def list(request):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    include_tags = []
    if 'includeTag' in request.GET:
        include_tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('includeTag')]

    include_type = 'AND'
    if 'includeType' in request.GET and request.GET['includeType'] == 'or':
        include_type = 'OR'

    exclude_tags = []
    if 'excludeTag' in request.GET:
        exclude_tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('excludeTag')]

    media = search_media(request.user, include_tags, include_type, exclude_tags)

    return JsonResponse({
        "media": [m.asJS() for m in media]
    })

def get_media(request, id):
    if ('share' not in request.GET):
        return models.Media.objects.get(id=id, owner=request.user)
    else:
        return shared_media(request.GET['share']).filter(id=id)[0]

@cache_control(max_age=86400, private=True, immutable=True)
def thumbnail(request, id):
    if request.method != 'GET' or 'size' not in request.GET:
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    size = int(request.GET['size'])
    media = get_media(request, id)

    im = Image.open(media.preview_path)
    im.thumbnail([size, size])

    response = HttpResponse(content_type="image/jpeg")
    im.save(response, 'JPEG')
    return response

@cache_control(max_age=86400, private=True, immutable=True)
def metadata(request, id):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = get_media(request, id)
    return JsonResponse(media.asJS())

@cache_control(max_age=3600, private=True)
def download(request, id):
    if request.method != 'GET':
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = get_media(request, id)
    url = backblaze.get_download_url(media.storage_path)
    return HttpResponseRedirect(url)


@login_required(login_url='/login')
def save(request):
    if (request.method != 'POST'):
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    include_type = 'AND'
    if 'includeType' in request.POST and request.POST['includeType'] == 'or':
        include_type = 'OR'

    includeTags = []
    if 'includeTag' in request.POST:
        for id in request.POST.getlist('includeTag'):
            includeTags.append(models.Tag.objects.get(id=int(id), owner=request.user))

    excludeTags = []
    if 'excludeTag' in request.POST:
        for id in request.POST.getlist('excludeTag'):
            excludeTags.append(models.Tag.objects.get(id=int(id), owner=request.user))

    with transaction.atomic():
        search = models.TagSearch(id=uuid(), owner=request.user, name="foo", include_type=include_type)
        search.save()

        for tag in includeTags:
            search.include_tags.add(tag)
        for tag in excludeTags:
            search.exclude_tags.add(tag)

    return JsonResponse({
        "searches": build_searches(request)
    })

def share(request):
    if (request.method != 'GET' or 'id'  not in request.GET):
        return HttpResponseBadRequest('<h1>Bad Request</h1>')

    media = shared_media(request.GET['id'])

    return JsonResponse({
        "media": [m.asJS() for m in media]
    })
