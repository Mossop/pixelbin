from ..models import Catalog
from .album import AlbumSerializer
from .person import PersonSerializer
from .tag import TagSerializer
from . import ModelSerializer, MapSerializer
from ..storage.models import StorageField

class CatalogCreateSerializer(ModelSerializer):
    storage = StorageField(write_only=True)

    def create(self, validated_data):
        validated_data['storage'] = validated_data['storage'].save()
        return super().create(validated_data)

    class Meta:
        js_request_type = 'CatalogCreateData'
        model = Catalog
        fields = ['storage', 'name']

class CatalogSerializer(ModelSerializer):
    tags = MapSerializer(child=TagSerializer(), read_only=True)
    people = MapSerializer(child=PersonSerializer(), read_only=True)
    albums = MapSerializer(child=AlbumSerializer(), read_only=True)

    class Meta:
        js_response_type = 'CatalogData'
        model = Catalog
        fields = ['id', 'name', 'people', 'tags', 'albums']
