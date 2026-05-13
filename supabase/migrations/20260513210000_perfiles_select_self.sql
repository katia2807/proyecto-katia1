-- Lectura de la propia fila con la sesión del usuario (JWT), sin service_role.
-- Evita el bloqueo “inicio de sesión OK pero vuelve al login” cuando en Vercel solo
-- existen NEXT_PUBLIC_* y no se expone SUPABASE_SERVICE_ROLE_KEY al runtime.
create policy perfiles_select_self on public.perfiles
for select
using (user_id = auth.uid());
