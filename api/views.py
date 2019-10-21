import os
import json

from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.db import transaction
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from filetype import filetype

from . import models
from .utils import uuid
from .serializers import UploadSerializer, UserSerializer, LoginSerializer, \
    CatalogSerializer, CatalogStateSerializer, serialize_state, BackblazeSerializer, \
    ServerSerializer, MediaSerializer, CatalogEditSerializer, AlbumSerializer, \
    SearchSerializer
from .tasks import process_media

PREVIEW_SIZE = 600

@api_view()
def get_user(request):
    if request.user and request.user.is_authenticated:
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    return Response(status=status.HTTP_401_UNAUTHORIZED)

@transaction.atomic
@api_view(['PUT'])
def create_user(request):
    if request.user and request.user.is_authenticated and not request.user.is_staff:
        return Response(status=status.HTTP_403_FORBIDDEN)
    serializer = UserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    if not request.auth:
        login_user(request, user)
    return Response(serialize_state(request))

@api_view(['POST'])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(request, username=serializer.validated_data['email'],
                        password=serializer.validated_data['password'])
    if user is not None:
        login_user(request, user)
        return Response(serialize_state(request))
    return Response(status=status.HTTP_403_FORBIDDEN)

@transaction.atomic
@api_view(['PUT'])
def create_catalog(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'storage' not in request.data or 'type' not in request.data['storage']:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    serializer = CatalogSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if request.data['storage']['type'] == 'backblaze':
        storage_serializer = BackblazeSerializer(data=request.data['storage'])
        storage_serializer.is_valid(raise_exception=True)
        storage = storage_serializer.save()
        catalog = serializer.save(id=uuid('C'), backblaze=storage)
    elif request.data['storage']['type'] == 'server':
        storage_serializer = ServerSerializer(data=request.data['storage'])
        storage_serializer.is_valid(raise_exception=True)
        storage = storage_serializer.save()
        catalog = serializer.save(id=uuid('C'), server=storage)

    access = models.Access(user=request.user, catalog=catalog)
    access.save()

    request.user.had_catalog = True
    request.user.save()

    serializer = CatalogStateSerializer(catalog)
    return Response(serializer.data)

@transaction.atomic
@api_view(['POST'])
def edit_catalog(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = CatalogEditSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['catalog']

    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    catalog.name = serializer.validated_data['name']
    catalog.save()

    serializer = CatalogStateSerializer(catalog)
    return Response(serializer.data)

@transaction.atomic
@api_view(['PUT'])
def create_album(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if not request.user.can_access_catalog(serializer.validated_data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    album = serializer.save(id=uuid("A"))

    serializer = AlbumSerializer(album)
    return Response(serializer.data)

@transaction.atomic
@api_view(['POST'])
def edit_album(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        album = models.Album.objects.get(id=serializer.validated_data['id'])
        serializer.update(album, serializer.validated_data)

        serializer = AlbumSerializer(album)
        return Response(serializer.data)
    except models.Album.DoesNotExist:
        return Response(status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
def logout(request):
    logout_user(request)
    return Response(serialize_state(request))

@transaction.atomic
@api_view(['PUT'])
@parser_classes([MultiPartParser])
def upload(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'metadata' not in request.data or 'file' not in request.data:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    metadata = json.loads(request.data['metadata'])
    serializer = UploadSerializer(data=metadata)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    catalog = data['catalog']
    if not request.user.can_access_catalog(data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    file = request.data['file']
    guessed = filetype.guess(file)
    if guessed.mime[0:6] != "image/" and guessed.mime[0:6] != "video/":
        return Response(status=status.HTTP_400_BAD_REQUEST)

    tags = [models.Tag.get_from_path(catalog, p) for p in data['tags']]
    people = [models.Person.get_from_name(catalog, n) for n in data['people']]

    filename = os.path.basename(file.name)
    if filename is None or filename == "":
        filename = 'original.%s' % (guessed.extension)

    media = models.Media(id=uuid("M"), catalog=catalog, mimetype=guessed.mime,
                         orientation=data['orientation'], filename=os.path.basename(file.name),
                         storage_filename=filename)
    media.tags.add(*tags)
    media.people.add(*people)

    if 'album' in data and data['album'] is not None:
        media.albums.add(data['album'])

    temp = media.storage.get_temp_path(media.storage_filename)
    with open(temp, "wb") as output:
        for chunk in file.chunks():
            output.write(chunk)
    try:
        media.save()
    except Exception as exc:
        os.unlink(temp)
        raise exc

    process_media.delay(media.id)

    serializer = MediaSerializer(media)
    return Response(serializer.data)

@api_view(['POST'])
def search(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = SearchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    if not request.user.can_access_catalog(data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    query = models.Media.objects.filter(catalog=data['catalog'])
    serializer = MediaSerializer(query, many=True)
    return Response(serializer.data)

# -------------------------------------

# @login_required
# def delete(request):
#     if request.method == 'POST' and 'id' in request.POST:
#         media = models.Media.objects.get(id=request.POST['id'], owner=request.user)
#         media.delete()

#         return JsonResponse({})
#     return HttpResponseBadRequest('<h1>Bad Request</h1>')

# @login_required
# def untagged(request):
#     if request.method != 'GET':
#         return HttpResponseBadRequest('<h1>Bad Request</h1>')

#     media = models.Media.objects.filter(owner=request.user, tags=None)

#     return JsonResponse({
#         "media": [m.asJS() for m in media]
#     })

# @login_required
# def list(request):
#     if request.method != 'GET':
#         return HttpResponseBadRequest('<h1>Bad Request</h1>')

#     include_tags = []
#     if 'includeTag' in request.GET:
#         include_tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('includeTag')]

#     include_type = 'AND'
#     if 'includeType' in request.GET and request.GET['includeType'] == 'or':
#         include_type = 'OR'

#     exclude_tags = []
#     if 'excludeTag' in request.GET:
#         exclude_tags = [models.Tag.objects.get(id=int(id)) for id in request.GET.getlist('excludeTag')]

#     media = search_media(request.user, include_tags, include_type, exclude_tags)

#     return JsonResponse({
#         "media": [m.asJS() for m in media]
#     })

# def get_media(request, id):
#     if ('share' not in request.GET):
#         return models.Media.objects.get(id=id, owner=request.user)
#     else:
#         return shared_media(request.GET['share']).filter(id=id)[0]

# @cache_control(max_age=86400, private=True, immutable=True)
# def thumbnail(request, id):
#     if request.method != 'GET' or 'size' not in request.GET:
#         return HttpResponseBadRequest('<h1>Bad Request</h1>')

#     size = int(request.GET['size'])
#     media = get_media(request, id)

#     im = Image.open(media.preview_path)
#     im.thumbnail([size, size], Image.LANCZOS)

#     response = HttpResponse(content_type="image/png")
#     im.save(response, 'PNG')
#     return response

# @cache_control(max_age=86400, private=True, immutable=True)
# def metadata(request, id):
#     if request.method != 'GET':
#         return HttpResponseBadRequest('<h1>Bad Request</h1>')

#     media = get_media(request, id)
#     return JsonResponse(media.asJS())

# @cache_control(max_age=3600, private=True)
# def download(request, id):
#     if request.method != 'GET':
#         return HttpResponseBadRequest('<h1>Bad Request</h1>')

#     media = get_media(request, id)
#     url = backblaze.get_download_url(media.storage_path)
#     return HttpResponseRedirect(url)
