import os
import json
import logging

from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.http.response import HttpResponse
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
    SearchSerializer, ThumbnailRequestSerializer
from .tasks import process_media

logger = logging.getLogger(__name__)
from pprint import pformat

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
    catalog = serializer.validated_data['catalog']
    query_group = serializer.create(serializer.validated_data)

    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    media = None
    logger.debug(pformat(query_group))
    query = query_group.get_query()
    if isinstance(query, bool):
        if not query:
            media = []
        else:
            media = models.Media.objects.filter(catalog=catalog)
    else:
        media = models.Media.objects.filter(query, catalog=catalog)

    serializer = MediaSerializer(media, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def thumbnail(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = ThumbnailRequestSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    media = serializer.validated_data['media']
    size = serializer.validated_data['size']

    image = media.thumbnail(size)
    response = HttpResponse(content_type='image/jpeg')
    response.tell()
    image.save(response, 'jpeg', quality=90)

    return response
