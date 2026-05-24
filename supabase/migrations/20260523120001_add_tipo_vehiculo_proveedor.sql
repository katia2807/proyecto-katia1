-- Migration: Add tipo_vehiculo to choferes and tipo_proveedor to proveedores
ALTER TABLE choferes ADD COLUMN tipo_vehiculo TEXT NULL;
ALTER TABLE proveedores ADD COLUMN tipo_proveedor TEXT NULL;
