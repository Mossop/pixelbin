from . import api_view
from ..utils import ApiException
from ..serializers.album import AlbumSerializer, AlbumMediaSerializer
from ..serializers.wrappers import PatchSerializerWrapper

@api_view('PUT', request=AlbumSerializer, response=AlbumSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    return deserialized.save()

@api_view('PATCH', request=PatchSerializerWrapper(AlbumSerializer), response=AlbumSerializer)
def edit(request, deserialized):
    album = deserialized.instance
    request.user.check_can_modify(album.catalog)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != album.catalog:
        raise ApiException('catalog-change')

    return deserialized.save()

@api_view('PUT', request=AlbumMediaSerializer, response=AlbumSerializer)
def add(request, deserialized):
    data = deserialized.validated_data
    album = data['album']
    request.user.check_can_modify(album.catalog)

    album.media.add(*data['media'])
    return album

@api_view('DELETE', request=AlbumMediaSerializer, response=AlbumSerializer)
def remove(request, deserialized):
    data = deserialized.validated_data
    album = data['album']
    request.user.check_can_modify(album.catalog)

    album.media.remove(*deserialized.validated_data['media'])
    return album
