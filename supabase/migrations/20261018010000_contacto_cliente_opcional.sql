-- Datos opcionales de contacto del cliente; no modifica cálculos ni operaciones.
-- Aplicar antes de desplegar el formulario que usa estos datos.
BEGIN;
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS datos_adicionales jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_datos_adicionales_objeto;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_datos_adicionales_objeto CHECK (
    jsonb_typeof(datos_adicionales) = 'object'
    AND octet_length(datos_adicionales::text) <= 12000
    AND CASE WHEN datos_adicionales ? 'cuentas_bancarias'
      THEN CASE WHEN jsonb_typeof(datos_adicionales->'cuentas_bancarias') = 'array'
        THEN jsonb_array_length(datos_adicionales->'cuentas_bancarias') <= 5 ELSE false END
      ELSE true END
  );
COMMENT ON COLUMN public.clientes.datos_adicionales IS
  'Correo y cuentas bancarias de referencia, confirmados por el usuario. No contiene PDF ni texto extraído.';
COMMIT;
