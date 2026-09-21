from django.urls import path
from . import views

urlpatterns = [
    path('', views.list_applications, name='app-list'),
    path('<int:app_id>/', views.get_application, name='app-get'),
    path('create/', views.create_application, name='app-create'),
    path('update/<int:app_id>/', views.update_application, name='app-update'),
    path('delete/<int:app_id>/', views.delete_application, name='app-delete'),
]
