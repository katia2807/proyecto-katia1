# Revisión de Inventario — 05/10/2026

Base del diagnóstico: 1.1.38, commit `bcdc338`. Actualizado el 06/10/2026: I1–I11 se publicaron en 1.1.47, commit `cfd7ef3`, y se comprobaron sus pantallas y filtros en producción mediante lectura. Registro 1.1.49: el Excel real de stock se abrió y verificó, y el usuario confirmó la descarga de Kardex; no se inspeccionó el contenido de este último. Se conserva el diagnóstico original debajo de cada corrección para distinguir la base del resultado comprobado.

## Alcance y límites

Se revisó el código de carga de datos, productos, resumen, movimientos y exportación, y se consultó la copia local aislada en el navegador. Se probaron filtros, selección de productos, recarga, pestañas y anchos de celular; no se guardaron compras, productos, movimientos o conteos ni se ejecutaron eliminaciones.

No se abrió Inventario en producción tras detectar I1: consultar esa ruta puede ejecutar escrituras. Los problemas de carga y sincronización se documentan por inspección del código, sin reproducirlos contra la base del negocio. Los productos de la copia local no permiten concluir que las cantidades reales estén mal.

## Correcciones prioritarias

### I1 — Consulta del catálogo con escrituras automáticas

**Prioridad alta; detectado en código.** `getMueblesCatalogoRows` en `lib/data.ts` crea registros y actualiza stock, fotos y precio durante una consulta. En particular asigna `precio_lista = costo_unitario` cuando encuentra diferencias: puede reemplazar un precio de venta por un costo sin que la persona pulse Guardar. La función también se usa en el listado de Ventas; no es un problema exclusivo de la pantalla Inventario.

Corregir primero esa ruta de lectura. Conservar la sincronización necesaria en los puntos de guardado que corresponda, verificando sus efectos y permisos; no retirar por completo una sincronización útil ni reparar precios históricos automáticamente. La separación entre costo y precio de venta debe mantenerse. La existencia de esta rutina no prueba que un registro concreto del negocio haya sido modificado durante esta revisión.

**Corrección local — 06/10/2026, 1.1.40.** `getMueblesCatalogoRows` consulta exclusivamente el catálogo, con los filtros de empresa y activos anteriores. Su equivalente demo tampoco persiste ni modifica registros. Se retiró además la copia de costo hacia precio en `updateInventarioProducto` y de precio hacia costo en `updateMuebleCatalogo`; stock y fotos siguen actualizándose al guardar. Las migraciones de sincronización existentes se conservan, sin cambios ni ejecución en Supabase.

En demo, la provisión de muebles se ejecuta al crear o guardar el producto; entradas y reversiones mantienen el stock del catálogo al guardar. Una venta local descuenta ambos stocks y una recarga no revierte ese descuento. Un mueble nuevo no hereda su precio de venta del costo, ni un costo inventado del precio: se usa el editor de precio existente.

**Comprobaciones realizadas:** 26 pruebas relacionadas aprobadas (13 nuevas y 13 existentes). Incluyen consulta repetida y fallida sin escrituras, registros con costo distinto del precio, filtros de activos y empresa, guardados independientes, fotos y stock, usuario de solo lectura, provisión local, entrada/reversión y venta local. Se usa el SDK real con respuestas en memoria y persistencia demo reemplazada; no prueban los triggers contra PostgreSQL real. La corrección no repara automáticamente registros históricos ni confirma qué precios reales pudieron ser afectados antes.

La regresión completa pasó con 486 pruebas; tipos de aplicación y pruebas y compilación optimizada también pasaron. ESLint no encontró errores y conservó seis advertencias anteriores. En el navegador, consultar y recargar Inventario y Ventas dejó idéntica la copia del archivo de datos. Se guardó explícitamente un precio de S/ 720 en un mueble sintético desde el editor existente, conservando costo S/ 250 y stock 8; al recargar no cambió el archivo. Sin errores de consola en el recorrido. El archivo original mantuvo su huella. Evidencias locales: `temp/inventario-1.1.40-tests.log`, `temp/inventario-1.1.40-build.log`, `temp/inventario-1.1.40-local.jpg` y logs del servidor con ese prefijo.

### I2 — Indicadores con un significado incorrecto

