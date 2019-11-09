from django.db.models.constraints import UniqueConstraint
from django.db.models.sql.query import Query

class UniqueWithLookupsConstraint(UniqueConstraint):
    def __init__(self, *, fields, name, lookups=None):
        UniqueConstraint.__init__(self, fields=fields, name=name, condition=None)
        self.lookups = lookups

    def constraint_sql(self, model, schema_editor):
        query = Query(model)
        compiler = query.get_compiler(connection=schema_editor.connection)
        fields = [model._meta.get_field(field_name).column for field_name in self.fields]
        fields += ["(%s)" % l.resolve_expression(query) \
                             .as_sql(compiler, schema_editor.connection)[0]
                   for l in self.lookups]

        return "ALTER TABLE %(table)s ADD CONSTRAINT %(name)s UNIQUE (%(columns)s)" % {
            'table': model._meta.db_table,
            'name': self.name,
            'columns': ', '.join(fields),
        }

    def create_sql(self, model, schema_editor):
        return self.constraint_sql(model, schema_editor)

    def __repr__(self):
        return '<%s: fields=%r lookups=%r name=%r>' % (
            self.__class__.__name__, self.fields, self.lookups, self.name,
        )

    def __eq__(self, other):
        return (
            isinstance(other, UniqueWithLookupsConstraint) and
            self.name == other.name and
            self.fields == other.fields and
            self.lookups == other.lookups
        )

    def deconstruct(self):
        path, args, kwargs = super().deconstruct()
        kwargs['lookups'] = self.lookups
        return path, args, kwargs
