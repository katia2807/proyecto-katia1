# Glosario de términos — Katia Suite

Regla: cada label debe ser obvio para alguien que nunca abrió el sistema.
Este archivo es la fuente de verdad para toda etiqueta de UI, columna de tabla, categoría y botón.

## Módulos (nombres definitivos)

| Nombre anterior         | Nombre nuevo       | Ruta            | Notas                                              |
|-------------------------|--------------------|------------------|----------------------------------------------------|
| "ERP Katia" / "ERP KATIA" | **Katia Suite**  | —               | Rebrand completo                                   |
| "Panel Gerencial"       | **Centro de Mando**| `/gerencial`    | Panel del dueño con sub-pestañas                   |
| "Inicio"                | **Inicio**         | `/`             | Dashboard operativo del día                         |
| "Bitacora"              | **Registro**       | `/registro`     | Registro general de actividades                     |
| "Panel Gerencial"       | **Centro de Mando**| `/gerencial`    | —                                                  |
| "Cuenta admin"          | **Mi cuenta**      | `/cuenta`       | Preferencias personales del usuario                 |
| "Control socios"        | **Control**        | `/reportes/antifraude` | Sub-pestaña de Reportes, no top-level       |
| "Seguridad"             | **Seguridad**      | `/seguridad`    | Sub-pestaña de Mi cuenta en fase 2                  |
| "Alquiler Mixer"        | **Alquiler Mixer** | `/ventas/alquiler-mixer` | Sin cambios                                |
| "Importar"              | **Importar datos** | `/admin/importar` | Más descriptivo                                  |

## Secciones del sidebar (nombres definitivos)

| Anterior       | Nuevo               | Items                                        |
|----------------|---------------------|----------------------------------------------|
| GENERAL        | OPERACIÓN DIARIA    | Inicio, Caja, Ventas, Cotizaciones           |
| VENTAS         | (fusionado arriba)  | —                                            |
| — (nuevo)      | CATÁLOGO            | Inventario, Clientes                         |
| ADMIN          | (dividido)          | —                                            |
| CONTROL        | GESTIÓN             | Centro de Mando, Reportes, Control, Registro |
| (parte de ADMIN/CONTROL) | CONFIGURACIÓN | Empresa, Respaldo, Usuarios, Mi cuenta, Importar |

## Etiquetas de estado (términos del negocio, no técnicos)

| Término técnico              | Término del cliente       |
|------------------------------|---------------------------|
| "borrador"                   | **En borrador**           |
| "confirmado"                 | **Confirmado**            |
| "cerrado"                    | **Cerrado**               |
| "cobrada"                    | **Cobrado**               |
| "Ventas por confirmar"       | **Ventas en borrador**    |
| "Penalidades activas"        | **Sanciones aplicadas**   |
| "Adelantos pendientes"       | **Anticipos por aplicar** |
| "Alertas críticas"           | **Alertas**               |
| "Alertas operativas"         | (eliminado, confunde)     |
| "Ingresos del período"       | **Ingresos del mes**      |
| "Egresos del período"        | **Egresos del mes**       |
| "Empleados activos"          | (eliminado de Inicio)     |

## Categorías de caja (humanizadas)

| Categoría técnica          | Categoría visible          |
|----------------------------|----------------------------|
| `ventas_pdf`               | Venta de madera            |
| `servicio_corte_mueble`    | Servicio de corte          |
| `compra_inventario`        | Compra a proveedor         |
| `alquiler_bomba_mixer`     | Alquiler de mixer          |
| `nomina`                   | Pago de nómina             |
| `adelanto_personal`        | Adelanto de sueldo         |

## Campos de formulario (nomenclatura unificada)

| Campo técnico              | Label visible en UI        |
|----------------------------|----------------------------|
| `precio_venta`             | Precio de venta            |
| `precio_costo`             | Costo de adquisición       |
| `stock_actual`             | Stock actual               |
| `stock_minimo`             | Stock mínimo de alerta     |
| `organization_id`          | (nunca visible en UI)      |
| `deleted_at`               | (nunca visible en UI)      |
| `ui_role`                  | Tipo de acceso             |
| `created_at`               | Fecha de registro          |

## Roles de usuario (cómo mostrarlos)

| Rol interno        | Etiqueta visible        |
|--------------------|-------------------------|
| `owner` / `owner_admin` | Dueño / Administrador |
| `operaciones` / `gerencia` | Gerencia          |
| `vendedor`         | Vendedor                |
| `almacen`          | Almacén                 |
| `caja`             | Cajero                  |
| `readonly`         | Solo lectura            |
