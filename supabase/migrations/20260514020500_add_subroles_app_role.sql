-- Sub-roles configurables desde /admin/usuarios
-- Nota: mantenemos valores legacy para compatibilidad.

alter type public.app_role add value if not exists 'vendedor';
alter type public.app_role add value if not exists 'almacen';
alter type public.app_role add value if not exists 'caja';
