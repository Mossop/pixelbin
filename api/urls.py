from django.urls import path

from . import views

urlpatterns = [
    path('login', views.login),
    path('logout', views.logout),
    path('upload', views.upload),
    path('listUntagged', views.untagged),
    path('listMedia', views.list),
    path('saveSearch', views.save),
    path('tagSearch', views.retrieve),
    path('media/<id>', views.metadata),
    path('media/<id>/download', views.download),
    path('media/<id>/thumbnail', views.thumbnail),
]