**Prioridad alta; confirmado en código y pantalla.** “Ganancias del mes (ventas)” suma cantidades por `costo_unitario` de salidas; no resta costos a ingresos, por lo que no representa ganancia. “Stock total” agrega productos de unidades distintas —por ejemplo unidades, cajas y latas— y lo presenta como unidades acumuladas.

Corregir el significado o el texto de los indicadores, sin inventar rentabilidad ni conversiones. El valor del inventario se obtiene del promedio de entradas con costo; un costo aislado guardado en el producto no sustituye actualmente esa fuente. Distinguir valor registrado de valor desconocido cuando falte información.

**Corrección local — 06/10/2026, 1.1.41.** El resumen muestra “Stock por unidad” para productos activos, sin mezclar cajas, latas, unidades, PT o m3. Solo se normalizan espacios y mayúsculas de la etiqueta; no se convierten medidas ni se modifican cantidades guardadas. “Ganancias del mes” se sustituye por “Costo de salidas del mes”: suma costos registrados de las salidas de venta cargadas del mes de Perú, sin inventar ingresos ni utilidad. Distingue costo cero explícito de costo ausente.

"Valor registrado del stock" conserva la fuente de costo promedio de compras, pero informa cuántos productos con stock carecen de ese costo. Si no hay valores conocidos, muestra "Sin costo en compras"; si hay una parte conocida, señala que es parcial. El listado de productos, su detalle y el encabezado del editor usan también "Sin costo en compras" para no presentar como S/ 0.00 una valorización desconocida. No se usa el precio de venta ni un costo aislado del producto para completar el promedio.

**Comprobaciones realizadas:** 20 pruebas relacionadas aprobadas, incluidas 10 nuevas de resumen y presentación. Cubren unidades distintas, cantidades fraccionadas, activos, falta de costo, importes parciales, cero explícito, mes de Perú y datos sin modificaciones. Tipos de aplicación y pruebas aprobados; ESLint sin errores, con una advertencia anterior de imagen en Inventario. La fecha inicial de los formularios sigue pendiente en I4; el ajuste del mes de este indicador no la corrige.

En el navegador local, el resumen mostró 8 cajas, 3 latas y 60 unidades separadas; valor conocido de S/ 1,596.00 y aviso de cuatro productos con stock sin costo en compras. El listado mantuvo los valores conocidos y señaló los desconocidos. Se abrió el editor sin guardar y se detectó y corrigió su texto anterior de S/ 0.00; tras recompilar, el encabezado mostró “Sin costo en compras”. El resumen no ensanchó la página a 320 ni 360 píxeles; los recortes de I3 en otras pestañas siguen pendientes. Las consultas conservaron idénticos el archivo original y la copia aislada. Sin errores ni advertencias de consola en el recorrido.

Compilación optimizada aprobada; tipos y ESLint repetidos tras el último ajuste del editor. Evidencias locales: `temp/inventario-1.1.41-build.log`, `temp/inventario-1.1.41-local.jpg` y logs del servidor con ese prefijo. Nota de parche de 222 caracteres coincidente con el aviso y el historial. Sin publicación ni verificación en producción en esta corrección.

### I3 — Recortes en celular

**Prioridad media; reproducido en local.** En Productos, una pantalla útil de 310 píxeles produce contenido de 362 píxeles. En Kardex, una tabla de unos 725 píxeles queda dentro de un contenedor de 274 con `overflow: hidden`: las columnas de cantidad, impacto, referencia y acción no son accesibles mediante desplazamiento horizontal del contenedor.

Corregir anchos mínimos y permitir desplazamiento dentro de la tabla, conservando columnas y acciones. El resumen probado a 360 píxeles no ensancha la página; no aplicar cambios generales donde el diseño ya funciona.

**Corrección local — 06/10/2026, 1.1.42.** Los filtros de Productos ocupan el ancho disponible en celular, sin el mínimo fijo de 280 píxeles. En tamaños mayores conservan las cinco columnas y un ancho suficiente antes de compartir fila con el contador y el selector de perspectiva. Esos controles pueden pasar a otra línea cuando no caben. El ajuste se limita a los contenedores de Inventario; no cambia `Field`, `SelectField` o `Table` compartidos ni la lógica de filtros.

En la galería se detectó otro recorte: a 1280 píxeles, una barra de acciones de 150 píxeles dejaba Editar fuera de la tarjeta. La barra ahora puede distribuir sus mismos botones en varias líneas. Kardex permite desplazamiento horizontal dentro de la tabla y enfocar el contenedor con teclado; conserva las siete columnas y el comportamiento de las acciones. No se ejecutó Eliminar ni se guardaron operaciones.

