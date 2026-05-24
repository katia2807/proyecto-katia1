ALTER TABLE inventario_productos
  ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NULL;
