-- Roles UI (owner_admin / operaciones / readonly) y desactivación sin borrar usuario.

alter table public.perfiles add column if not exists ui_role text;
alter table public.perfiles add column if not exists deactivated_at timestamptz;

do $$
begin
  alter table public.perfiles
    add constraint perfiles_ui_role_chk
    check (ui_role is null or ui_role in ('owner_admin', 'operaciones', 'readonly'));
exception
  when duplicate_object then null;
end $$;

comment on column public.perfiles.ui_role is 'Rol funcional en UI; null = perfil legado (permisos solo por role enum).';
comment on column public.perfiles.deactivated_at is 'Si no es null, el usuario no debe iniciar sesión (pareja con ban en Auth).';

update public.perfiles set ui_role = 'owner_admin' where role = 'owner_admin' and ui_role is null;
update public.perfiles set ui_role = 'readonly' where role = 'partner_readonly' and ui_role is null;
