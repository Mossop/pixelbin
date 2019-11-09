from rest_framework import serializers

from . import Serializer
from ..search import QueryGroup, FieldQuery, Search
from ..models import Catalog

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
