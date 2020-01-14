import os
from datetime import datetime

from django.http.response import HttpResponse
from rest_framework.response import Response
from rest_framework import status
from filetype import filetype

from . import api_view
from ..models import Media
from ..utils import uuid
from ..serializers.media import MediaSerializer, ThumbnailRequestSerializer, UploadSerializer
from ..serializers.search import SearchSerializer
from ..serializers import ListSerializerWrapper, ModelIdQuery, BlobSerializer, \
                          MultipartSerializerWrapper
from ..tasks import process_media
from ..media import build_thumbnail

@api_view('PUT', request=MediaSerializer, response=MediaSerializer)
def create(request, deserialized):
    if not request.user.can_access_catalog(deserialized.validated_data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    for album in deserialized.validated_data['albums']:
        if album.catalog != deserialized.validated_data['catalog']:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    return deserialized.save(id=uuid('M'))

@api_view('GET', request=ModelIdQuery(Media), response=MediaSerializer)
def get(request, media):
    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    return media

@api_view('PUT', request=MultipartSerializerWrapper(UploadSerializer), response=MediaSerializer)
def upload(request, deserialized):
    media = deserialized.validated_data['id']
    file = deserialized.validated_data['file']

    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    guessed_type = filetype.guess(file)
    if guessed_type is None:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    try:
        filename = 'original.%s' % (guessed_type.extension)
        temp = media.storage.get_temp_path(filename)
        with open(temp, "wb") as output:
            for chunk in file.chunks():
                output.write(chunk)

        if file.name is not None and len(file.name) > 0:
            media.metadata.set_media_value('filename', os.path.basename(file.name))
        media.storage_filename = filename
        media.mimetype = guessed_type.mime
        media.new_file = True
        media.uploaded = datetime.now()
        media.save()
    except Exception as exc:
        media.storage.delete_all_temp()
        raise exc

    process_media.delay(media.id)
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
