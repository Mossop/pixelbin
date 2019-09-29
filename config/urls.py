from django.urls import path, include

app_url_patterns = [
    path('api/', include('api.urls')),
    path('', include('app.urls')),
]
