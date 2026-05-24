-- Agregar nuevos estados al flujo de cotización unificada
alter type public.estado_cotizacion_unificada add value 'terminado';
alter type public.estado_cotizacion_unificada add value 'entregado';
alter type public.estado_cotizacion_unificada add value 'inactivo';
alter type public.estado_cotizacion_unificada add value 'deudor';
