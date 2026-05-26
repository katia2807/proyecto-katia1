-- Migration: Delete Servicio Aserradero RPC function
-- Description: Transactionally deletes the cash movement and the aserradero service record.

CREATE OR REPLACE FUNCTION delete_servicio_aserradero_transaccional(p_id uuid, p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete associated cash movements
  DELETE FROM public.movimientos_caja
  WHERE referencia_id = p_id::text 
    AND organization_id = p_org_id;

  -- Delete the service itself
  DELETE FROM public.servicios_aserradero
  WHERE id = p_id 
    AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
