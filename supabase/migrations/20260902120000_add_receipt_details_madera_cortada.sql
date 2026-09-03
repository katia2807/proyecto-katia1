-- Conserva el detalle comercial exacto para que todos los formatos de
-- comprobante impriman la misma venta sin volver a calcularla.
ALTER TABLE public.ventas_madera_cortada
  ADD COLUMN IF NOT EXISTS lineas_comprobante jsonb
    NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(lineas_comprobante) = 'array'),
  ADD COLUMN IF NOT EXISTS tipo_comprobante text
    NOT NULL DEFAULT 'ninguno'
    CHECK (tipo_comprobante IN ('boleta', 'factura', 'ninguno'));

COMMENT ON COLUMN public.ventas_madera_cortada.lineas_comprobante
  IS 'Copia comercial: descripción, cantidad, unidad, medidas, precio unitario y subtotal registrados para impresión.';

COMMENT ON COLUMN public.ventas_madera_cortada.tipo_comprobante
  IS 'Tipo de documento elegido al registrar la venta; prevalece en reimpresiones.';
