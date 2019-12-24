from rest_framework import serializers
from django.db.models.fields.related_descriptors import ManyToManyDescriptor

from ..models import Media, Person, Tag, Album, Catalog
from ..metadata import get_metadata_fields
from . import Serializer

class MetadataSerializer(Serializer):
    pass

def init_serializer():
    for field in get_metadata_fields():
        field.add_to_serializer(MetadataSerializer)
init_serializer()

class MediaSerializer(serializers.ModelSerializer):
    catalog = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Catalog.objects.all())

    processVersion = serializers.IntegerField(source='process_version', read_only=True)

    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    albums = serializers.PrimaryKeyRelatedField(many=True, queryset=Album.objects.all())
    people = serializers.PrimaryKeyRelatedField(many=True, queryset=Person.objects.all())

    metadata = MetadataSerializer(required=False, allow_null=False)

    def create(self, validated_data):
        init_data = {}
        for (key, value) in validated_data.items():
            if key == 'metadata':
                continue
            if isinstance(getattr(Media, key), ManyToManyDescriptor):
                continue
            init_data[key] = value
        instance = Media(**init_data)

        if 'metadata' in validated_data:
            instance.metadata.deserialize(validated_data['metadata'])

        instance.save()

        for (key, value) in validated_data.items():
            if isinstance(getattr(Media, key), ManyToManyDescriptor):
                field = getattr(instance, key)
                field.set(value)

        return instance

    def update(self, instance, validated_data):
        for (key, value) in validated_data.items():
            if key == 'metadata':
                continue
            if isinstance(getattr(Media, key), ManyToManyDescriptor):
                continue
            setattr(instance, key, value)

        if 'metadata' in validated_data:
            instance.metadata.deserialize(validated_data['metadata'])

        instance.save()

        for (key, value) in validated_data.items():
            if isinstance(getattr(Media, key), ManyToManyDescriptor):
                field = getattr(instance, key)
                field.set(value)

        return instance

    class Meta:
        model = Media
        fields = ['id', 'catalog',
                  'processVersion', 'uploaded', 'mimetype', 'width', 'height',
                  'tags', 'albums', 'people',
                  'metadata']
        extra_kwargs = {
            'id': {'read_only': True},

            'uploaded': {'read_only': True},
            'mimetype': {'read_only': True},
            'width': {'read_only': True},
            'height': {'read_only': True},
        }

class ThumbnailRequestSerializer(Serializer):
    size = serializers.IntegerField()