**Comprobación de Kardex:** a 360 píxeles, la tabla de 725 píxeles quedó en un contenedor de 274 con desplazamiento automático. Una flecha de teclado desplazó 40 píxeles; el desplazamiento horizontal llegó al límite de 451 y permitió ver Referencia y Acción. El ancho de página permaneció en 350 píxeles útiles. Las cinco filas y los encabezados coincidieron exactamente con la referencia anterior al cambio. Captura: `temp/inventario-1.1.42-kardex-movil.jpg`.

**Comprobaciones finales:** Productos mantuvo el ancho de página a 320, 360, 480, 768, 1024 y 1280 píxeles. Los campos conservaron espacio útil, incluido Buscar a 768 y 1024; los tres botones de galería quedaron dentro de la tarjeta a 360 y 1280. Buscar Tornillo mostró dos productos; elegir Madera dejó uno y limpiar recuperó cinco. Editar abrió el panel habitual y Cancelar regresó sin guardar. Kardex mantuvo idénticas sus filas tras la compilación final, sin ensanchar la página a 320; el filtro Salida venta mostró cuatro y Todos recuperó las cinco.

Tipos de aplicación y compilación optimizada aprobados; ESLint sin errores, con una advertencia anterior de imagen. Sin errores ni advertencias de consola en los recorridos. El original y la copia aislada mantuvieron sus huellas. No se añadieron pruebas unitarias para clases de diseño ni se ejecutaron operaciones de escritura. Evidencias adicionales: `temp/inventario-1.1.42-build.log`, `temp/inventario-1.1.42-medidas.json`, `temp/inventario-1.1.42-productos-movil.jpg`, `temp/inventario-1.1.42-galeria.jpg` y `temp/inventario-1.1.42-local.jpg`. Nota de 221 caracteres coincidente con el aviso y el historial; sin publicación ni comprobación en producción.

### I4 — Fecha inicial adelantada por la zona horaria

**Prioridad media; reproducido en local y confirmado en código.** A las 20:15 del 05/10/2026 en Perú, compra y movimiento mostraban 06/10/2026. El valor inicial usa `new Date().toISOString().split("T")[0]`, que toma el día UTC.

Usar el día de Perú para el valor inicial y conservar las fechas ya guardadas. No desplazar ni reescribir registros existentes para corregir el formulario.

**Corrección local — 06/10/2026, 1.1.43.** Compra y movimiento en `inventario-context-panels.tsx` usan `fechaHoyPeru` de `lib/utils.ts` para el valor inicial de sus campos de fecha. El helper obtiene el calendario de `America/Lima` y devuelve `AAAA-MM-DD`, con mes y día de dos dígitos. Los campos siguen siendo editables y conservan su manejo anterior de apertura, cierre y reinicio. No se cambiaron acciones de guardado, registros existentes ni formularios de otros apartados.

**Pruebas realizadas:** 32 aprobadas en dos archivos: ocho casos nuevos de fecha de Perú y 24 de utilidades existentes. Cubren la noche cuando UTC ya cambió de día, el instante de medianoche de Perú, cambio de año, 29 de febrero y formato de fecha para el campo; también comprueban que mostrar fechas guardadas conserva el día. Tipos de aplicación y pruebas y ESLint de los archivos modificados aprobados, sin errores ni advertencias en esa revisión.

Compilación optimizada aprobada. En el navegador local ambos formularios iniciaron en 06/10/2026, día de Perú al revisarlos. Se eligió 30/09/2026: se conservó tras cambiar Cantidad recibida en compra y tras seleccionar un producto demo en movimiento. Cerrar y reabrir recuperó la fecha inicial, como en el flujo anterior. No se guardaron compras ni movimientos ni se validó un guardado con las opciones demo del selector. El cambio nocturno se probó con reloj simulado en pruebas, sin cambiar el reloj del equipo o del navegador.

Sin errores ni advertencias de consola en los recorridos. El archivo original y la copia aislada conservaron sus huellas; producción no se abrió. Evidencias: `temp/inventario-1.1.43-tests.log`, `temp/inventario-1.1.43-build.log`, captura `temp/inventario-1.1.43-local.jpg` y logs del servidor con ese prefijo. Nota de 224 caracteres coincidente con el aviso y el historial; sin publicación ni verificación en producción.

