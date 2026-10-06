# Revisión de Inventario — 05/10/2026

Base funcional: 1.1.38, commit `bcdc338`. Estado: diagnóstico terminado; incidencias pendientes de corrección. Este informe no representa una actualización funcional de Inventario.

## Alcance y límites

Se revisó el código de carga de datos, productos, resumen, movimientos y exportación, y se consultó la copia local aislada en el navegador. Se probaron filtros, selección de productos, recarga, pestañas y anchos de celular; no se guardaron compras, productos, movimientos o conteos ni se ejecutaron eliminaciones.

No se abrió Inventario en producción tras detectar I1: consultar esa ruta puede ejecutar escrituras. Los problemas de carga y sincronización se documentan por inspección del código, sin reproducirlos contra la base del negocio. Los productos de la copia local no permiten concluir que las cantidades reales estén mal.

## Correcciones prioritarias

### I1 — Consulta del catálogo con escrituras automáticas

**Prioridad alta; detectado en código.** `getMueblesCatalogoRows` en `lib/data.ts` crea registros y actualiza stock, fotos y precio durante una consulta. En particular asigna `precio_lista = costo_unitario` cuando encuentra diferencias: puede reemplazar un precio de venta por un costo sin que la persona pulse Guardar. La función también se usa en el listado de Ventas; no es un problema exclusivo de la pantalla Inventario.

Corregir primero esa ruta de lectura. Conservar la sincronización necesaria en los puntos de guardado que corresponda, verificando sus efectos y permisos; no retirar por completo una sincronización útil ni reparar precios históricos automáticamente. La separación entre costo y precio de venta debe mantenerse. La existencia de esta rutina no prueba que un registro concreto del negocio haya sido modificado durante esta revisión.

### I2 — Indicadores con un significado incorrecto

**Prioridad alta; confirmado en código y pantalla.** “Ganancias del mes (ventas)” suma cantidades por `costo_unitario` de salidas; no resta costos a ingresos, por lo que no representa ganancia. “Stock total” agrega productos de unidades distintas —por ejemplo unidades, cajas y latas— y lo presenta como unidades acumuladas.

Corregir el significado o el texto de los indicadores, sin inventar rentabilidad ni conversiones. El valor del inventario se obtiene del promedio de entradas con costo; un costo aislado guardado en el producto no sustituye actualmente esa fuente. Distinguir valor registrado de valor desconocido cuando falte información.

### I3 — Recortes en celular

**Prioridad media; reproducido en local.** En Productos, una pantalla útil de 310 píxeles produce contenido de 362 píxeles. En Kardex, una tabla de unos 725 píxeles queda dentro de un contenedor de 274 con `overflow: hidden`: las columnas de cantidad, impacto, referencia y acción no son accesibles mediante desplazamiento horizontal del contenedor.

Corregir anchos mínimos y permitir desplazamiento dentro de la tabla, conservando columnas y acciones. El resumen probado a 360 píxeles no ensancha la página; no aplicar cambios generales donde el diseño ya funciona.

### I4 — Fecha inicial adelantada por la zona horaria

**Prioridad media; reproducido en local y confirmado en código.** A las 20:15 del 05/10/2026 en Perú, compra y movimiento mostraban 06/10/2026. El valor inicial usa `new Date().toISOString().split("T")[0]`, que toma el día UTC.

Usar el día de Perú para el valor inicial y conservar las fechas ya guardadas. No desplazar ni reescribir registros existentes para corregir el formulario.

### I5 — Acciones para varios productos sin operación conectada

**Prioridad media; confirmado en código y pantalla.** Al seleccionar un producto aparecen Desactivar, Exportar y Ajustar stock. Los tres botones de esa barra no tienen manejador ni acción asociada; Exportar se pulsó en local y no produjo ningún resultado.

Retirar o presentar como no disponibles esas acciones incompletas, manteniendo la edición y las acciones individuales que ya funcionan. No desarrollar nuevas operaciones masivas como parte de una corrección de diseño sin que el usuario lo pida.

### I6 — Búsqueda que se pierde al recargar

**Prioridad media; reproducido en local.** Buscar “Tornillo” mostró dos productos. Tras recargar la misma ruta, la búsqueda quedó vacía y aparecieron los cuatro productos de prueba. Los filtros se guardan solo en el estado del componente; la URL conserva únicamente la pestaña.

Conservar la búsqueda y los filtros relevantes cuando se recarga o se regresa, sin cambiar el resultado de filtrado que ya funciona.

## Otros detalles delimitados para una siguiente pasada

- **Historial parcial en Kardex (código):** se piden hasta 5.000 movimientos sin recorrer páginas y la pantalla muestra solo los primeros 200 del filtro. Falta comunicar o gestionar la parte restante. No se reprodujo con miles de registros reales.
- **Nombre de exportación (código):** los botones dicen CSV, pero la ruta genera Excel `.xlsx`. Además, el enlace del Kardex no transmite sus filtros. Revisar texto y alcance de exportación sin cambiar silenciosamente el formato existente.
- **Alertas sin movimientos (código):** los productos sin ningún movimiento se consideran inactivos por más de 30 días aunque su antigüedad no se evalúa, y el texto puede mostrar una cantidad de días vacía. Distinguir “Sin movimientos registrados” de una inactividad comprobada.

## Qué no cambiar por este diagnóstico

La búsqueda sí filtra los productos y las alertas locales coinciden con los mínimos de esa copia. El registro de conteo físico ya existe. Mantener esas operaciones y no añadir otro flujo de trabajo. No declarar correctas todas las escrituras ni todos los datos reales: esa verificación no se realizó.

## Próximo paso

Comenzar por I1 en local, con pruebas que comprueben que leer no inserta ni actualiza datos y que el precio de venta se conserva. Revisar después los puntos de guardado relacionados para mantener la sincronización necesaria. Actualizar este informe al resolver cada incidencia, con versión y comprobación efectuada.
