from django.urls import path

from . import views

urlpatterns = [
    path('login', views.login),
    path('logout', views.logout),
    path('catalog/create', views.create_catalog),
    path('album/create', views.create_album),
    path('album/edit', views.edit_album),
    path('albums/edit', views.modify_albums),
    path('user/create', views.create_user),
    path('media/upload', views.upload),
    path('media/search', views.search),
    path('media/thumbnail', views.thumbnail),
    path('', views.default),
]
