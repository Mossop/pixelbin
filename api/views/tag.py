from . import api_view
from ..utils import ApiException
from ..models import Tag
from ..serializers.tag import TagSerializer, TagFindSerializer

@api_view('PUT', request=TagSerializer, response=TagSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    parent = data['parent']
    if parent is not None and data['catalog'] != parent.catalog:
        raise ApiException('catalog-mismatch')

    name = deserialized.validated_data['name']
    parent = deserialized.validated_data['parent']
    with Tag.lock_for_create():
        return Tag.get_for_path(data['catalog'], [name])

@api_view('POST', request=TagFindSerializer, response=TagSerializer)
def find(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with Tag.lock_for_create():
        return Tag.get_for_path(data['catalog'], data['path'])
