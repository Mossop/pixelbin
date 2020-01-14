import logging

from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from rest_framework import status

from . import api_view
from .. import models
from ..utils import ApiException
from ..serializers.user import UserSerializer, LoginSerializer
from ..serializers.state import ServerDataSerializer, serialize_state

LOGGER = logging.getLogger(__name__)

@api_view('PUT', requires_login=True, request=UserSerializer, response=ServerDataSerializer)
def create(request, deserialized):
    if len(models.User.objects.filter(email=deserialized.validated_data['email'])) > 0:
        raise ApiException('signup-bad-email')

    user = deserialized.save()
    if not request.auth:
        login_user(request, user)
    return serialize_state(request)

@api_view('POST', requires_login=False, request=LoginSerializer, response=ServerDataSerializer)
def login(request, deserialized):
    user = authenticate(request, username=deserialized.validated_data['email'],
                        password=deserialized.validated_data['password'])
    if user is not None:
        login_user(request, user)
        return serialize_state(request)
    raise ApiException('login-failed', status=status.HTTP_403_FORBIDDEN)

@api_view('POST', requires_login=False, response=ServerDataSerializer)
def logout(request):
    logout_user(request)
    return serialize_state(request)
