from django.contrib.auth import get_user_model
from rest_framework import serializers

from .storage import Server, Backblaze
from .models import Album, Tag, Catalog, User, Access, Media, Person
from .search import QueryGroup, FieldQuery, Query

def creator(cls, data):
    serializer = cls(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.create(serializer.validated_data)

class Serializer(serializers.Serializer):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

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

class MediaPeopleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = ['full_name']

class MediaTagsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ['name', 'parent']

class MediaSerializer(serializers.ModelSerializer):
    tags = serializers.SerializerMethodField()
    people = serializers.SerializerMethodField()

    def get_tags(self, media):
        return [t.path() for t in media.tags.all()]

    def get_people(self, media):
        return [t.path() for t in media.people.all()]

    class Meta:
        model = Media
        fields = ['id', 'processed', 'orientation', 'title', 'filename',
                  'longitude', 'latitude', 'mimetype', 'width', 'height',
                  'tags', 'people']

class UploadSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    album = serializers.PrimaryKeyRelatedField(queryset=Album.objects.all(),
                                               write_only=True, allow_null=True)
    orientation = serializers.IntegerField(min_value=1, max_value=8)
    people = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        allow_empty=True
    )
    tags = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(allow_blank=False),
            allow_empty=False
        ),
        allow_empty=True
    )

class LoginSerializer(Serializer):
    email = serializers.CharField()
    password = serializers.CharField()

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
        fields = ['id', 'full_name']

class AlbumSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False)
    catalog = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Catalog.objects.all())
    stub = serializers.CharField(allow_null=True, default=None)
    parent = serializers.PrimaryKeyRelatedField(queryset=Album.objects.all(), allow_null=True)

    class Meta:
        model = Album
        fields = ['id', 'catalog', 'stub', 'name', 'parent']

class CatalogTagsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ['id', 'name', 'parent']

class CatalogEditSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    name = serializers.CharField()

class CatalogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
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

    class Meta(CatalogSerializer.Meta):
        model = Catalog
        fields = ['id', 'name', 'people', 'tags', 'albums']

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
        user = get_user_model().objects.create_user(validated_data['email'],
                                                    validated_data['full_name'],
                                                    validated_data['password'])
        return user

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified']
        extra_kwargs = {'password': {'write_only': True}}

class UserStateSerializer(UserSerializer):
    catalogs = CatalogStateSerializer(many=True)

    class Meta(UserSerializer.Meta):
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified', 'catalogs']

class StateSerializer(Serializer):
    user = UserStateSerializer()

def serialize_state(request):
    if request.user.is_authenticated:
        return StateSerializer({"user": request.user}).data
    else:
        return StateSerializer({"user": None}).data

class LazyQueryGroupSerializer(Serializer):
    def to_representation(self, instance):
        serializer = QueryGroupSerializer(instance, context=self.context)
        return serializer.to_representation(instance)

    def to_internal_value(self, data):
        serializer = QueryGroupSerializer(data=data, context=self.context)
        return serializer.to_internal_value(data)

class FieldQuerySerializer(Serializer):
    invert = serializers.BooleanField()
    field = serializers.ChoiceField(FieldQuery.FIELDS)
    operation = serializers.ChoiceField(FieldQuery.OPERATIONS)
    value = serializers.CharField(allow_blank=True)

    def create(self, validated_data):
        return FieldQuery(**validated_data)

class QuerySerializer(Serializer):
    field = FieldQuerySerializer(required=False)
    group = LazyQueryGroupSerializer(required=False)

    def create(self, validated_data):
        if 'field' in validated_data:
            return Query(field=creator(FieldQuerySerializer, validated_data['field']))
        if 'group' in validated_data:
            return Query(group=creator(QueryGroupSerializer, validated_data['group']))
        raise Exception("No field or group for a query.")

class QueryGroupSerializer(Serializer):
    invert = serializers.BooleanField()
    join = serializers.ChoiceField(QueryGroup.JOINS)
    queries = QuerySerializer(many=True)

    def create(self, validated_data):
        validated_data['queries'] = [creator(QuerySerializer, q) for q in validated_data['queries']]
        return QueryGroup(**validated_data)

class SearchSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    query = QueryGroupSerializer()

    def create(self, validated_data):
        return creator(QueryGroupSerializer, validated_data['query'])

class ThumbnailRequestSerializer(Serializer):
    media = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all())
    size = serializers.IntegerField()
