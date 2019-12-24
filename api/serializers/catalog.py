from rest_framework import serializers

from ..storage import Server, Backblaze
from ..models import Tag, Catalog, Person
from .album import AlbumSerializer

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

class CatalogPeopleSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Person
        fields = ['id', 'fullname']

class CatalogTagsSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()

    def get_id(self, instance):
        return str(instance.id)

    class Meta:
        model = Tag
        fields = ['id', 'name', 'parent']

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
    tags = CatalogTagsSerializer(many=True)
    people = CatalogPeopleSerializer(many=True)
    albums = AlbumSerializer(many=True)
    root = serializers.SerializerMethodField()

    def get_root(self, catalog):
        return catalog.root.id

    class Meta(CatalogSerializer.Meta):
        model = Catalog
        fields = ['id', 'root', 'people', 'tags', 'albums']
