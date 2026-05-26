-- Migration: Delete Alquiler Contrato RPC function
-- Description: Transactionally deletes the cash movements and the rental contract record.

CREATE OR REPLACE FUNCTION delete_alquiler_contrato_transaccional(p_id uuid, p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Delete associated cash movements
  DELETE FROM public.movimientos_caja
  WHERE referencia_id = p_id::text 
    AND organization_id = p_org_id;

  -- Delete the rental contract itself
  DELETE FROM public.alquileres
  WHERE id = p_id 
    AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
