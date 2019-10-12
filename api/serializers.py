from django.contrib.auth import get_user_model
from rest_framework import serializers

from .storage import Server, Backblaze
from .models import Album, Tag, Catalog, User, Access

class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField()

class BackblazeSerializer(serializers.ModelSerializer):
    keyId = serializers.CharField(source='key_id')

    class Meta:
        model = Backblaze
        fields = ['keyId', 'key', 'bucket', 'path']
        extra_kwargs = {'key': {'write_only': True}}

class ServerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Server
        fields = []

class StorageSerializer(serializers.Field):
    default_error_messages = {
        'incorrect_type': 'Incorrect type. Expected {expected_type}, but got {found_type}',
        'missing_property': 'The required property "{name}" was not present.',
        'invalid_type': 'Unknown storage type "{type}"'
    }

    def create(self, validated_data):
        data = dict(validated_data)
        del data['type']

        if validated_data['type'] == 'backblaze':
            serializer = BackblazeSerializer(data=validated_data)
            serializer.is_valid(raise_exception=True)
            return serializer.create(data)
        if validated_data['type'] == 'server':
            serializer = ServerSerializer(data=validated_data)
            serializer.is_valid(raise_exception=True)
            return serializer.create(data)

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            self.fail('incorrect_type', expected_type='object', found_type=type(data).__name__)
        if 'type' not in data:
            self.fail('missing_property', name='type')

        storage_type = data['type']
        if not isinstance(storage_type, str):
            self.fail('incorrect_type', expected_type='str', found_type=type(storage_type).__name__)

        if storage_type == 'backblaze':
            serializer = BackblazeSerializer(data=data)
        elif storage_type == 'server':
            serializer = ServerSerializer(data=data)
        else:
            self.fail('invalid_type', type=storage_type)

        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        validated['type'] = storage_type
        return validated

    def to_representation(self, value):
        backblaze = value.as_backblaze()
        if backblaze is not None:
            serializer = BackblazeSerializer(backblaze)
            data = serializer.data
            data['type'] = 'backblaze'
            return data
        server = value.as_server()
        if server is not None:
            serializer = ServerSerializer(server)
            data = serializer.data
            data['type'] = 'server'
            return data


class CatalogAlbumsSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Album
        fields = ['id', 'stub', 'name', 'parent']

class CatalogTagsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ['id', 'name', 'parent']

class CatalogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    storage = StorageSerializer()

    def create(self, validated_data):
        storage = self.fields['storage'].create(validated_data['storage'])
        storage.save()
        validated_data['storage'] = storage
        return super().create(validated_data)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'storage']

class CatalogStateSerializer(CatalogSerializer):
    tags = CatalogTagsSerializer(many=True)
    albums = CatalogAlbumsSerializer(many=True)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'storage', 'tags', 'albums']

class AccessSerializer(serializers.ModelSerializer):
    catalog = CatalogStateSerializer()

    class Meta:
        model = Access
        fields = ['catalog']

class UserSerializer(serializers.ModelSerializer):
    fullname = serializers.CharField(source='full_name')
    hadCatalog = serializers.BooleanField(source='had_catalog', read_only=True)
    verified = serializers.BooleanField(read_only=True)

    def create(self, validated_data):
        user = get_user_model().objects.create_user(validated_data['email'], validated_data['full_name'], validated_data['password'])
        return user

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified']
        extra_kwargs = {'password': {'write_only': True}}

class UserStateSerializer(UserSerializer):
    catalogs = CatalogStateSerializer(many=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified', 'catalogs']
        extra_kwargs = {'password': {'write_only': True}}

class StateSerializer(serializers.Serializer):
    user = UserStateSerializer()

def serialize_state(request):
    if request.user.is_authenticated:
        return StateSerializer({"user": request.user}).data
    else:
        return StateSerializer({"user": None}).data
