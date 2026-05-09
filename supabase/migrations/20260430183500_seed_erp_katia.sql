insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Proyecto Katia')
on conflict (id) do nothing;

insert into clientes (organization_id, nombre, documento, telefono)
values
  ('00000000-0000-0000-0000-000000000001', 'Ropero Carlos', null, null),
  ('00000000-0000-0000-0000-000000000001', 'Cliente Servicio Corte', null, null)
on conflict do nothing;

insert into alertas_operativas (organization_id, tipo, prioridad, estado, descripcion)
values
  ('00000000-0000-0000-0000-000000000001', 'stock_bajo', 'media', 'nueva', 'Stock de tornillo al 18%.'),
  ('00000000-0000-0000-0000-000000000001', 'penalidad_limite', 'alta', 'nueva', 'Contrato Bomba Mixer con penalidad acumulada alta.')
on conflict do nothing;

insert into clientes (organization_id, nombre, documento, telefono)
select '00000000-0000-0000-0000-000000000001', 'Inversiones Obra Sur', '20609988771', '945112233'
where not exists (
  select 1 from clientes
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and nombre = 'Inversiones Obra Sur'
);

insert into clientes (organization_id, nombre, documento, telefono)
select '00000000-0000-0000-0000-000000000001', 'Consorcio Mixer Norte', '20444555666', '955889900'
where not exists (
  select 1 from clientes
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and nombre = 'Consorcio Mixer Norte'
);

insert into empleados (organization_id, nombre, rol, activo, fecha_ingreso)
select '00000000-0000-0000-0000-000000000001', 'Operario Demo', 'Operario', true, '2026-04-01'
where not exists (
  select 1 from empleados
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and nombre = 'Operario Demo'
);

insert into empleados (organization_id, nombre, rol, activo, fecha_ingreso)
select '00000000-0000-0000-0000-000000000001', 'Chofer Demo', 'Chofer', true, '2026-03-15'
where not exists (
  select 1 from empleados
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and nombre = 'Chofer Demo'
);

insert into ventas_madera (organization_id, cliente_id, fecha, estado, total)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  '2026-04-30',
  'confirmada',
  900
from clientes c
where c.organization_id = '00000000-0000-0000-0000-000000000001'
  and c.nombre = 'Ropero Carlos'
  and not exists (
    select 1 from ventas_madera v
    where v.organization_id = '00000000-0000-0000-0000-000000000001'
      and v.fecha = '2026-04-30'
      and v.total = 900
  );

insert into alquileres (organization_id, cliente_id, activo, fecha_inicio, fecha_fin, tarifa, penalidad, estado)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  'Bomba Mixer',
  '2026-04-28',
  null,
  650,
  120,
  'abierto'
from clientes c
where c.organization_id = '00000000-0000-0000-0000-000000000001'
  and c.nombre = 'Consorcio Mixer Norte'
  and not exists (
    select 1 from alquileres a
    where a.organization_id = '00000000-0000-0000-0000-000000000001'
      and a.activo = 'Bomba Mixer'
      and a.fecha_inicio = '2026-04-28'
  );

insert into cotizaciones_mueble (
  organization_id,
  cliente_id,
  fecha,
  tipo,
  especie_madera,
  unidad_medida,
  origen_material,
  precio_calculado,
  precio_acordado,
  motivo_ajuste,
  estado
)
select
  '00000000-0000-0000-0000-000000000001',
  c.id,
  '2026-04-25',
  'mueble_personalizado',
  'Tornillo',
  'cm',
  'cliente',
  980,
  900,
  'Cliente dejó madera, solo mano de obra',
  'confirmada'
from clientes c
where c.organization_id = '00000000-0000-0000-0000-000000000001'
  and c.nombre = 'Ropero Carlos'
  and not exists (
    select 1 from cotizaciones_mueble cm
    where cm.organization_id = '00000000-0000-0000-0000-000000000001'
      and cm.fecha = '2026-04-25'
      and cm.precio_acordado = 900
  );

insert into sueldos (organization_id, empleado_id, periodo, monto_bruto, descuentos, monto_neto)
select
  '00000000-0000-0000-0000-000000000001',
  e.id,
  '2026-04',
  1800,
  200,
  1600
from empleados e
where e.organization_id = '00000000-0000-0000-0000-000000000001'
  and e.nombre = 'Chofer Demo'
  and not exists (
    select 1 from sueldos s
    where s.organization_id = '00000000-0000-0000-0000-000000000001'
      and s.empleado_id = e.id
      and s.periodo = '2026-04'
  );

insert into adelantos (organization_id, empleado_id, fecha, monto, estado)
select
  '00000000-0000-0000-0000-000000000001',
  e.id,
  '2026-04-27',
  200,
  'pendiente'
from empleados e
where e.organization_id = '00000000-0000-0000-0000-000000000001'
  and e.nombre = 'Chofer Demo'
  and not exists (
    select 1 from adelantos a
    where a.organization_id = '00000000-0000-0000-0000-000000000001'
      and a.empleado_id = e.id
      and a.fecha = '2026-04-27'
  );

insert into inventario_productos (
  organization_id,
  codigo,
  nombre,
  categoria,
  unidad,
  stock_actual,
  stock_minimo,
  activo
)
values
  ('00000000-0000-0000-0000-000000000001', 'MAD-TOR-01', 'Tabla Tornillo 2x10x240', 'Madera', 'unidad', 42, 18, true),
  ('00000000-0000-0000-0000-000000000001', 'LIS-CED-02', 'Listón Cedro 2x5x240', 'Madera', 'unidad', 10, 15, true),
  ('00000000-0000-0000-0000-000000000001', 'INS-TOR-03', 'Tornillo 1 1/2', 'Insumo', 'caja', 8, 6, true),
  ('00000000-0000-0000-0000-000000000001', 'INS-BAR-04', 'Barniz Marino 1L', 'Insumo', 'lata', 3, 5, true)
on conflict (organization_id, codigo) do nothing;

insert into inventario_movimientos (organization_id, producto_id, fecha, tipo, cantidad, referencia)
select
  i.organization_id,
  i.id,
  '2026-04-30',
  'salida_venta',
  case i.codigo
    when 'MAD-TOR-01' then 8
    when 'LIS-CED-02' then 14
    when 'INS-TOR-03' then 5
    else 3
  end,
  'Seed inicial'
from inventario_productos i
where i.organization_id = '00000000-0000-0000-0000-000000000001'
  and not exists (
    select 1 from inventario_movimientos m
    where m.organization_id = i.organization_id
  );

insert into proveedores (organization_id, nombre, documento, telefono)
values
  ('00000000-0000-0000-0000-000000000001', 'Katungo Jordi Romero', '74120123', '978591269'),
  ('00000000-0000-0000-0000-000000000001', 'Huillca Henry Verástegui', '10456789432', '976112545')
on conflict do nothing;

insert into compras_madera (
  organization_id,
  proveedor_id,
  fecha,
  especie_madera,
  detalle,
  cantidad,
  unidad,
  precio_unitario,
  total,
  modalidad_pago,
  adelanto,
  saldo_pendiente,
  estado
)
select
  p.organization_id,
  p.id,
  '2026-04-25',
  'Listón / Tablas mixtas',
  '3ra entrega de listones y tablas',
  1,
  'lote',
  9000,
  9000,
  'fiado',
  3600,
  5400,
  'confirmada'
from proveedores p
where p.organization_id = '00000000-0000-0000-0000-000000000001'
  and p.nombre = 'Katungo Jordi Romero'
  and not exists (
    select 1 from compras_madera c
    where c.organization_id = p.organization_id
  );
