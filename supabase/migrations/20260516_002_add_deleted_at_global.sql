-- OLA 0: Soft delete global
-- Agrega deleted_at (timestamp nullable) a tablas con historia.
-- Política: nunca borrar duro lo que tiene historia. Usar deleted_at IS NULL en queries.

ALTER TABLE public.clientes          ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.inventario_productos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ventas_madera     ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ventas_madera_cortada ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.cotizaciones_unificadas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.movimientos_caja  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.alquileres        ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.muebles_catalogo  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ventas_mueble_terminado ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.ordenes_produccion ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.proveedores       ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Índices para soft delete (filtros frecuentes deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_clientes_not_deleted          ON public.clientes (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventario_productos_not_deleted ON public.inventario_productos (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_not_deleted      ON public.cotizaciones_unificadas (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_not_deleted  ON public.movimientos_caja (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_madera_not_deleted     ON public.ventas_madera (organization_id) WHERE deleted_at IS NULL;

-- DOWN: ver 20260516_002_down_add_deleted_at_global.sql
