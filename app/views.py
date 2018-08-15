from django.http import HttpResponse
from django.contrib import auth
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect
from django.urls import reverse
from django.template import loader

def signin(request):
    next = request.GET['next']
    template = loader.get_template('app/signin.html')
    context = {
        'next': next,
        'target': reverse(login)
    }
    return HttpResponse(template.render(context, request))

def login(request):
    username = request.POST['username']
    password = request.POST['password']
    next = request.POST['next']

    user = auth.authenticate(request, username=username, password=password)
    if user is not None:
        auth.login(request, user)
        return redirect(next)

    return HttpResponse("Bad Login.")

@login_required(login_url=signin)
def index(request):
    return HttpResponse("Index.")

@login_required(login_url=signin)
def upload(request):
    template = loader.get_template('app/upload.html')
    context = {}
    return HttpResponse(template.render(context, request))
