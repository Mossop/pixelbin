from django.http import HttpResponse

def index(request):
    return HttpResponse("Index.")

def login(request):
    return HttpResponse("Login.")

def upload(request):
    return HttpResponse("Upload.")
