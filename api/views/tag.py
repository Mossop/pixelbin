from . import api_view
from ..utils import ApiException
from ..models import Tag
from ..serializers.tag import TagSerializer, TagFindSerializer
from ..serializers.wrappers import ListSerializerWrapper, PatchSerializerWrapper

@api_view('PUT', request=TagSerializer, response=TagSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    parent = data['parent']
    if parent is not None and data['catalog'] != parent.catalog:
        raise ApiException('catalog-mismatch')

    with Tag.lock_for_create():
        return deserialized.save()

@api_view('PATCH', request=PatchSerializerWrapper(TagSerializer), response=TagSerializer)
def edit(request, deserialized):
    tag = deserialized.instance
    request.user.check_can_modify(tag.catalog)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != tag.catalog:
        raise ApiException('catalog-change')

    if 'parent' in data and data['parent'] is not None and data['parent'].catalog != tag.catalog:
        raise ApiException('catalog-mismatch')

    return deserialized.save()

@api_view('POST', request=TagFindSerializer, response=ListSerializerWrapper(TagSerializer))
def find(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with Tag.lock_for_create():
        tag = Tag.get_for_path(data['catalog'], data['path'])

        # Build a list of all parents, top-level first.Any of these may have
        # been created when getting the tag.
        tags = []
        while tag is not None:
            tags.insert(0, tag)
            tag = tag.parent

        return tags
