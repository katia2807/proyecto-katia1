# Katia Suite — Changelog v1.0.0

**Fecha de entrega:** 26 de mayo 2026  
**Para:** Cliente final  
**Equipo:** Desarrollo Katia Suite

---

## ¿Qué cambió en esta versión?

Esta es la primera versión completa y profesional del sistema. Fue diseñada para que se sienta como un **producto terminado**, no como una demo.

---

## Módulos disponibles

### Centro de Mando
El panel principal ahora tiene 5 secciones organizadas:
- **Hoy**: Ingresos del día vs ayer, lista de pendientes urgentes (stock bajo, cobros vencidos, ventas por confirmar) y atajos rápidos.
- **Pasado**: Historial mensual con comparativos, top productos y top clientes.
- **Futuro**: Cotizaciones por cerrar y stock valorizado.
- **Clientes 360°**: Vista completa de cada cliente sin salir del panel.
- **Herramientas**: Accesos directos a las acciones más comunes.

### Ventas
- 5 flujos de venta completos: muebles terminados, muebles personalizados, madera cortada, alquiler de Mixer y servicio de aserradero.
- Registro de clientes rápido desde cualquier flujo de venta.
- Ventas con estado: borrador → confirmado → entregado.

### Cotizaciones
- Documentos internos privados (sin referencias fiscales ni SUNAT).
- Flujo completo: crear → enviar → cobrar.
- Correlativo automático.
- Confirmación atómica: al cobrar una cotización, el movimiento de caja se crea automáticamente.

### Caja
- Separación clara entre movimientos de empresa y personales.
- Balance en tiempo real en el encabezado de la página.
- Categorías y medio de pago.

### Inventario
- Stock en tiempo real con alerta automática de stock mínimo.
- Códigos de producto automáticos (prefijo por familia: MAD-, MBL-, INS-, etc.).
- Exportación a Excel profesional con múltiples hojas y formato.
- Kardex de movimientos trazable.

### Clientes
- Ficha completa con historial de operaciones.
- Búsqueda por nombre, teléfono o documento.
- Estados: activo, inactivo, vip.

### Reportes
- Exportación Excel multi-hoja (toda la operación).
- Movimientos de caja auditables.
- Cobros vencidos.
- Utilidad neta mensual.
- Cierres firmados con hash SHA-256.
- Módulo de auditoría antifraude (acceso restringido).

### Configuración
- Cuenta, empresa, preferencias en una sola pantalla.
- Datos del emisor para cotizaciones y documentos.
- Logo en documentos.

---

## Mejoras técnicas (invisible para el usuario)

- **Transacciones atómicas**: cerrar venta, anular venta y confirmar cotización son operaciones que no pueden quedar a medias.
- **Control de concurrencia en stock**: dos vendedores no pueden descontar el mismo producto simultáneamente.
- **Soft delete**: los registros eliminados no se borran físicamente, se archivan.
- **Audit log**: registro trazable de acciones críticas (quién hizo qué y cuándo).
- **Notificaciones in-app**: alertas automáticas por stock bajo, cobros vencidos, etc.
- **Búsqueda global**: busca clientes, productos y cotizaciones desde la barra superior.
- **Tema oscuro y claro**: cambia con el ícono ☀️/🌙 o automáticamente por hora del día.
- **Responsive**: funciona en tablet y celular.
- **Onboarding tour**: guía de 6 pasos al primer ingreso.
- **Páginas de error**: 404 y errores de sistema con mensajes claros.
- **Health check**: `/api/health` para monitoreo del sistema.

---

## Próximas mejoras (v1.1 — Backlog)

Estas funciones están planeadas pero NO forman parte de esta entrega:

- Mermas y conversión de unidades en inventario
- Ventas a crédito con plan de pagos
- Devoluciones y notas de crédito
- Órdenes de compra a proveedores
- Lectura de código de barras
- Multi-pago (efectivo + transferencia en una sola venta)
- Email transaccional para cotizaciones
- Reportes de nómina completos
- Exportación de cotizaciones a PDF mejorado

---

## Cómo usar el sistema

Consulta el **Manual de usuario** dentro del sistema: ve a **Ayuda** en el menú lateral.

---

*Katia Suite v1.0.0 — Entregado el 26 de mayo 2026*
