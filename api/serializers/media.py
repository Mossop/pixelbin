from rest_framework import serializers
from django.db.models.fields.related_descriptors import ManyToManyDescriptor

from ..models import Media, Person, Tag, Album
from ..metadata import get_metadata_fields
from . import ModelSerializer, Serializer, ListSerializer

class MetadataSerializer(Serializer):
    class Meta:
        js_response_type = 'MetadataData'
        js_request_type = 'MetadataUpdateData'

def init_serializer():
    for field in get_metadata_fields():
        field.add_to_serializer(MetadataSerializer)
init_serializer()

class MediaSerializer(ModelSerializer):
    processVersion = serializers.IntegerField(source='process_version',
                                              read_only=True, allow_null=True)
    fileSize = serializers.IntegerField(source='file_size',
                                        read_only=True, allow_null=True)

    tags = ListSerializer(child=serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all()),
                          required=False, default=[])
    albums = ListSerializer(child=serializers.PrimaryKeyRelatedField(queryset=Album.objects.all()),
                            required=False, default=[])
    people = ListSerializer(child=serializers.PrimaryKeyRelatedField(queryset=Person.objects.all()),
                            required=False, default=[])

    metadata = MetadataSerializer(required=False, allow_null=False)

    file = serializers.FileField(write_only=True)

    def create(self, validated_data):
        init_data = {}
        many_keys = []
        for (key, value) in validated_data.items():
            if key in ['metadata', 'file']:
                continue
            if isinstance(getattr(Media, key, None), ManyToManyDescriptor):
                many_keys.append(key)
                continue
            init_data[key] = value
        instance = Media(**init_data)

        if 'metadata' in validated_data:
            instance.metadata.deserialize(validated_data['metadata'])

        instance.save()

        for key in many_keys:
            field = getattr(instance, key)
            field.set(validated_data[key])

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
        js_response_type = 'UnprocessedMediaData'
        js_request_type = 'MediaCreateData'
        model = Media
        fields = ['id', 'catalog', 'created',

                  'processVersion', 'uploaded', 'mimetype', 'width', 'height',
                  'duration', 'fileSize',

                  'tags', 'albums', 'people', 'file',

                  'metadata']
        extra_kwargs = {
            'id': {'read_only': True},
            'catalog': {'write_only': True},
            'created': {'read_only': True},

            'uploaded': {'read_only': True},
            'mimetype': {'read_only': True},
            'width': {'read_only': True},
            'height': {'read_only': True},
            'duration': {'read_only': True},
        }

class ThumbnailRequestSerializer(Serializer):
    id = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all(), allow_null=False)
    size = serializers.IntegerField()

    class Meta:
        js_request_type = 'MediaThumbnail'
