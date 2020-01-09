from rest_framework import serializers

from ..storage import Server, Backblaze
from ..models import Catalog
from .album import AlbumSerializer
from .person import PersonSerializer
from .tag import TagSerializer

def get_catalog_storage_field(instance):
    if instance.backblaze is not None:
        serializer = BackblazeSerializer(instance.backblaze)
        data = serializer.data
        data['type'] = 'backblaze'
        return data

    if instance.server is not None:
        serializer = ServerSerializer(instance.server)
        data = serializer.data
        data['type'] = 'server'
        return data

    raise RuntimeError("Unreachable")

class BackblazeSerializer(serializers.ModelSerializer):
    keyId = serializers.CharField(write_only=True, source='key_id')

    class Meta:
        model = Backblaze
        fields = ['keyId', 'key', 'bucket', 'path']

class ServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Server
        fields = []

class CatalogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False, allow_blank=False, allow_null=False, default=None)
    name = serializers.CharField(write_only=True)
    storage = serializers.SerializerMethodField()

    def get_storage(self, instance):
        return get_catalog_storage_field(instance)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'storage']

class CatalogStateSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True)
    people = PersonSerializer(many=True)
    albums = AlbumSerializer(many=True)
    root = serializers.SerializerMethodField()

    def get_root(self, catalog):
        return catalog.root.id

    class Meta(CatalogSerializer.Meta):
        model = Catalog
        fields = ['id', 'root', 'people', 'tags', 'albums']
