from . import api_view
from ..utils import uuid, ApiException
from ..serializers.album import AlbumSerializer, AlbumMediaSerializer
from ..serializers.wrappers import PatchSerializerWrapper

@api_view('PUT', request=AlbumSerializer, response=AlbumSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    if 'parent' in data and data['parent'] is not None and \
       data['catalog'] != data['parent'].catalog:
        raise ApiException('catalog-mismatch')

    return deserialized.save(id=uuid("A"))

@api_view('PATCH', request=PatchSerializerWrapper(AlbumSerializer), response=AlbumSerializer)
def edit(request, deserialized):
    album = deserialized.instance
    request.user.check_can_modify(album.catalog)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != album.catalog:
        raise ApiException('catalog-change')

    if 'parent' in data and data['parent'] is not None and data['parent'].catalog != album.catalog:
        raise ApiException('catalog-mismatch')

    return deserialized.save()

@api_view('PUT', request=AlbumMediaSerializer, response=AlbumSerializer)
def add(request, deserialized):
    data = deserialized.validated_data
    album = data['album']
    request.user.check_can_modify(album.catalog)

    for media in data['media']:
        if media.catalog != album.catalog:
            raise ApiException('catalog-mismatch')

    album.media.add(*data['media'])
    return album

@api_view('DELETE', request=AlbumMediaSerializer, response=AlbumSerializer)
def remove(request, deserialized):
    data = deserialized.validated_data
    album = data['album']
    request.user.check_can_modify(album.catalog)

    album.media.remove(*deserialized.validated_data['media'])
    return album
