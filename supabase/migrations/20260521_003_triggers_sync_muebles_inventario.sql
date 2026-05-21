-- Trigger 1: inventario -> catalogo
CREATE OR REPLACE FUNCTION sync_inventario_to_catalogo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria = 'Muebles' THEN
    INSERT INTO public.muebles_catalogo (
      id, organization_id, codigo, nombre, descripcion,
      precio_lista, stock_disponible, activo, created_at
    )
    VALUES (
      NEW.id, NEW.organization_id, NEW.codigo, NEW.nombre,
      COALESCE(NEW.descripcion, 'Producto importado del inventario'),
      0, NEW.stock_actual, NEW.activo, NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nombre = EXCLUDED.nombre,
      stock_disponible = EXCLUDED.stock_disponible,
      activo = EXCLUDED.activo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_sync_inventario_to_catalogo
AFTER INSERT OR UPDATE ON public.inventario_productos
FOR EACH ROW EXECUTE FUNCTION sync_inventario_to_catalogo();

-- Trigger 2: catalogo -> inventario
CREATE OR REPLACE FUNCTION sync_catalogo_to_inventario()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inventario_productos SET
    nombre = NEW.nombre,
    codigo = NEW.codigo,
    activo = NEW.activo
  WHERE id = NEW.id
    AND organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_sync_catalogo_to_inventario
AFTER UPDATE ON public.muebles_catalogo
FOR EACH ROW EXECUTE FUNCTION sync_catalogo_to_inventario();

-- Trigger 3: descuento stock al vender
CREATE OR REPLACE FUNCTION descontar_stock_venta_mueble()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.muebles_catalogo
  SET stock_disponible = stock_disponible - NEW.cantidad
  WHERE id = NEW.mueble_catalogo_id;

  UPDATE public.inventario_productos
  SET stock_actual = stock_actual - NEW.cantidad
  WHERE id = NEW.mueble_catalogo_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_descontar_stock_venta_mueble
AFTER INSERT ON public.ventas_mueble_terminado
FOR EACH ROW EXECUTE FUNCTION descontar_stock_venta_mueble();
