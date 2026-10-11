-- Completa únicamente la estructura ficticia usada en las pruebas sin red.
alter table inventario_productos add column if not exists costo_unitario numeric;
alter table cotizaciones_unificadas add column if not exists tipo_cliente text;
create type public.estado_cotizacion_unificada as enum('pendiente','lista_produccion','en_produccion','cobrada','terminado','entregado','inactivo','deudor');
alter table cotizaciones_unificadas alter column estado_flujo type public.estado_cotizacion_unificada using estado_flujo::public.estado_cotizacion_unificada;
alter table clientes add column if not exists documento text;
alter table perfiles add column if not exists full_name text;
alter table alquileres alter column id set default gen_random_uuid();
create table if not exists audit_logs(id uuid default gen_random_uuid(),organization_id uuid,user_id uuid,user_name text,accion text,modulo text,entidad_id text,entidad_nombre text,detalles jsonb);
