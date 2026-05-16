-- ============================================================
-- MIGRACIÓN: Reset para entrega limpia + Función seed datos
-- ============================================================
-- Propósito: Dar al owner_admin una función RPC segura para
--            limpiar datos operativos antes de entregar al cliente,
--            y otra función para cargar datos de bienvenida (seed).
--
-- IMPORTANTE: Esta función NUNCA borra:
--   - Estructura de BD (tablas, funciones, índices)
--   - Usuarios, perfiles y roles
--   - Configuración de empresa (logo, nombre, etc.)
--   - Feature flags
--   - Plantillas y diccionarios
--   - system_events (log del reset queda registrado)
-- ============================================================

-- 1. Función de reset de datos operativos
CREATE OR REPLACE FUNCTION public.reset_datos_operativos(
  p_organization_id uuid,
  p_confirmacion text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tablas_limpiadas text[] := '{}';
  v_evento_id uuid;
BEGIN
  -- Validar confirmación
  IF p_confirmacion != 'RESETEAR' THEN
    RAISE EXCEPTION 'Confirmación inválida. Debes escribir exactamente: RESETEAR';
  END IF;

  -- Log previo al reset
  INSERT INTO public.system_events (organization_id, tipo, descripcion, metadata, created_by)
  VALUES (
    p_organization_id,
    'reset_datos_inicio',
    'Iniciando reset de datos operativos para entrega limpia',
    jsonb_build_object('user_id', p_user_id, 'timestamp', now()),
    p_user_id::text
  )
  RETURNING id INTO v_evento_id;

  -- Truncar tablas de datos operativos (orden respeta FKs)
  -- Tablas hijas primero
  DELETE FROM public.movimientos_caja WHERE organization_id = p_organization_id;
  v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'movimientos_caja');

  DELETE FROM public.audit_logs WHERE organization_id = p_organization_id;
  v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'audit_logs');

  DELETE FROM public.notifications WHERE organization_id = p_organization_id;
  v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'notifications');

  -- Cotizaciones
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotizaciones_unificadas') THEN
    DELETE FROM public.cotizaciones_unificadas WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'cotizaciones_unificadas');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotizaciones') THEN
    DELETE FROM public.cotizaciones WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'cotizaciones');
  END IF;

  -- Ventas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ventas_madera') THEN
    DELETE FROM public.ventas_madera WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'ventas_madera');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ventas_mueble_terminado') THEN
    DELETE FROM public.ventas_mueble_terminado WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'ventas_mueble_terminado');
  END IF;

  -- Alquileres
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alquileres') THEN
    DELETE FROM public.alquileres WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'alquileres');
  END IF;

  -- Servicios aserradero
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicios_aserradero') THEN
    DELETE FROM public.servicios_aserradero WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'servicios_aserradero');
  END IF;

  -- Ordenes de producción
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordenes_produccion') THEN
    DELETE FROM public.ordenes_produccion WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'ordenes_produccion');
  END IF;

  -- Cierres
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cierres_mes') THEN
    DELETE FROM public.cierres_mes WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'cierres_mes');
  END IF;

  -- Inventario (movimientos e items)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventario_movimientos') THEN
    DELETE FROM public.inventario_movimientos WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'inventario_movimientos');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventario_productos') THEN
    DELETE FROM public.inventario_productos WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'inventario_productos');
  END IF;

  -- Clientes y proveedores
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
    DELETE FROM public.clientes WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'clientes');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proveedores') THEN
    DELETE FROM public.proveedores WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'proveedores');
  END IF;

  -- Personal
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personal') THEN
    DELETE FROM public.personal WHERE organization_id = p_organization_id;
    v_tablas_limpiadas := array_append(v_tablas_limpiadas, 'personal');
  END IF;

  -- Log del reset completado
  INSERT INTO public.system_events (organization_id, tipo, descripcion, metadata, created_by)
  VALUES (
    p_organization_id,
    'reset_datos_completado',
    'Reset de datos operativos completado exitosamente',
    jsonb_build_object(
      'user_id', p_user_id,
      'tablas_limpiadas', v_tablas_limpiadas,
      'total_tablas', array_length(v_tablas_limpiadas, 1),
      'evento_inicio_id', v_evento_id
    ),
    p_user_id::text
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tablas_limpiadas', v_tablas_limpiadas,
    'total', array_length(v_tablas_limpiadas, 1)
  );

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.system_events (organization_id, tipo, descripcion, metadata, created_by)
  VALUES (
    p_organization_id,
    'reset_datos_error',
    'Error durante reset de datos operativos',
    jsonb_build_object('error', SQLERRM, 'user_id', p_user_id),
    p_user_id::text
  );
  RAISE;
END;
$$;

-- 2. Función para cargar datos seed de bienvenida
CREATE OR REPLACE FUNCTION public.seed_datos_bienvenida(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id uuid;
  v_producto_id uuid;
BEGIN
  -- Clientes de ejemplo
  INSERT INTO public.clientes (organization_id, nombre, tipo_persona, estado, created_by)
  VALUES
    (p_organization_id, 'Cliente Ejemplo Uno', 'persona', 'activo', p_user_id::text),
    (p_organization_id, 'Empresa Demo S.A.', 'empresa', 'activo', p_user_id::text),
    (p_organization_id, 'Cliente Frecuente', 'persona', 'vip', p_user_id::text)
  RETURNING id INTO v_cliente_id;

  -- Productos de ejemplo
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventario_productos') THEN
    INSERT INTO public.inventario_productos (organization_id, nombre, categoria, unidad, stock_actual, stock_minimo, precio_venta, created_by)
    VALUES
      (p_organization_id, 'Madera Cedro 2x4x8', 'madera', 'tablon', 50, 10, 35.00, p_user_id::text),
      (p_organization_id, 'Madera Tornillo 1x6x8', 'madera', 'tablon', 30, 5, 28.00, p_user_id::text),
      (p_organization_id, 'Clavos 4" galvanizados', 'insumos', 'kg', 20, 5, 12.00, p_user_id::text),
      (p_organization_id, 'Barniz transparente 1L', 'insumos', 'litro', 15, 3, 25.00, p_user_id::text),
      (p_organization_id, 'Lija grano 120 (pliego)', 'insumos', 'unidad', 100, 20, 1.50, p_user_id::text);
  END IF;

  -- Log del seed
  INSERT INTO public.system_events (organization_id, tipo, descripcion, metadata, created_by)
  VALUES (
    p_organization_id,
    'seed_datos_bienvenida',
    'Datos de bienvenida cargados para demo',
    jsonb_build_object('user_id', p_user_id),
    p_user_id::text
  );

  RETURN jsonb_build_object('ok', true, 'mensaje', 'Datos de bienvenida cargados correctamente');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- 3. Permisos: solo service role puede ejecutar estas funciones
REVOKE ALL ON FUNCTION public.reset_datos_operativos(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_datos_bienvenida(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_datos_operativos(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_datos_bienvenida(uuid, uuid) TO service_role;
