from django.contrib.auth import get_user_model
from rest_framework import serializers

from .storage import Server, Backblaze
from .models import Album, Tag, Catalog, User, Access, Media, Person
from .search import QueryGroup, FieldQuery, Search

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

    # pylint: disable=no-self-use
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
    albums = serializers.PrimaryKeyRelatedField(many=True, queryset=Album.objects.all())

class MediaAlbumSerializer(Serializer):
    media = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all())
    addAlbums = serializers.PrimaryKeyRelatedField(many=True,
                                                   queryset=Album.objects.all(),
                                                   required=False, default=[])
    removeAlbums = serializers.PrimaryKeyRelatedField(many=True,
                                                      queryset=Album.objects.all(),
                                                      required=False, default=[])

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

class AlbumCreateSerializer(serializers.ModelSerializer):
    stub = serializers.CharField(allow_null=True, allow_blank=False, required=False, default=None)
    parent = serializers.PrimaryKeyRelatedField(queryset=Album.objects.all())

    class Meta:
        model = Album
        fields = ['stub', 'name', 'parent']

class AlbumSerializer(serializers.ModelSerializer):
    id = serializers.CharField()
    stub = serializers.CharField(allow_null=True, allow_blank=False, required=False, default=None)
    parent = serializers.PrimaryKeyRelatedField(queryset=Album.objects.all())

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
    name = serializers.CharField(write_only=True)
    storage = serializers.SerializerMethodField()

    # pylint: disable=no-self-use
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

    # pylint: disable=no-self-use
    def get_root(self, catalog):
        return catalog.root.id

    class Meta(CatalogSerializer.Meta):
        model = Catalog
        fields = ['id', 'root', 'people', 'tags', 'albums']

class AccessSerializer(serializers.ModelSerializer):
    catalog = CatalogStateSerializer()

    class Meta:
        model = Access
        fields = ['catalog']

class UserSerializer(serializers.ModelSerializer):
    fullname = serializers.CharField(source='full_name')
    password = serializers.CharField(write_only=True, allow_blank=True)
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

class UserStateSerializer(UserSerializer):
    catalogs = CatalogStateSerializer(many=True)

    class Meta(UserSerializer.Meta):
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified', 'catalogs']

class StateSerializer(Serializer):
    user = UserStateSerializer()

def serialize_state(request):
    if request.user.is_authenticated:
        return StateSerializer({"user": request.user}).data
    return StateSerializer({"user": None}).data

class RecursiveSerializer(Serializer):
    def create_inner(self, validated_data):
        args = {}
        for key, value in validated_data.items():
            field = self.fields[key]
            if isinstance(field, Serializer):
                args[key] = field.create(value)
            else:
                args[key] = value
        return args

class FieldQuerySerializer(Serializer):
    invert = serializers.BooleanField()
    field = serializers.ChoiceField(FieldQuery.FIELDS)
    operation = serializers.ChoiceField(FieldQuery.OPERATIONS)
    value = serializers.CharField(allow_blank=True)

    def create(self, validated_data):
        return FieldQuery(**validated_data)

class QuerySerializer(Serializer):
    def to_representation(self, instance):
        if isinstance(instance, QueryGroup):
            serializer = QueryGroupSerializer(instance)
        else:
            serializer = FieldQuerySerializer(instance)
        return serializer.to_representation(instance)

    def to_internal_value(self, data):
        if 'join' in data:
            serializer = QueryGroupSerializer(data=data)
        else:
            serializer = FieldQuerySerializer(data=data)
        return serializer.to_internal_value(data)

    def create(self, validated_data):
        if 'join' in validated_data:
            serializer = QueryGroupSerializer(data=validated_data)
        else:
            serializer = FieldQuerySerializer(data=validated_data)
        serializer.is_valid(raise_exception=True)
        return serializer.create(serializer.validated_data)

class QueryGroupSerializer(RecursiveSerializer):
    invert = serializers.BooleanField()
    join = serializers.ChoiceField(QueryGroup.JOINS)
    queries = QuerySerializer(many=True)

    def create(self, validated_data):
        args = self.create_inner(validated_data)
        return QueryGroup(**args)

class SearchSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    query = QuerySerializer()

    def to_representation(self, instance):
        pass

    def create(self, validated_data):
        query = self.fields['query'].create(validated_data['query'])
        return Search(validated_data['catalog'], query)

class ThumbnailRequestSerializer(Serializer):
    media = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all())
    size = serializers.IntegerField()
