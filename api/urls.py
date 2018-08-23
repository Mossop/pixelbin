from django.urls import path

from . import views

urlpatterns = [
    path('login', views.login),
    path('logout', views.logout),
    path('upload', views.upload),
    path('listMedia', views.list),
    path('media/<id>/thumbnail', views.thumbnail),
]