### I5 — Acciones para varios productos sin operación conectada

**Prioridad media; confirmado en código y pantalla.** Al seleccionar un producto aparecen Desactivar, Exportar y Ajustar stock. Los tres botones de esa barra no tienen manejador ni acción asociada; Exportar se pulsó en local y no produjo ningún resultado.

Retirar o presentar como no disponibles esas acciones incompletas, manteniendo la edición y las acciones individuales que ya funcionan. No desarrollar nuevas operaciones masivas como parte de una corrección de diseño sin que el usuario lo pida.

**Corrección local — 06/10/2026, 1.1.44.** Se retiraron la barra de acciones masivas y sus casillas de selección en Puro texto e Imagen y nombre, junto con el estado de selección que solo servía a esa barra. Editar, Desactivar y Eliminar por producto, el clic para ver su detalle y los filtros conservan sus manejadores anteriores. No se añadieron operaciones masivas ni se retiraron acciones individuales o exportaciones conectadas de otras pestañas.

**Comprobaciones realizadas:** tipos de aplicación y compilación optimizada aprobados; ESLint sin errores, con la advertencia anterior de imagen. No se añadieron pruebas unitarias para retirar controles. En el navegador ambas perspectivas mostraron cinco productos con acciones individuales y sin casillas. Buscar Tornillo mostró dos resultados y limpiar recuperó cinco. Editar abrió el editor desde ambas vistas; Cancelar cerró sin guardar. Desactivar y Eliminar abrieron sus confirmaciones iniciales y se cancelaron; no se avanzó a la eliminación definitiva ni se confirmó una baja. El clic sobre la fila abrió el detalle habitual.

Las dos perspectivas conservaron el ancho de página a 320 píxeles, con 310 útiles y 310 de contenido. Sin errores ni advertencias de consola en el recorrido. El archivo original y la copia aislada conservaron sus huellas. Evidencias: `temp/inventario-1.1.44-build.log`, `temp/inventario-1.1.44-local.jpg` y logs del servidor con ese prefijo. Nota de 217 caracteres coincidente con el aviso y el historial; sin publicación ni verificación en producción.

### I6 — Búsqueda que se pierde al recargar

**Prioridad media; reproducido en local.** Buscar “Tornillo” mostró dos productos. Tras recargar la misma ruta, la búsqueda quedó vacía y aparecieron los cuatro productos de prueba. Los filtros se guardan solo en el estado del componente; la URL conserva únicamente la pestaña.

Conservar la búsqueda y los filtros relevantes cuando se recarga o se regresa, sin cambiar el resultado de filtrado que ya funciona.

**Corrección local — 06/10/2026, 1.1.45.** Productos y Kardex toman sus filtros de la URL, incluida la perspectiva elegida. El historial del navegador se actualiza al cambiar cada control sin consultar otra vez los datos ni crear una entrada por cada letra. Se conserva la lógica de filtrado. Los valores desconocidos de estado o tipo y los límites no numéricos no generan filtros ocultos; la categoría y el producto se validan contra las opciones cargadas.

Se detectó además que cerrar los tres formularios rápidos regresaba a `/inventario` y borraba el contexto. Ahora conserva la pestaña y los filtros y retira únicamente `quick` y `producto_id`. Reponer también conserva la consulta. No se modificaron las operaciones de guardado.

**Comprobaciones realizadas:** once pruebas aprobadas sobre recuperación, caracteres especiales, limpieza, límites y regreso desde Compra. Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores, con la advertencia anterior de imagen. En el navegador, búsqueda Tornillo, Madera, Activos, stock entre 0 y 50 y galería conservaron un resultado al recargar. Kardex conservó Salida venta y Tabla Tornillo, con la misma fila, tras recargar y regresar con Atrás desde Ventas; volver a Productos mantuvo sus filtros.

Cerrar los tres formularios y cancelar el editor mantuvo la consulta. Reponer abrió Compra; cerrar eliminó solo la apertura rápida. Limpiar recuperó cinco productos y cinco movimientos. Escribir Tornillo carácter a carácter conservó el foco y sus dos resultados tras recargar. Sin errores ni advertencias de consola; los archivos de datos original y aislado conservaron sus huellas. No se guardaron operaciones, borradores o ampliaciones de Mostrar más; no se abrió producción ni se publicó. Evidencias: pruebas, compilación y logs con prefijo `temp/inventario-1.1.45` y captura `temp/inventario-1.1.45-local.jpg`.

