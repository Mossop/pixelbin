import os
import json

from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.http.response import HttpResponse
from django.db import transaction
from rest_framework.decorators import parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from filetype import filetype

from . import models
from .utils import uuid, api_view, ApiException
from .serializers import UploadSerializer, UserSerializer, LoginSerializer, \
    CatalogSerializer, CatalogStateSerializer, serialize_state, BackblazeSerializer, \
    ServerSerializer, MediaSerializer, AlbumSerializer, SearchSerializer, \
    ThumbnailRequestSerializer, MediaAlbumSerializer, AlbumCreateSerializer
from .tasks import process_media

@api_view(['GET', 'PUT', 'OPTIONS', 'POST', 'DELETE', 'PATCH'])
def default(request):
    raise ApiException('unknown-method', status=status.HTTP_404_NOT_FOUND)

@transaction.atomic
@api_view(['PUT'])
def create_user(request):
    if request.user and request.user.is_authenticated and not request.user.is_staff:
        return Response(status=status.HTTP_403_FORBIDDEN)
    serializer = UserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if len(models.User.objects.filter(email=serializer['email'])) > 0:
        raise ApiException('signup-bad-email')

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
    raise ApiException('login-failed', status=status.HTTP_403_FORBIDDEN)

@api_view(['GET'])
def get_media(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'id' not in request.query_params or not isinstance(request.query_params['id'], str):
        return Response(status=status.HTTP_400_BAD_REQUEST)

    try:
        media = models.Media.objects.get(id=request.query_params['id'])

        if not request.user.can_access_catalog(media.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = MediaSerializer(media)
        return Response(serializer.data)
    except models.Media.DoesNotExist:
        raise ApiException('unknown-media', status=status.HTTP_404_NOT_FOUND)

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

    serializer = AlbumCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['parent'].catalog
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    album = serializer.save(id=uuid("A"), catalog=catalog)

    serializer = AlbumSerializer(album)
    return Response(serializer.data)

@api_view(['PATCH'])
def edit_album(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        album = models.Album.objects.get(id=data['id'])
        if (album.parent is None and data['parent'] is not None) or \
            (album.parent is not None and data['parent'] is None):
            return Response(status=status.HTTP_400_BAD_REQUEST)
        if (not request.user.can_access_catalog(album.catalog)) or \
            ('catalog' in data and not request.user.can_access_catalog(data['catalog'])):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer.update(album, data)
        serializer = AlbumSerializer(album)
        return Response(serializer.data)
    except models.Album.DoesNotExist:
        return Response(status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
def logout(request):
    logout_user(request)
    return Response(serialize_state(request))

@api_view(['PATCH'])
def modify_albums(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = MediaAlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    add_albums = serializer.validated_data['addAlbums']
    remove_albums = serializer.validated_data['removeAlbums']
    media = serializer.validated_data['media']

    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        media.albums.remove(*remove_albums)
        media.albums.add(*add_albums)
        if len(media.albums.all()) == 0:
            raise ApiException('media-in-no-albums')

    return Response(status=status.HTTP_200_OK)

@api_view(['PUT'])
@parser_classes([MultiPartParser])
def upload(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'metadata' not in request.data or 'file' not in request.data:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    serializer = UploadSerializer(data=json.loads(request.data['metadata']))
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    file = request.data['file']
    guessed = filetype.guess(file)
    if guessed.mime[0:6] != "image/" and guessed.mime[0:6] != "video/":
        return Response(status=status.HTTP_400_BAD_REQUEST)

    filename = os.path.basename(file.name)
    if filename is None or filename == "":
        filename = 'original.%s' % (guessed.extension)

    albums = data['albums']
    if len(albums) == 0:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    catalog = albums[0].catalog

    for album in albums:
        if album.catalog != catalog:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    with models.Tag.lock_for_create():
        with models.Person.lock_for_create():
            with transaction.atomic():
                tags = [models.Tag.get_from_path(catalog, p) for p in data['tags']]
                people = [models.Person.get_from_name(catalog, n) for n in data['people']]

                media = models.Media(id=uuid("M"), catalog=catalog, mimetype=guessed.mime,
                                     orientation=data['orientation'],
                                     filename=os.path.basename(file.name),
                                     storage_filename=filename)
                media.save()

                media.tags.add(*tags)
                media.people.add(*people)
                media.albums.add(*albums)

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
