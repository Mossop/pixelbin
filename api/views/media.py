import os

from django.http.response import HttpResponse
from rest_framework.response import Response
from rest_framework import status
from filetype import filetype

from . import api_view
from ..models import Media
from ..utils import uuid, ApiException
from ..serializers.media import MediaSerializer, ThumbnailRequestSerializer
from ..serializers.search import SearchSerializer
from ..serializers import ListSerializerWrapper, ModelIdQuery, BlobSerializer, \
                          MultipartSerializerWrapper, PatchSerializerWrapper
from ..tasks import process_new_file
from ..media import build_thumbnail, ALLOWED_TYPES

def perform_upload(media, file):
    try:
        temp = media.file_store.get_temp_path('original')
        with open(temp, "wb") as output:
            for chunk in file.chunks():
                output.write(chunk)

        media.new_file = True
        media.save()
    except Exception as exc:
        media.file_store.delete_all_temp()
        raise exc

    if file.name is not None and len(file.name) > 0:
        target_name = os.path.basename(file.name)
    else:
        target_name = None
    process_new_file.delay(media.id, target_name)

    return media

# pylint: disable=too-many-arguments
def validate(request, file, catalog, albums, tags, people):
    if not request.user.can_access_catalog(catalog):
        raise ApiException('unauthenticated', status=status.HTTP_403_FORBIDDEN)

    if file is not None:
        guessed_mimetype = filetype.guess_mime(file)
        if not guessed_mimetype in ALLOWED_TYPES:
            raise ApiException('unknown-type', message_args={
                'type': guessed_mimetype,
            })

    for album in albums:
        if album.catalog != catalog:
            raise ApiException('catalog-mismatch')

    for tag in tags:
        if tag.catalog != catalog:
            raise ApiException('catalog-mismatch')

    for person in people:
        if person.catalog != catalog:
            raise ApiException('catalog-mismatch')

@api_view('PUT', request=MultipartSerializerWrapper(MediaSerializer), response=MediaSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    file = data['file']

    validate(request, file, data['catalog'], data['albums'], data['tags'], data['people'])

    media = deserialized.save(id=uuid('M'))
    return perform_upload(media, file)

@api_view('GET', request=ModelIdQuery(Media), response=MediaSerializer)
def get(request, media):
    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    return media

@api_view('PUT', request=MultipartSerializerWrapper(PatchSerializerWrapper(MediaSerializer)),
          response=MediaSerializer)
def update(request, deserialized):
    media = deserialized.instance
    data = deserialized.validated_data
    file = data.get('file', None)

    if not request.user.can_access_catalog(media.catalog):
        raise ApiException('unauthenticated', status=status.HTTP_403_FORBIDDEN)

    validate(request, file,
             data.get('catalog', None) or media.catalog,
             data.get('albums', None) or media.albums.all(),
             data.get('tags', None) or media.tags.all(),
             data.get('people', None) or media.people.all())

    media = deserialized.save()

    if file is not None:
        return perform_upload(media, file)
    return media

@api_view('POST', request=SearchSerializer, response=ListSerializerWrapper(MediaSerializer))
def search(request, deserialized):
    search_params = deserialized.create(deserialized.validated_data)

    if not request.user.can_access_catalog(search_params.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    query = search_params.get_query()
    if query is not None:
        return Media.objects.filter(query).distinct()
    return []

@api_view('GET', request=ThumbnailRequestSerializer, response=BlobSerializer())
def thumbnail(request, deserialized):
    media = deserialized.validated_data['id']
    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    image = build_thumbnail(media, deserialized.validated_data['size'])
    response = HttpResponse(content_type='image/jpeg')
    response.tell()
    image.save(response, 'jpeg', quality=90)

    return response