## Otros detalles del diagnóstico — corregidos en local en 1.1.46

- **Historial parcial en Kardex (código):** se piden hasta 5.000 movimientos sin recorrer páginas y la pantalla muestra solo los primeros 200 del filtro. Falta comunicar o gestionar la parte restante. No se reprodujo con miles de registros reales.
- **Nombre de exportación (código):** los botones dicen CSV, pero la ruta genera Excel `.xlsx`. Además, el enlace del Kardex no transmite sus filtros. Revisar texto y alcance de exportación sin cambiar silenciosamente el formato existente.
- **Alertas sin movimientos (código):** los productos sin ningún movimiento se consideran inactivos por más de 30 días aunque su antigüedad no se evalúa, y el texto puede mostrar una cantidad de días vacía. Distinguir “Sin movimientos registrados” de una inactividad comprobada.

### I7 — Alcance del historial de Kardex

**Corrección local — 06/10/2026, 1.1.46.** La tabla muestra el número visible frente a las coincidencias cargadas y aclara que Excel exporta todas esas coincidencias. Se conservan los límites de 200 filas visibles y 5.000 solicitadas al servidor. `historialMovimientos` registra cantidad cargada y conteo real; un conteo distinto o fallido genera un aviso de alcance para indicadores y archivos, sin presentar una carga parcial como completa. No se implementó carga ilimitada o paginación nueva.

### I8 — Formato y filtros de exportación

**Corrección local — 06/10/2026, 1.1.46.** Los botones indican Excel y el formato .xlsx se conserva. Kardex transmite Tipo y Producto; la ruta y la tabla usan el mismo filtrado. El archivo incluye filtros y cantidad, y advierte de cargas parciales o no comprobadas cuando corresponde. Reportes conserva las descargas sin filtros y las identifica como tales.

### I9 — Ausencia de historial frente a inactividad comprobada

**Corrección local — 06/10/2026, 1.1.46.** Los productos sin movimientos no se incluyen en la alerta ni en el contador de 30 días. Se muestran por separado sin asignar antigüedad; si la carga no se confirmó completa, se dice “Sin movimientos en el historial cargado”. La antigüedad de movimientos conocidos usa días de calendario de Perú, evitando adelantar el umbral por UTC. Las listas de alertas también identifican si muestran solo sus primeros 20 productos.

**Comprobaciones de I7–I9:** 49 pruebas relacionadas aprobadas, incluidas 17 nuevas. Cubren Excel generado y leído, filtros, ausencia de resultados, más de 200 coincidencias, autenticación previa a la lectura, conteo parcial o fallido, clasificación y umbral de 30 días en Perú. Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores, con una advertencia anterior de imagen. Consultas al SDK respondidas en memoria; sin conexión a una base real ni escritura en archivos del negocio.

En el navegador habitual se verificaron el grupo sin movimientos, el contador de cuatro productos con inactividad comprobada y el acceso al editor del producto sin historial, cancelado sin guardar. Kardex mostró cinco registros; Salida venta y Tabla Tornillo dejó uno y el Excel descargado contenía exactamente esa fila. Un filtro vacío mostró su mensaje; Reportes identificó ambos formatos Excel.

Una copia independiente con 215 movimientos, incluidos 210 ajustes ficticios de cantidad cero, mostró el límite 200 de 215 y 200 de 210 al filtrar Ajuste y Tabla Tornillo. La descarga del navegador incluyó las 210 coincidencias y la última referencia no visible. La copia temporal se cerró; el local habitual conserva sus cinco movimientos. No se pulsaron Guardar, Aplicar conteo ni Eliminar.

Sin errores ni advertencias de consola. Las copias coincidieron con las huellas o preparación esperadas; el original quedó intacto. Evidencias con prefijo `temp/inventario-1.1.46`: pruebas, compilación, logs, capturas y dos archivos Excel descargados. Sin publicación ni verificación de Inventario en producción. La prueba del aviso de carga parcial usó respuestas del SDK en memoria; no miles de registros reales ni una base remota.

**Límite compartido para una revisión posterior:** Gerencial y la exportación de Respaldo también usan `getInventarioRobustoData`. La clasificación del contador cambia allí por la corrección de I9, sin cerrar su revisión. Respaldo sigue usando la carga acotada y no se comprobó que represente todos los movimientos de la base; revisar expresamente ese alcance al llegar a ese apartado.

