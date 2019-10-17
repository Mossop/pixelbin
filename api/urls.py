from django.urls import path, include

from . import views

urlpatterns = [
    path('login', views.login),
    path('logout', views.logout),
    path('catalog/create', views.create_catalog),
    path('catalog/edit', views.edit_catalog),
    path('user/create', views.create_user),
    path('user', views.get_user),
    path('media/upload', views.upload),
    path('auth/', include('rest_framework.urls', namespace='rest_framework')),
]
