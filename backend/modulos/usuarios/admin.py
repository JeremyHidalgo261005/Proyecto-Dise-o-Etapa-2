from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

Usuario = get_user_model()
admin.site.unregister(Usuario)


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        campos = [*super().get_readonly_fields(request, obj)]
        if obj is not None:
            # Los cambios de rol y estado pasan por la gestión de MiniGestor.
            campos.extend(('is_active', 'is_staff'))
            if obj.pk == request.user.pk:
                campos.extend(('is_superuser', 'groups', 'user_permissions'))
        return campos
