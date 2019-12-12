from contextlib import nullcontext

from django.db import DEFAULT_DB_ALIAS, connections

def lock(name, using=DEFAULT_DB_ALIAS):
    connection = connections[using]
    if connection.vendor == 'mysql':
        from django_mysql.locks import Lock
        return Lock(name, using=using)
    if connection.vendor == 'postgresql':
        from django_pglocks import advisory_lock
        return advisory_lock(name, using=using)
    return nullcontext()
