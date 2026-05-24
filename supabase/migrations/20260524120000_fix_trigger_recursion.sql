-- Sincronización de base de datos - Prevención de bucles infinitos en triggers
-- Añade guardias contra la recursividad infinita (pg_trigger_depth())

CREATE OR REPLACE FUNCTION sync_inventario_to_catalogo()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el trigger ya fue disparado de forma indirecta por otra actualización (profundidad > 1), abortar ejecución anidada.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.categoria = 'Muebles' THEN
    INSERT INTO public.muebles_catalogo (
      id, organization_id, codigo, nombre, descripcion,
      precio_lista, stock_disponible, foto_url, activo, created_at
    )
    VALUES (
      NEW.id, NEW.organization_id, NEW.codigo, NEW.nombre,
      'Producto importado del inventario',
      0, NEW.stock_actual, NEW.foto_url, NEW.activo, NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nombre = EXCLUDED.nombre,
      stock_disponible = EXCLUDED.stock_disponible,
      foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), muebles_catalogo.foto_url),
      activo = EXCLUDED.activo
    WHERE (
      muebles_catalogo.codigo IS DISTINCT FROM EXCLUDED.codigo OR
      muebles_catalogo.nombre IS DISTINCT FROM EXCLUDED.nombre OR
      muebles_catalogo.stock_disponible IS DISTINCT FROM EXCLUDED.stock_disponible OR
      muebles_catalogo.foto_url IS DISTINCT FROM COALESCE(NULLIF(EXCLUDED.foto_url, ''), muebles_catalogo.foto_url) OR
      muebles_catalogo.activo IS DISTINCT FROM EXCLUDED.activo
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_catalogo_to_inventario()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el trigger ya fue disparado de forma indirecta por otra actualización (profundidad > 1), abortar ejecución anidada.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inventario_productos (
    id, organization_id, codigo, nombre, categoria, unidad, stock_actual, stock_minimo, activo, created_at, foto_url
  )
  VALUES (
    NEW.id, NEW.organization_id, NEW.codigo, NEW.nombre, 'Muebles', 'unidad', NEW.stock_disponible, 0, NEW.activo, NEW.created_at, NEW.foto_url
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    codigo = EXCLUDED.codigo,
    foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), inventario_productos.foto_url),
    activo = EXCLUDED.activo
  WHERE (
    inventario_productos.nombre IS DISTINCT FROM EXCLUDED.nombre OR
    inventario_productos.codigo IS DISTINCT FROM EXCLUDED.codigo OR
    inventario_productos.foto_url IS DISTINCT FROM COALESCE(NULLIF(EXCLUDED.foto_url, ''), inventario_productos.foto_url) OR
    inventario_productos.activo IS DISTINCT FROM EXCLUDED.activo
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
