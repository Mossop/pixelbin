from django.urls import path

from . import views

urlpatterns = [
    path('dummy', views.dummy),
    path('login', views.login),
    path('signup', views.signup),
    path('createCatalog', views.create_catalog),
    path('logout', views.logout),
]
