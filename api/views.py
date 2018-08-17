from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.contrib.auth import authenticate, login as login_user, logout as logout_user

def login(request):
    if request.method == 'POST' and 'email' in request.POST and 'password' in request.POST:
        user = authenticate(request, username=request.POST['email'], password=request.POST['password'])
        if user is not None:
            login_user(request, user)
            data = {
                "email": user.email,
                "fullname": user.full_name,
            }
            return JsonResponse(data)
        else:
            return HttpResponseForbidden('<h1>Forbidden</h1>')
    return HttpResponseBadRequest('<h1>Bad Request</h1>')

def logout(request):
    logout_user(request)
    return HttpResponse('<h1>Logged Out</h1>')
