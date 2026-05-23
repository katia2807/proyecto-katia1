-- Migration: Create unidades_medida table and set up RLS policies
CREATE TABLE unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_org_nombre UNIQUE(organization_id, nombre)
);

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Organization Select" ON unidades_medida
  FOR SELECT TO authenticated USING (organization_id = (SELECT organization_id FROM perfiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow Organization Insert" ON unidades_medida
  FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT organization_id FROM perfiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Allow Organization Update" ON unidades_medida
  FOR UPDATE TO authenticated USING (organization_id = (SELECT organization_id FROM perfiles WHERE user_id = auth.uid() LIMIT 1));

-- Ensure costo_unitario exists on inventario_productos
ALTER TABLE public.inventario_productos ADD COLUMN IF NOT EXISTS costo_unitario numeric(12,2) NULL;
