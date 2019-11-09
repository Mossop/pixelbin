from rest_framework import status

from ..utils import api_view, ApiException

@api_view(['GET', 'PUT', 'OPTIONS', 'POST', 'DELETE', 'PATCH'])
def default(request):
    raise ApiException('unknown-method', status=status.HTTP_404_NOT_FOUND)
