-- Migration to add tipo_comprobante to movimientos_caja table
ALTER TABLE public.movimientos_caja ADD COLUMN IF NOT EXISTS tipo_comprobante text DEFAULT 'ninguno' CHECK (tipo_comprobante IN ('factura', 'boleta', 'ninguno'));
