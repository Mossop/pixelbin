from typing import ContextManager
from contextlib import nullcontext

from django.db import DEFAULT_DB_ALIAS, connections

# pylint: disable=bad-whitespace
def lock(name: str, using: str=DEFAULT_DB_ALIAS) -> ContextManager:
    # pylint: disable=import-outside-toplevel,import-error
    connection = connections[using]
    if connection.vendor == 'mysql':
        from django_mysql.locks import Lock
        return Lock(name, using=using)
    if connection.vendor == 'postgresql':
        from django_pglocks import advisory_lock
        return advisory_lock(name, using=using)
    return nullcontext()
