-- Datos demo de inventario (antes estaban en seed_erp_katia; requieren inventario_* creado en 20260430201000).

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
