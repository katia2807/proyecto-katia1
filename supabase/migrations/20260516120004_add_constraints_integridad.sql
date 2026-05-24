-- OLA 0: Constraints de integridad
-- Precio >= 0, stock >= 0, estados válidos donde sea posible.

-- inventario_productos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_actual_no_negativo') THEN
    ALTER TABLE public.inventario_productos ADD CONSTRAINT chk_stock_actual_no_negativo CHECK (stock_actual >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_minimo_no_negativo') THEN
    ALTER TABLE public.inventario_productos ADD CONSTRAINT chk_stock_minimo_no_negativo CHECK (stock_minimo >= 0);
  END IF;
END $$;

-- movimientos_caja
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_monto_positivo') THEN
    ALTER TABLE public.movimientos_caja ADD CONSTRAINT chk_monto_positivo CHECK (monto > 0);
  END IF;
END $$;

-- ventas_madera
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ventas_madera_total_positivo'
  ) THEN
    ALTER TABLE public.ventas_madera
      ADD CONSTRAINT chk_ventas_madera_total_positivo CHECK (total >= 0);
  END IF;
END
$$;

-- alquileres
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_alquileres_tarifa_positiva'
  ) THEN
    ALTER TABLE public.alquileres
      ADD CONSTRAINT chk_alquileres_tarifa_positiva CHECK (tarifa >= 0);
  END IF;
END
$$;

-- clientes: estado solo valores permitidos (si no existe ya)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_clientes_estado_valido'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT chk_clientes_estado_valido
      CHECK (estado IS NULL OR estado IN ('activo', 'inactivo', 'moroso', 'vip'));
  END IF;
END
$$;

-- DOWN: ver 20260516_004_down_add_constraints_integridad.sql
