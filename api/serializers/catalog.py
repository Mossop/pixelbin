from rest_framework import serializers

from ..models import Catalog
from .album import AlbumSerializer
from .person import PersonSerializer
from .tag import TagSerializer
from . import Serializer, ModelSerializer, MapSerializer
from ..storage.serializers import StorageField

class CatalogCreateSerializer(Serializer):
    name = serializers.CharField()
    storage = StorageField()

    class Meta:
        js_request_type = 'CatalogCreateData'

class CatalogStateSerializer(ModelSerializer):
    tags = MapSerializer(child=TagSerializer())
    people = MapSerializer(child=PersonSerializer())
    albums = MapSerializer(child=AlbumSerializer())
    root = serializers.CharField(read_only=True, source='root.id')

    class Meta:
        js_response_type = 'CatalogData'
        model = Catalog
        fields = ['id', 'root', 'people', 'tags', 'albums']
