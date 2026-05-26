-- Transactional Deletes for Servicios Aserradero and Alquileres

CREATE OR REPLACE FUNCTION delete_servicio_aserradero_transaccional(p_id uuid, p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete cash movement first
  DELETE FROM public.movimientos_caja
  WHERE referencia_id = p_id::text 
    AND (modulo_origen = 'ventas_aserradero' OR modulo_origen = 'aserradero')
    AND organization_id = p_org_id;

  -- Delete aserradero service record
  DELETE FROM public.servicios_aserradero
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_alquiler_contrato_transaccional(p_id uuid, p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete cash movements first
  DELETE FROM public.movimientos_caja
  WHERE referencia_id = p_id::text 
    AND (modulo_origen = 'ventas_alquiler' OR modulo_origen = 'alquiler')
    AND organization_id = p_org_id;

  -- Delete rental contract record
  DELETE FROM public.alquileres
  WHERE id = p_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
