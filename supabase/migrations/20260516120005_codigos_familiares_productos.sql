-- OLA 0: Códigos familiares de producto
-- Esquema: [CAT]-[SUBCAT]-[YYMM]-[SEQ]
-- Ejemplo: MAD-ROB-2605-001 = Madera Roble Mayo 2026

-- Tabla de diccionario extensible para auto-generar códigos
CREATE TABLE IF NOT EXISTS public.codigo_producto_diccionario (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  termino         text NOT NULL,               -- "roble", "pino", "tornillo", etc.
  codigo_cat      char(3) NOT NULL,            -- "MAD", "TOR", "BAR", etc.
  codigo_subcat   char(3) NOT NULL,            -- "ROB", "PIN", "AUT", etc.
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codigo_dict_org
  ON public.codigo_producto_diccionario (organization_id, termino);

-- Semilla del diccionario (org por defecto del seed)
INSERT INTO public.codigo_producto_diccionario (organization_id, termino, codigo_cat, codigo_subcat) VALUES
  ('00000000-0000-0000-0000-000000000001', 'madera roble',         'MAD', 'ROB'),
  ('00000000-0000-0000-0000-000000000001', 'madera pino',          'MAD', 'PIN'),
  ('00000000-0000-0000-0000-000000000001', 'madera cedro',         'MAD', 'CED'),
  ('00000000-0000-0000-0000-000000000001', 'madera caoba',         'MAD', 'CAO'),
  ('00000000-0000-0000-0000-000000000001', 'madera eucalipto',     'MAD', 'EUC'),
  ('00000000-0000-0000-0000-000000000001', 'madera mdf',           'MAD', 'MDF'),
  ('00000000-0000-0000-0000-000000000001', 'madera triplay',       'MAD', 'TRI'),
  ('00000000-0000-0000-0000-000000000001', 'tornillo autorroscante','TOR', 'AUT'),
  ('00000000-0000-0000-0000-000000000001', 'tornillo hexagonal',   'TOR', 'HEX'),
  ('00000000-0000-0000-0000-000000000001', 'clavo',                'CLA', 'GEN'),
  ('00000000-0000-0000-0000-000000000001', 'tuerca',               'TUE', 'GEN'),
  ('00000000-0000-0000-0000-000000000001', 'arandela',             'ARA', 'GEN'),
  ('00000000-0000-0000-0000-000000000001', 'barniz poliuretanico', 'BAR', 'POL'),
  ('00000000-0000-0000-0000-000000000001', 'barniz nitro',         'BAR', 'NIT'),
  ('00000000-0000-0000-0000-000000000001', 'pintura latex',        'PIN', 'LAT'),
  ('00000000-0000-0000-0000-000000000001', 'pintura esmalte',      'PIN', 'ESM'),
  ('00000000-0000-0000-0000-000000000001', 'pegamento pvc',        'PEG', 'PVC'),
  ('00000000-0000-0000-0000-000000000001', 'pegamento carpintero',  'PEG', 'CAR'),
  ('00000000-0000-0000-0000-000000000001', 'mueble sala',          'MUE', 'SAL'),
  ('00000000-0000-0000-0000-000000000001', 'mueble dormitorio',    'MUE', 'DOR'),
  ('00000000-0000-0000-0000-000000000001', 'mueble cocina',        'MUE', 'COC'),
  ('00000000-0000-0000-0000-000000000001', 'mueble oficina',       'MUE', 'OFI'),
  ('00000000-0000-0000-0000-000000000001', 'servicio corte',       'SRV', 'COR'),
  ('00000000-0000-0000-0000-000000000001', 'servicio lijado',      'SRV', 'LIJ'),
  ('00000000-0000-0000-0000-000000000001', 'servicio instalacion', 'SRV', 'INS'),
  ('00000000-0000-0000-0000-000000000001', 'servicio pintura',     'SRV', 'PIN'),
  ('00000000-0000-0000-0000-000000000001', 'herramienta',          'HER', 'GEN'),
  ('00000000-0000-0000-0000-000000000001', 'accesorio',            'ACC', 'GEN')
ON CONFLICT DO NOTHING;

-- Columna codigo en inventario_productos (si aún no existe)
ALTER TABLE public.inventario_productos
  ADD COLUMN IF NOT EXISTS codigo text;

CREATE INDEX IF NOT EXISTS idx_inv_productos_codigo
  ON public.inventario_productos (organization_id, codigo) WHERE deleted_at IS NULL;

-- Función para generar código familiar desde nombre + organización
CREATE OR REPLACE FUNCTION public.generar_codigo_producto(
  p_org_id    uuid,
  p_nombre    text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre_lower text;
  v_cat          char(3);
  v_subcat       char(3);
  v_yymm         text;
  v_seq          integer;
  v_codigo       text;
BEGIN
  v_nombre_lower := lower(trim(p_nombre));

  -- Buscar en diccionario (coincidencia parcial)
  SELECT codigo_cat, codigo_subcat
    INTO v_cat, v_subcat
    FROM public.codigo_producto_diccionario
   WHERE organization_id = p_org_id
     AND v_nombre_lower LIKE '%' || termino || '%'
   ORDER BY length(termino) DESC
   LIMIT 1;

  -- Fallback: tomar primeras 3 consonantes del nombre
  IF v_cat IS NULL THEN
    v_cat    := upper(substr(regexp_replace(v_nombre_lower, '[aeiou\s]', '', 'gi'), 1, 3));
    v_subcat := upper(substr(regexp_replace(v_nombre_lower, '[aeiou\s]', '', 'gi'), 4, 3));
    IF length(v_cat) < 3    THEN v_cat    := rpad(v_cat, 3, 'X'); END IF;
    IF length(v_subcat) < 3 THEN v_subcat := rpad(v_subcat, 3, 'X'); END IF;
  END IF;

  v_yymm := to_char(now(), 'YYMM');

  -- Secuencia dentro de cat+subcat+yymm para esta org
  SELECT COALESCE(MAX(
    CAST(
      regexp_replace(codigo, '^[A-Z]{3}-[A-Z]{3}-\d{4}-(\d{3})$', '\1')
    AS integer)
  ), 0) + 1
    INTO v_seq
    FROM public.inventario_productos
   WHERE organization_id = p_org_id
     AND codigo ~ ('^' || v_cat || '-' || v_subcat || '-' || v_yymm || '-\d{3}$');

  v_codigo := v_cat || '-' || v_subcat || '-' || v_yymm || '-' || lpad(v_seq::text, 3, '0');
  RETURN v_codigo;
END;
$$;

-- Política RLS para el diccionario
ALTER TABLE public.codigo_producto_diccionario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "codigo_dict_org_select" ON public.codigo_producto_diccionario
  FOR SELECT USING (organization_id = app.current_org_id());

CREATE POLICY "codigo_dict_org_insert" ON public.codigo_producto_diccionario
  FOR INSERT WITH CHECK (organization_id = app.current_org_id());

CREATE POLICY "codigo_dict_org_update" ON public.codigo_producto_diccionario
  FOR UPDATE USING (organization_id = app.current_org_id());

-- DOWN: ver 20260516_005_down_codigos_familiares_productos.sql
