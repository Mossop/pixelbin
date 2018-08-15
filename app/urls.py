from django.urls import path

from . import views

urlpatterns = [
    path('signin', views.signin),
    path('login', views.login),
    path('', views.index),
    path('upload', views.upload),
]
