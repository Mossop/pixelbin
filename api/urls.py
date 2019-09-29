from django.urls import path

from . import views

urlpatterns = [
    path('dummy', views.dummy),
    path('login', views.login),
    path('logout', views.logout),
]
