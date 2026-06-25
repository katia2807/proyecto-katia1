ALTER TABLE public.ventas_madera_cortada
  ADD COLUMN IF NOT EXISTS cantidad_piezas numeric(14,4),
  ADD COLUMN IF NOT EXISTS precio_unitario_comercial numeric(12,2);

COMMENT ON COLUMN public.ventas_madera_cortada.cantidad_piezas
  IS 'Cantidad comercial de piezas usada para el comprobante de madera cortada/aserrada.';

COMMENT ON COLUMN public.ventas_madera_cortada.precio_unitario_comercial
  IS 'Precio unitario comercial por pieza usado para calcular el total cobrado.';
