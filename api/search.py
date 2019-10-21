from django.db.models.expressions import Q
from .models import Album

class FieldQuery:
    FIELDS = [
        'album',
        'tag',
        'person',
    ]
    OPERATIONS = [
        'child',
        'descendant'
    ]

    def __init__(self, field, operation, value, invert=False):
        self.field = field
        self.operation = operation
        self.value = value
        self.invert = invert

    def album_query(self):
        album = None
        if self.value != '':
            try:
                album = Album.objects.get(lc_name=self.value.lower())
            except Album.DoesNotExist:
                return False

        if self.operation == 'child':
            return Q(albums=album)
        if self.operation == 'descendent':
            return Q(albums__in=album.descendants())
        raise Exception("Unexpected operation on album field %s" % self.operation)

    # Returns True if every media matches this query, False if no media can
    # match this query or a Q object otherwise.
    def get_query(self):
        if self.field == 'album':
            query = self.album_query()
        else:
            raise Exception("Search on unknown field %s" % self.field)

        if self.invert:
            return ~query
        return query


class QueryGroup:
    JOINS = [
        '&&',
        '||',
    ]

    def __init__(self, queries, join='&&', invert=False):
        self.join = join
        self.queries = queries
        self.invert = invert

    def get_child_queries(self):
        children = list(self.queries)
        if len(children) == 0:
            return False

        query = None
        while len(children) > 0:
            next_query = children.pop(0).get_query()
            if isinstance(next_query, bool):
                if not next_query:
                    # No results, no point continuing
                    if self.join == '&&':
                        return False
                else:
                    # All results, no point continuing
                    if self.join == '||':
                        return True
            elif query is None:
                query = next_query
            elif self.join == '&&':
                query = query & next_query
            elif self.join == '||':
                query = query | next_query

        if query is None:
            return False
        return query

    # Returns True if every media matches this query, False if no media can
    # match this query or a Q object otherwise.
    def get_query(self):
        query = self.get_child_queries()
        if self.invert:
            return ~query
        return query


class Query:
    def __init__(self, field=None, group=None):
        if field is not None and group is not None:
            raise Exception("Cannot have both a group and a field on the same query.")
        if field is None and group is None:
            raise Exception("Must have a group or a field on a query.")

        self.field = field
        self.group = group

    # Returns the field or group query.
    def get_query(self):
        if self.field is not None:
            return self.field.get_query()
        if self.group is not None:
            return self.field.get_query()
        raise Exception("Query has not field or group.")
