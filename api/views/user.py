from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

from .. import models
from ..utils import api_view, ApiException
from ..serializers.user import UserSerializer, LoginSerializer
from ..serializers.state import serialize_state

@transaction.atomic
@api_view(['PUT'])
def create(request):
    if request.user and request.user.is_authenticated and not request.user.is_staff:
        return Response(status=status.HTTP_403_FORBIDDEN)
    serializer = UserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if len(models.User.objects.filter(email=serializer['email'])) > 0:
        raise ApiException('signup-bad-email')

    user = serializer.save()
    if not request.auth:
        login_user(request, user)
    return Response(serialize_state(request))

@api_view(['POST'])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(request, username=serializer.validated_data['email'],
                        password=serializer.validated_data['password'])
    if user is not None:
        login_user(request, user)
        return Response(serialize_state(request))
    raise ApiException('login-failed', status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
def logout(request):
    logout_user(request)
    return Response(serialize_state(request))
