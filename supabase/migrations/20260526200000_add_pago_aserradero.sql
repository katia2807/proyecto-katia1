-- Agrega campos de pago/adelanto a servicios_aserradero
-- para paridad con otros módulos de ventas
ALTER TABLE public.servicios_aserradero
  ADD COLUMN IF NOT EXISTS metodo_pago text
    DEFAULT 'efectivo'
    CHECK (metodo_pago IN ('efectivo', 'yape', 'transferencia', 'billetera_digital', 'otro')),
  ADD COLUMN IF NOT EXISTS modalidad_pago text
    DEFAULT 'contado'
    CHECK (modalidad_pago IN ('contado', 'adelanto', 'credito')),
  ADD COLUMN IF NOT EXISTS fecha_pago_credito date,
  ADD COLUMN IF NOT EXISTS adelanto numeric(12,2) DEFAULT 0 CHECK (adelanto >= 0);

COMMENT ON COLUMN public.servicios_aserradero.metodo_pago IS 'Medio de pago: efectivo, yape, transferencia, etc.';
COMMENT ON COLUMN public.servicios_aserradero.modalidad_pago IS 'Modalidad de pago: contado, adelanto o crédito.';
COMMENT ON COLUMN public.servicios_aserradero.fecha_pago_credito IS 'Fecha límite si la modalidad es crédito.';
COMMENT ON COLUMN public.servicios_aserradero.adelanto IS 'Monto de adelanto registrado en caja al crear el servicio.';
