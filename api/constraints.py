from django.db.backends.ddl_references import Statement, Table, Columns
from django.db.models.constraints import BaseConstraint
from django.db.models.sql.query import Query
from django.db.models.expressions import Func, F

USE_INDEX = ['sqlite', 'postgresql']

def resolve(expr, query):
    if isinstance(expr, Func):
        e = expr.copy()
        e.is_summary = False
        exprs = e.get_source_expressions()
        for pos, arg in enumerate(exprs):
            exprs[pos] = resolve(arg, query)
        e.set_source_expressions(exprs)
        return e
    if isinstance(expr, F):
        return expr.resolve_expression(query=query, allow_joins=False, simple_col=True)
    return expr.resolve_expression(query=query, allow_joins=False)

class UniqueWithExpressionsConstraint(BaseConstraint):
    def __init__(self, *, name, fields, expressions=None):
        self.fields = fields
        self.expressions = expressions
        super().__init__(name=name)

    def _get_terms(self, model, schema_editor):
        query = Query(model)
        compiler = query.get_compiler(connection=schema_editor.connection)

        terms = [schema_editor.quote_name(model._meta.get_field(field_name).column) for field_name in self.fields]
        for expression in self.expressions:
            expression = resolve(expression, query)
            sql, params = expression.as_sql(compiler, schema_editor.connection)
            terms.append('(%s)' % (sql % params))

        return terms

    def constraint_sql(self, model, schema_editor):
        if schema_editor.connection.vendor in USE_INDEX:
            sql = self.create_sql(model, schema_editor)
            if sql:
                schema_editor.deferred_sql.append(sql)
            return None

        terms = self._get_terms(model, schema_editor)
        constraint = schema_editor.sql_unique_constraint % {
            'columns': ', '.join(terms),
        }
        return schema_editor.sql_constraint % {
            'name': schema_editor.quote_name(self.name),
            'constraint': constraint,
        }

    def create_sql(self, model, schema_editor):
        terms = self._get_terms(model, schema_editor)
        table = Table(model._meta.db_table, schema_editor.quote_name)
        name = schema_editor.quote_name(self.name)
        columns = Columns(table, terms, str)

        if schema_editor.connection.vendor in USE_INDEX:
            template = schema_editor.sql_create_unique_index
        else:
            template = schema_editor.sql_create_unique

        return Statement(
            template,
            table=table,
            name=name,
            columns=columns,
            condition='',
        )

    def remove_sql(self, model, schema_editor):
        if schema_editor.connection.vendor in USE_INDEX:
            return schema_editor._delete_index_sql(model, self.name)

        return schema_editor._delete_unique_sql(model, self.name)

    def __repr__(self):
        return '<%s: fields=%r expressions=%r name=%r>' % (
            self.__class__.__qualname__, self.fields, self.expressions, self.name,
        )

    def __eq__(self, other):
        if isinstance(other, self.__class__):
            return (
                self.name == other.name and
                self.fields == other.fields and
                self.expressions == other.expressions
            )
        return super().__eq__(other)

    def deconstruct(self):
        path, args, kwargs = super().deconstruct()
        kwargs['fields'] = self.fields
        kwargs['expressions'] = self.expressions
        return path, args, kwargs
