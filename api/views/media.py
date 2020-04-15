import os
import logging

from django.http.response import HttpResponse
from filetype import filetype

from . import api_view
from ..models import Media
from ..utils import ApiException
from ..serializers.media import MediaSerializer, ThumbnailRequestSerializer
from ..serializers.search import SearchSerializer
from ..serializers.wrappers import (
    ListSerializerWrapper,
    ModelIdQuery,
    BlobSerializer,
    MultipartSerializerWrapper,
    PatchSerializerWrapper
)
from ..tasks import process_new_file
from ..media import build_thumbnail, ALLOWED_TYPES

LOGGER = logging.getLogger(__name__)

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

def validate(request, file, catalog):
    request.user.check_can_modify(catalog)

    if file is not None:
        guessed_mimetype = filetype.guess_mime(file)
        if not guessed_mimetype in ALLOWED_TYPES:
            raise ApiException('unknown-type', message_args={
                'type': guessed_mimetype,
            })

@api_view('PUT', request=MultipartSerializerWrapper(MediaSerializer), response=MediaSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    file = data['file']

    validate(request, file, data['catalog'])

    media = deserialized.save()
    return perform_upload(media, file)

@api_view('GET', request=ModelIdQuery(Media), response=MediaSerializer)
def get(request, media):
    request.user.check_can_see(media.catalog)

    return media

@api_view('PUT', request=MultipartSerializerWrapper(PatchSerializerWrapper(MediaSerializer)),
          response=MediaSerializer)
def update(request, deserialized):
    media = deserialized.instance
    data = deserialized.validated_data
    file = data.get('file', None)

    if 'catalog' in data and data['catalog'] != media.catalog:
        raise ApiException('catalog-change')

    validate(request, file, media.catalog)

    media = deserialized.save()

    if file is not None:
        return perform_upload(media, file)
    return media

@api_view('POST', request=SearchSerializer, response=ListSerializerWrapper(MediaSerializer))
def search(request, deserialized):
    search_params = deserialized.create(deserialized.validated_data)

    request.user.check_can_see(search_params.catalog)

    query = search_params.get_query()
    if query is not None:
        return Media.objects.filter(query).distinct()
    return []

@api_view('GET', request=ThumbnailRequestSerializer, response=BlobSerializer())
def thumbnail(request, deserialized):
    media = deserialized.validated_data['media']
    request.user.check_can_see(media.catalog)

    image = build_thumbnail(media, deserialized.validated_data['size'])
    response = HttpResponse(content_type='image/jpeg')
    response.tell()
    image.save(response, 'jpeg', quality=90)

    return response
