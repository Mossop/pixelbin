import logging

from django.db import transaction
from django.contrib.auth import authenticate, login as login_user, logout as logout_user
from rest_framework import status

from . import api_view
from ..utils import ApiException
from ..serializers.user import UserSerializer, LoginSerializer
from ..serializers.state import ServerDataSerializer, build_state

LOGGER = logging.getLogger(__name__)

@api_view('GET', requires_login=False, response=ServerDataSerializer)
def state(request):
    return build_state(request)

@api_view('PUT', requires_login=False, request=UserSerializer, response=ServerDataSerializer)
def create(request, deserialized):
    with transaction.atomic():
        user = deserialized.save()

    login_user(request, user)
    return build_state(request)

@api_view('POST', requires_login=False, request=LoginSerializer, response=ServerDataSerializer)
def login(request, deserialized):
    user = authenticate(request, username=deserialized.validated_data['email'],
                        password=deserialized.validated_data['password'])
    if user is not None:
        login_user(request, user)
        return build_state(request)
    raise ApiException('login-failed', status=status.HTTP_403_FORBIDDEN)

@api_view('POST', requires_login=False, response=ServerDataSerializer)
def logout(request):
    logout_user(request)
    return build_state(request)
