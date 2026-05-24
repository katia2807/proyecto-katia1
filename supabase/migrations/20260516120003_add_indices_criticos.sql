-- OLA 0: Índices críticos de rendimiento
-- Sin estos índices, las queries con filtros frecuentes se degradan a >5000 filas.

-- clientes
CREATE INDEX IF NOT EXISTS idx_clientes_org_estado     ON public.clientes (organization_id, estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_nombre          ON public.clientes USING gin(to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_clientes_created_at      ON public.clientes (organization_id, created_at DESC);

-- inventario_productos
CREATE INDEX IF NOT EXISTS idx_inv_org_categoria        ON public.inventario_productos (organization_id, categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_codigo               ON public.inventario_productos (organization_id, codigo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_nombre_fts           ON public.inventario_productos USING gin(to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_inv_stock_bajo           ON public.inventario_productos (organization_id, stock_actual) WHERE deleted_at IS NULL AND stock_actual <= stock_minimo;

-- movimientos_caja
CREATE INDEX IF NOT EXISTS idx_caja_org_fecha           ON public.movimientos_caja (organization_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_caja_tipo                ON public.movimientos_caja (organization_id, tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_caja_categoria           ON public.movimientos_caja (organization_id, categoria) WHERE deleted_at IS NULL;

-- ventas_madera
CREATE INDEX IF NOT EXISTS idx_ventas_madera_org_fecha  ON public.ventas_madera (organization_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_madera_estado     ON public.ventas_madera (organization_id, estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_madera_cliente    ON public.ventas_madera (organization_id, cliente_id) WHERE deleted_at IS NULL;

-- cotizaciones_unificadas
CREATE INDEX IF NOT EXISTS idx_cotiz_org_estado         ON public.cotizaciones_unificadas (organization_id, estado_flujo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cotiz_org_created        ON public.cotizaciones_unificadas (organization_id, created_at DESC) WHERE deleted_at IS NULL;

-- alquileres
CREATE INDEX IF NOT EXISTS idx_alquileres_org_estado    ON public.alquileres (organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_alquileres_org_fecha     ON public.alquileres (organization_id, fecha_inicio DESC);

-- perfiles
CREATE INDEX IF NOT EXISTS idx_perfiles_org_role        ON public.perfiles (organization_id, role);

-- DOWN: ver 20260516_003_down_add_indices_criticos.sql
