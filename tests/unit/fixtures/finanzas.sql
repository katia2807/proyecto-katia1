-- Base ficticia, creada solo en memoria para probar las acciones y la migración.
create role anon; create role authenticated; create role service_role;
create type estado_documento as enum('borrador','confirmada');
create type medio_pago as enum('efectivo','banco','yape','otro');
create type tipo_movimiento as enum('ingreso','egreso','transferencia');
create table perfiles(user_id uuid,organization_id uuid,role text,ui_role text,deactivated_at timestamptz);
create table clientes(id uuid primary key,organization_id uuid,nombre text,ruc text);
create table proveedores(id uuid primary key,organization_id uuid);
create table inventario_productos(id uuid primary key,organization_id uuid,nombre text,stock_actual numeric,unidad text,categoria text);
create table muebles_catalogo(id uuid primary key,organization_id uuid,nombre text,stock_disponible numeric);
create table ventas_madera(id uuid primary key default gen_random_uuid(),organization_id uuid,cliente_id uuid references clientes(id),
 fecha date,total numeric(12,2),estado estado_documento,correlativo text,created_by uuid);
create table ventas_madera_lineas(venta_id uuid references ventas_madera(id),item_id uuid,cantidad numeric,precio_unitario numeric);
create table inventario_movimientos(id uuid default gen_random_uuid(),organization_id uuid,producto_id uuid references inventario_productos(id),
 fecha date,tipo text,cantidad numeric,costo_unitario numeric,referencia text);
create table ventas_mueble_terminado(id uuid primary key default gen_random_uuid(),organization_id uuid,cliente_id uuid references clientes(id),
 mueble_catalogo_id uuid,cantidad numeric,precio_unitario numeric,total numeric,chofer_id uuid,tipo_entrega text,direccion_entrega text,
 estado_entrega text,metodo_pago text,modalidad_pago text,fecha_pago_credito date,correlativo text,fecha date,created_by uuid,updated_by uuid);
create table ventas_madera_cortada(id uuid primary key default gen_random_uuid(),organization_id uuid,cliente_id uuid references clientes(id),estado text,
 fecha date,tipo_corte text,total_pt numeric,precio_por_pt numeric,cantidad_piezas numeric,precio_unitario_comercial numeric,
 lineas_comprobante jsonb,tipo_comprobante text,total numeric,metodo_pago text,modalidad_pago text,fecha_pago_credito date,
 chofer_id uuid,tipo_entrega text,direccion_entrega text,estado_entrega text,inventario_producto_id uuid,created_by uuid,correlativo text);
create table servicios_aserradero(id uuid primary key default gen_random_uuid(),organization_id uuid,cliente_id uuid references clientes(id),
 fecha date,pies_cubicos numeric,costo_cubicaje numeric,precio_cobrado numeric,utilidad numeric,lineas_json jsonb,
 correlativo text,created_by uuid,metodo_pago text,modalidad_pago text,fecha_pago_credito date,adelanto numeric);
create table compras_madera(id uuid primary key default gen_random_uuid(),organization_id uuid,proveedor_id uuid references proveedores(id),
 fecha date,especie_madera text,detalle text,cantidad numeric,unidad text,precio_unitario numeric,total numeric,
 modalidad_pago text,adelanto numeric,saldo_pendiente numeric,estado estado_documento,url_comprobante text,created_by uuid);
create table alquileres(id uuid primary key,organization_id uuid,cliente_id uuid references clientes(id),estado text,
 monto_total numeric,deposito_30 numeric,penalidad numeric,penalidad_retraso_pago_pct numeric,penalidad_devolucion_tardia_pct numeric,
 penalidad_danios_pct numeric,metodo_pago text,codigo text,fecha_fin date,observaciones_retorno text);
create table cotizaciones_unificadas(id uuid primary key,organization_id uuid,cliente_id uuid references clientes(id),total numeric,
 correlativo text,fecha date,estado_flujo text,detalle jsonb,deleted_at timestamptz);
create table cotizaciones_mueble(id uuid primary key,organization_id uuid,cliente_id uuid references clientes(id),precio_acordado numeric,estado estado_documento);
create table ordenes_produccion(id uuid primary key default gen_random_uuid(),organization_id uuid,cliente_id uuid references clientes(id),
 cotizacion_id uuid,cotizacion_unificada_id uuid,estado text,notas text,fecha_aprobacion date,correlativo text,created_by uuid,updated_by uuid);
create table movimientos_caja(id uuid primary key default gen_random_uuid(),organization_id uuid,fecha date,tipo tipo_movimiento,medio medio_pago,
 categoria text,monto numeric(12,2) not null check(monto>0),descripcion text,modulo_origen text,referencia_id uuid,es_personal boolean default false,
 tipo_comprobante text,url_comprobante text,created_by uuid,updated_by uuid,voided_at timestamptz,deleted_at timestamptz,periodo_cerrado boolean default false);
create function fallo_caja_ficticio() returns trigger language plpgsql as $$
begin
 if current_setting('auditoria.fallo_caja',true)='si' or current_setting('auditoria.fallo_categoria',true)=new.categoria then
   raise exception 'Fallo de Caja inyectado solo en la base ficticia';
 end if;
 return new;
end $$;
create trigger fallo_caja before insert or update on movimientos_caja for each row execute function fallo_caja_ficticio();
