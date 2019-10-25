from django.urls import path, include

APP_URL_PATTERNS = [
    path('api/', include('api.urls')),
    path('', include('app.urls')),
]
