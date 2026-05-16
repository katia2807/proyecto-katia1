-- OLA 3: Validación de stock con control de concurrencia
-- Usa UPDATE ... WHERE stock >= X RETURNING * para race conditions.

CREATE OR REPLACE FUNCTION public.descontar_stock_seguro(
  p_producto_id  uuid,
  p_cantidad     numeric,
  p_org_id       uuid DEFAULT app.current_org_id()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resultado record;
BEGIN
  -- UPDATE atómico: solo descuenta si hay stock suficiente
  UPDATE public.inventario_productos
     SET stock_actual = stock_actual - p_cantidad,
         updated_at   = now()
   WHERE id = p_producto_id
     AND organization_id = p_org_id
     AND stock_actual >= p_cantidad
  RETURNING id, nombre, stock_actual INTO v_resultado;

  IF NOT FOUND THEN
    -- Verificar si el producto existe
    IF EXISTS (SELECT 1 FROM public.inventario_productos WHERE id = p_producto_id AND organization_id = p_org_id) THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto solicitado.';
    ELSE
      RAISE EXCEPTION 'Producto no encontrado.';
    END IF;
  END IF;

  -- Registrar movimiento
  INSERT INTO public.inventario_movimientos (
    organization_id, producto_id, tipo, cantidad, fecha, referencia
  ) VALUES (
    p_org_id, p_producto_id, 'salida_venta', p_cantidad, CURRENT_DATE, 'Descontado por venta'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'producto_id', p_producto_id,
    'stock_resultante', v_resultado.stock_actual
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al descontar stock: %', SQLERRM;
END;
$$;

-- DOWN: DROP FUNCTION IF EXISTS public.descontar_stock_seguro;
