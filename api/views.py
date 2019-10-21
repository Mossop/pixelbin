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
    ServerSerializer, MediaSerializer, AlbumSerializer, SearchSerializer, ThumbnailRequestSerializer
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

@api_view(['PUT'])
def create_catalog(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'storage' not in request.data or 'type' not in request.data['storage']:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    serializer = CatalogSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    name = serializer.validated_data['name']
    del serializer.validated_data['name']

    with transaction.atomic():
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
        root = models.Album(id=uuid('A'), name=name, parent=None, catalog=catalog)
        root.save()

        access = models.Access(user=request.user, catalog=catalog)
        access.save()

        request.user.had_catalog = True
        request.user.save()

    serializer = CatalogStateSerializer(catalog)
    return Response(serializer.data)

@api_view(['PUT'])
def create_album(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if not request.user.can_access_catalog(serializer.validated_data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    if serializer.validated_data['parent'] is None:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    album = serializer.save(id=uuid("A"))

    serializer = AlbumSerializer(album)
    return Response(serializer.data)

@api_view(['POST'])
def edit_album(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        album = models.Album.objects.get(id=data['id'])
        if album.parent is None and data['parent'] is not None:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        elif album.parent is not None and data['parent'] is None:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer.update(album, data)
        serializer = AlbumSerializer(album)
        return Response(serializer.data)
    except models.Album.DoesNotExist:
        return Response(status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
def logout(request):
    logout_user(request)
    return Response(serialize_state(request))

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

    filename = os.path.basename(file.name)
    if filename is None or filename == "":
        filename = 'original.%s' % (guessed.extension)

    with transaction.atomic():
        tags = [models.Tag.get_from_path(catalog, p) for p in data['tags']]
        people = [models.Person.get_from_name(catalog, n) for n in data['people']]

        media = models.Media(id=uuid("M"), catalog=catalog, mimetype=guessed.mime,
                             orientation=data['orientation'], filename=os.path.basename(file.name),
                             storage_filename=filename)
        media.tags.add(*tags)
        media.people.add(*people)

        if 'album' in data and data['album'] is not None:
            media.albums.add(data['album'])
        media.save()

    temp = media.storage.get_temp_path(media.storage_filename)
    with open(temp, "wb") as output:
        for chunk in file.chunks():
            output.write(chunk)

    process_media.delay(media.id)

    serializer = MediaSerializer(media)
    return Response(serializer.data)

@api_view(['POST'])
def search(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = SearchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    search_params = serializer.create(serializer.validated_data)

    if not request.user.can_access_catalog(search_params.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    query = search_params.get_query()
    media = []
    if query is not None:
        media = models.Media.objects.filter(query).distinct()
        logger.debug(media.query)
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