### I10 — Conteo mensual según la zona del servidor

**Confirmado en pruebas antes de corregir.** “Movimientos del mes” comparaba una fecha registrada a medianoche UTC con el inicio de mes en la zona local del servidor. Podía excluir el primer día o seleccionar otro mes durante la noche de Perú. El resumen de costos ya usaba Perú, por lo que ambos indicadores podían discrepar.

**Corrección local — 06/10/2026, 1.1.47.** El conteo toma el mes de `fechaHoyPeru` y compara el calendario guardado, sin cambiar registros ni fechas. Se conserva el alcance de movimientos cargados. Dos casos de cambio de mes fallaron antes y pasaron después; los cinco casos de lectura también pasaron con el proceso en UTC. Sin conexión ni escritura en Supabase.

### I11 — Excel de stock con valores engañosos y categorías que impiden descargar

**Confirmado en cuatro pruebas antes de corregir.** El archivo presentaba costos desconocidos como cero y su valor como total completo; sumaba unidades diferentes en stock y vendido. Sin productos generaba fórmulas circulares. Usaba directamente la categoría como nombre de hoja: caracteres como `/`, nombres reservados y coincidencias después de recortar impedían la descarga o podían colisionar con Kardex.

**Corrección local — 06/10/2026, 1.1.47.** El Excel distingue “Sin costo en compras” en las filas y en las hojas de categoría, describe el valor parcial y mantiene los importes conocidos. Los totales de cantidad dicen “Unidades distintas” cuando no son comparables; si coinciden, se conserva la suma. Con catálogo vacío, los tres totales son cero. Solo los nombres de pestaña se adaptan a Excel y se hacen únicos; categoría original, títulos, columnas y datos guardados se conservan. Sin cambios en costos calculados, guardados o formularios.

**Comprobación final del conjunto local:** 538 pruebas en 38 archivos aprobadas, incluidas seis nuevas de estos errores. Tipos de aplicación y pruebas, compilación optimizada y ESLint aprobados; siete advertencias anteriores, sin errores. En el navegador, Inventario mostró 1.1.47 y la nota correcta. El Excel descargado desde Reportes conservó los cinco productos de la copia, S/ 1,596.00 de valor conocido, cuatro costos desconocidos y totales de cantidades sin mezclar medidas. Resumen mostró 8 cajas, 3 latas y 60 unidades por separado, con el mismo valor parcial. Categorías especiales, ausencia de productos y límites horarios se comprobaron con pruebas en memoria.

La primera descarga se interrumpió en la herramienta de navegador; la siguiente terminó y su archivo se verificó. Inicio, Ventas y Caja también cargaron en un recorrido breve de lectura. Sin errores ni advertencias de consola o errores del servidor detectados; no equivale a comprobar cada operación de esos módulos. Original y copia mantuvieron sus huellas. Servidor local: `temp/inventario-1.1.47-preview`; pruebas, compilación, logs, captura, Excel y comprobación JSON con prefijo `temp/inventario-1.1.47`. Nota de 227 caracteres coincidente con el historial. No se guardaron formularios, confirmaron bajas, ejecutaron conteos o migraciones ni se abrió producción. Sin publicación.

## Qué no cambiar por este diagnóstico

La búsqueda sí filtra los productos y las alertas locales coinciden con los mínimos de esa copia. El registro de conteo físico ya existe. Mantener esas operaciones y no añadir otro flujo de trabajo. No declarar correctas todas las escrituras ni todos los datos reales: esa verificación no se realizó.

## Próximo paso

La publicación funcional 1.1.47 está confirmada en Vercel y visible en producción. Se comprobaron Resumen, Productos, búsqueda conservada al recargar, filtros y enlace de Kardex, Alertas y Reportes, sin ejecutar operaciones del negocio. El Excel real de stock descargado en 1.1.48 se abrió: 64 productos, S/ 17,021.00 de valor conocido, 58 productos con stock sin costo y totales sin mezclar unidades. El usuario confirmó la descarga de Kardex; no se identificó su archivo para inspeccionar el contenido. Esta distinción queda registrada en 1.1.49 y en [Estado del proyecto](ESTADO_DEL_PROYECTO.md). No se detectó un fallo funcional que requiera nuevos cambios. Conservar los límites: no se probaron todas las escrituras reales ni los triggers contra PostgreSQL, el historial continúa acotado y otros apartados no se consideran terminados por estas comprobaciones.
