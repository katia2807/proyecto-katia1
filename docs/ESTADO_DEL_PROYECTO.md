# Estado del proyecto y continuidad

Actualizado: 06/10/2026. Registro de mantenimiento: 1.1.48 (publicación y comprobaciones de Inventario).

## Punto de partida

La última publicación funcional comprobada es 1.1.47, commit `cfd7ef3`: las correcciones de Inventario 1.1.40–1.1.47 están en `main` y Vercel confirmó el despliegue. Incluyen I1 (consultas y guardados que confundían costo y precio), I2 (significado de los indicadores), I3 (recortes en celular), I4 (fecha inicial de Perú), I5 (selección múltiple sin operación conectada), I6 (filtros que se perdían al recargar o regresar), I7–I9 (alcance de Kardex, exportaciones y alertas sin historial) e I10–I11 (conteo mensual y Excel de stock). La revisión final local pasó con 538 pruebas; en producción se comprobaron las pantallas y filtros mediante lectura. La descarga de Excel real en producción no quedó confirmada por la herramienta y se conserva como límite. El registro 1.1.48 incorpora esta evidencia, sin nuevos cambios funcionales. La versión del código se consulta en `lib/app-version.ts` y su historial en [Notas de parche](NOTAS_DE_PARCHE.md).

El criterio acordado es corregir errores y detalles de diseño por partes, conservando el uso habitual. Esta página permite retomar el trabajo; leer solo la sección afectada y consultar el detalle cuando haga falta. No se integra en la aplicación ni se usa para bloquear su ejecución o exigir revisiones completas en cada cambio.

## Apartados trabajados

| Apartado | Estado de la revisión | Base y comprobaciones | Pendientes conocidos |
| --- | --- | --- | --- |
| Inicio | Revisión funcional cerrada dentro del alcance comprobado | 1.1.38: ventas recientes de las dos tablas de madera, enlaces al detalle correcto y tablas en celular. Verificado en local y producción. | No quedaron incidencias propias de esa revisión. |
| Ventas | Revisión funcional cerrada dentro del alcance comprobado; corrección compartida publicada | 1.1.38: historial, filtros, acceso a Clientes y regreso desde comprobante interactivo, A4 y ticket. Las operaciones mostradas antes y después de publicar coincidieron. I1 se publicó en 1.1.47: la consulta compartida no escribe y editar el precio del catálogo conserva el costo de inventario. | Los guardados de costo y precio se probaron con datos aislados; no se editaron registros del negocio en producción para verificar I1. |
| Caja | Revisión funcional cerrada dentro del alcance comprobado | 1.1.37: resumen completo, filtros, movimientos protegidos, adjuntos y formulario en celular. En 1.1.38 se compararon todos los movimientos mostrados y el saldo sin diferencias. | No quedaron incidencias propias de esa revisión. |
| Inventario | I1–I11 corregidas y publicadas; revisión local y de pantallas en producción comprobadas | 06/10/2026, 1.1.47: 538 pruebas, tipos y compilación aprobados; descarga real y navegación local con datos aislados. Vercel confirmado, salud 200 con demo desactivado, 64 productos activos y ocho movimientos; búsqueda persistente y filtros de Kardex comprobados en producción. Registro 1.1.48. | [Alcance y límites comprobados](REVISION_INVENTARIO_2026-10-05.md). Descarga real de Excel en producción pendiente de confirmación manual. No se validaron todas las escrituras reales ni los triggers contra PostgreSQL. |

Los otros apartados no tienen una revisión completa registrada en este proceso. No trasladarles el estado de los anteriores. El uso de componentes de Clientes, Cotizaciones o Configuración durante una comprobación de Ventas no significa que esos módulos estén terminados.

## Evidencia de la base funcional 1.1.38

- Suite de 473 pruebas aprobada. Las 12 pruebas de Inicio se repitieron tras el último ajuste de su modelo y pasaron.
- Compilación optimizada, tipos de aplicación y de pruebas aprobados. La revisión de los archivos modificados no encontró errores de ESLint; conservó cuatro advertencias anteriores.
- Publicación de Vercel confirmada y versión 1.1.38 visible en producción. `/api/health` respondió 200, con modo demo desactivado y configuración de Supabase lista para datos reales.
- Navegación, filtros, detalle y tres formatos de comprobante comprobados con una sesión real, sin errores de consola detectados en los recorridos revisados.
- Comparación de las filas visibles de Ventas y todas las páginas de Caja antes y después de publicar: sin diferencias. Esto no equivale a una auditoría de cada campo de todas las tablas de la base.
- Las escrituras completas en producción no se probaron con registros del negocio. La prueba real de adjunto PDF de Caja usó un archivo de prueba y no guardó un movimiento financiero.

Los informes de [Inicio del 03/10](VERIFICACION_INICIO_2026-10-03.md) y [Ventas del 04/10](VERIFICACION_VENTAS_2026-10-04.md) describen versiones anteriores. Sus limitaciones de publicación corresponden a esas fechas; se conservan por su evidencia y trazabilidad.

## Tecnologías de los apartados revisados

Versiones del archivo de dependencias fijadas al elaborar este registro; no indican una actualización solicitada de paquetes.

| Tecnología | Versión registrada | Uso observado |
| --- | --- | --- |
| Next.js / React | 16.2.4 / 19.2.4 | Rutas App Router, páginas de servidor, componentes interactivos y acciones de servidor. Compilación actual con Webpack. |
| TypeScript | 5.9.3 | Tipos de aplicación, datos y pruebas. |
| Tailwind CSS | 4.2.4 | Diseño, temas y adaptación a tamaños de pantalla. |
| Supabase JS / SSR | 2.105.1 / 0.10.2 | Consultas de servidor, sesión y conexión con PostgreSQL y Storage. |
| Zod | 4.4.1 | Validación de entradas en las acciones. |
| Vitest / ESLint | 4.1.6 / 9.39.4 | Pruebas y revisión de código. |
| ExcelJS | 4.4.0 | Exportación de Inventario a XLSX; desde 1.1.46 los botones indican Excel y Kardex transmite sus filtros. |
| Node.js local | 24.15.0 | Entorno local observado. La versión exacta del runtime remoto no se comprobó. |

Producción está publicada en Vercel desde la rama `main` de `katia2807/proyecto-katia1`. URL: `https://proyecto-katia.vercel.app/`. No asumir que una configuración local antigua de `.vercel` identifica el proyecto correcto: la publicación comprobada fue mediante la integración con GitHub.

## Mapa breve para retomar

| Área | Archivos principales |
| --- | --- |
| Inicio | `app/(dashboard)/page.tsx`, `lib/inicio-data.ts` |
| Historial y detalle de Ventas | `app/(dashboard)/ventas/page.tsx`, `components/ventas/ventas-list-with-filters.tsx`, `lib/ventas-historial-navigation.ts`, `lib/venta-detalle.ts` |
| Comprobantes de Ventas | `app/(dashboard)/ventas/comprobante/[tipo]/[id]/page.tsx`, `components/sales/print-a4-voucher.tsx`, `components/sales/print-ticket-voucher.tsx`, `app/print/` |
| Caja | `app/(dashboard)/caja/page.tsx`, `components/caja/`, los archivos `lib/caja-*` y acciones correspondientes en `app/actions.ts` |
| Inventario | `app/(dashboard)/inventario/page.tsx`, `app/(dashboard)/inventario/export/route.ts`, `components/inventario-interactivo.tsx`, `components/inventario/`, los archivos `lib/inventario-resumen.ts`, `lib/inventario-filtros.ts`, `lib/inventario-historial.ts`, `lib/inventario-alertas.ts`, `lib/utils.ts` (`fechaHoyPeru`), `lib/data.ts` y acciones correspondientes en `app/actions.ts` |
| Datos y entornos | `lib/runtime.ts`, `lib/demo-mode.ts`, `lib/demo-store.ts`, `lib/server-data-dir.ts`, `lib/supabase/` |
| Aviso de actualización | `lib/app-version.ts`, `docs/NOTAS_DE_PARCHE.md` |

La vista local usada en estas revisiones está en `http://127.0.0.1:3001/`, con `KATIA_USE_DEMO_DB=1` y un almacén separado mediante `KATIA_SERVER_DATA_DIR`. Es una copia de pruebas, no una réplica sincronizada de producción. Se inició sesión con la cuenta demo anunciada en el acceso; no se habilitó acceso sin autenticación para esta revisión.

### Comprobación local de I1 — 06/10/2026, 1.1.40

- 26 pruebas relacionadas aprobadas, con 13 casos nuevos; después, 486 pruebas de regresión aprobadas por el cambio en datos y acciones compartidas. Datos en memoria o directorio de pruebas aislado.
- Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores en los archivos modificados; seis advertencias anteriores de variables sin uso, sin cambios en ellas.
- En el navegador se abrió y recargó Inventario y Ventas. El archivo de la copia quedó idéntico antes y después de esas consultas; no hubo errores de consola en el recorrido.
- En el editor habitual del catálogo se cambió el precio de un mueble sintético de S/ 650 a S/ 720. El guardado conservó su costo de S/ 250 y stock de 8; una recarga mantuvo el resultado sin otra escritura. El archivo original `data/store.json` conservó su huella.
- El servidor local de 1.1.40 usa `temp/inventario-1.1.40-preview`, con Supabase ignorado para operaciones de datos. Se inició sesión con la cuenta demo anunciada por la pantalla de acceso; la autenticación sigue habilitada. Captura y logs locales se conservan en `temp/`.
- No se abrió producción ni se ejecutaron migraciones o reparaciones de datos reales en esta corrección. Los triggers se revisaron en el código de migraciones; no se verificó su ejecución en PostgreSQL real.

### Comprobación local de I2 — 06/10/2026, 1.1.41

- 20 pruebas relacionadas aprobadas, incluidas 10 nuevas sobre unidades de medida, valores parciales o ausentes, costo cero explícito, mes de Perú y consultas sin cambios en los datos.
- Tipos de aplicación y pruebas y compilación optimizada aprobados. Tras corregir el encabezado del editor se repitieron tipos, ESLint y compilación. ESLint sin errores en los archivos modificados; una advertencia anterior de imagen en Inventario.
- La copia mostró por separado 8 cajas, 3 latas y 60 unidades, con valor registrado de S/ 1,596.00 y aviso de cuatro productos con stock sin costo en compras. No hubo salidas de venta en el mes de esa copia.
- El listado conservó el costo y valor conocidos; los productos sin compras con costo mostraron esa ausencia. Se revisó el editor habitual sin guardar cambios y, tras la corrección y recompilación, su encabezado mostró también “Sin costo en compras”.
- El resumen se comprobó a 320 y 360 píxeles sin ensanchar la página. Esto no cierra I3: los recortes conocidos de Productos y Kardex siguen pendientes.
- La copia y el archivo original conservaron sus huellas durante las consultas. Sin errores ni advertencias de consola en el recorrido. Servidor en `temp/inventario-1.1.41-preview`; captura `temp/inventario-1.1.41-local.jpg` y logs con el mismo prefijo. No se abrió producción ni se guardaron operaciones del negocio.

### Comprobación local de I3 — 06/10/2026, 1.1.42

- Cambios de diseño limitados a Productos y Kardex en `components/inventario-interactivo.tsx`; sin cambios en consultas, acciones o componentes compartidos. No se añadieron funciones.
- Tipos de aplicación y compilación optimizada aprobados. ESLint sin errores, con la advertencia anterior de imagen. Comprobación de diseño y recorridos en navegador, sin nuevas pruebas unitarias para reglas de ancho.
- Productos no ensanchó la página a 320, 360, 480, 768, 1024 ni 1280 píxeles. Los filtros conservaron un ancho utilizable; las acciones de la galería quedaron dentro de su tarjeta a 360 y 1280 píxeles. Buscar Tornillo mostró dos productos, elegir Madera dejó uno y limpiar ambos filtros recuperó los cinco de la copia.
- Editar desde la galería abrió el editor habitual; Cancelar regresó al listado sin guardar. Se conservan las tres acciones y las dos perspectivas.
- Kardex mantuvo sus cinco filas y siete encabezados sin diferencias. Se comprobó el desplazamiento horizontal y por teclado a 360 píxeles; a 320 la página mantuvo su ancho. Filtrar Salida venta mostró cuatro filas y Todos recuperó las cinco. No se ejecutaron exportación, eliminación ni guardados.
- Sin errores ni advertencias de consola en los recorridos. El original y la copia aislada conservaron sus huellas. El servidor usa `temp/inventario-1.1.42-preview` con autenticación habilitada y datos demo; no se abrió producción.
- Evidencia en `temp/`: compilación y logs con prefijo `inventario-1.1.42`, medidas de Productos, capturas de celular, galería y vista local. Nota de parche de 221 caracteres coincidente con el aviso y el historial. Corrección sin publicar.

### Comprobación local de I4 — 06/10/2026, 1.1.43

- Compra y movimiento usan `fechaHoyPeru` para su fecha inicial; los campos continúan editables. No se cambiaron acciones de guardado, fechas registradas ni formularios de otros módulos.
- 32 pruebas aprobadas: ocho nuevas de calendario de Perú y 24 de utilidades existentes. Cubren noche, medianoche de Perú, cambio de año, año bisiesto y conservación de fechas guardadas al mostrarlas.
- Tipos de aplicación y pruebas, compilación optimizada y ESLint de los archivos modificados aprobados. Sin errores ni advertencias en esa revisión de ESLint.
- En el navegador, ambos formularios iniciaron en 06/10/2026, correspondiente al día de Perú durante la comprobación. Elegir 30/09/2026 se conservó al cambiar la cantidad de compra y al seleccionar un producto demo en movimiento. Cerrar y reabrir recuperó la fecha inicial en ambos, manteniendo el reinicio anterior.
- La diferencia nocturna frente a UTC se verificó con reloj simulado en pruebas; no se alteró el reloj del navegador o equipo. No se pulsaron Guardar compra ni Guardar movimiento. El selector local usa opciones demo; esta revisión no valida un guardado real con esa selección.
- Sin errores ni advertencias de consola en los recorridos. El archivo original y la copia aislada conservaron sus huellas. El servidor usa `temp/inventario-1.1.43-preview` con autenticación habilitada y datos demo; producción no se abrió.
- Evidencias: `temp/inventario-1.1.43-tests.log`, compilación y logs con el mismo prefijo y `temp/inventario-1.1.43-local.jpg`. Nota de parche de 224 caracteres coincidente con el aviso y el historial. Corrección sin publicar.

### Comprobación local de I5 — 06/10/2026, 1.1.44

- Se retiraron la barra masiva sin operación, las casillas en las dos perspectivas y su estado de selección. Sin cambios en acciones de guardado, bajas, detalle o filtrado.
- Tipos de aplicación, compilación optimizada y revisión de los archivos modificados aprobados. ESLint sin errores, con la advertencia anterior de imagen. No se añadieron pruebas unitarias para la retirada de controles; se comprobó la interfaz en el navegador.
- Puro texto e Imagen y nombre mostraron los cinco productos de la copia con sus acciones individuales y sin casillas. Buscar Tornillo conservó dos resultados y limpiar recuperó cinco.
- Editar abrió el editor desde ambas perspectivas y Cancelar regresó sin guardar. Desactivar y Eliminar abrieron sus confirmaciones iniciales; se cancelaron ambas. El clic sobre la fila también abrió el detalle del producto. No se confirmó una baja ni se avanzó a la eliminación definitiva.
- Ambas perspectivas mantuvieron el ancho de página a 320 píxeles (310 útiles). Sin errores ni advertencias de consola en los recorridos.
- El original y la copia aislada conservaron sus huellas. Servidor en `temp/inventario-1.1.44-preview`, con autenticación habilitada y datos demo. Producción no se abrió ni se publicaron cambios.
- Evidencia: `temp/inventario-1.1.44-build.log`, captura `temp/inventario-1.1.44-local.jpg` y logs del servidor con ese prefijo. Nota de parche de 217 caracteres coincidente con el aviso y el historial.

### Comprobación local de I6 — 06/10/2026, 1.1.45

- Búsqueda, categoría, estado, límites de stock, perspectiva y filtros de Kardex se leen desde la URL. Cambiarlos actualiza el historial sin solicitar de nuevo los datos; la lógica de filtrado anterior se conserva. Valores de estado, tipo o límites inválidos se descartan; categorías y productos ausentes no aplican filtros ocultos.
- Cerrar Compra, Producto o Movimiento conserva la pestaña y los filtros, retirando únicamente los parámetros de apertura rápida. Reponer también conserva el contexto. Sin cambios en acciones de guardado ni datos registrados.
- Once pruebas de navegación y filtros aprobadas: recuperación conjunta, caracteres especiales, cero y decimales, valores inválidos, limpieza y regreso desde una operación rápida. Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores, con la advertencia anterior de imagen.
- En el navegador se reprodujo la búsqueda perdida en 1.1.44 (dos resultados y cinco después de recargar). En 1.1.45, Tornillo, Madera, Activos, límites 0–50 y galería conservaron su único resultado tras recargar. Kardex conservó Salida venta y Tabla Tornillo, con la misma fila, tras recargar y al usar Atrás después de abrir Ventas. Volver a Productos mantuvo sus cinco filtros y la perspectiva.
- Abrir y cerrar los tres formularios y cancelar el editor conservó la consulta. Reponer abrió Compra y cerrar retiró `quick` y `producto_id` sin borrar los filtros. Limpiar recuperó cinco productos y cinco movimientos; escribir Tornillo carácter a carácter conservó el foco y mostró dos productos, también después de recargar.
- Sin errores ni advertencias de consola en los recorridos. El original y la copia aislada conservaron sus huellas. Servidor en `temp/inventario-1.1.45-preview`, con autenticación habilitada y datos demo; producción no se abrió y los cambios no se publicaron. No se guardaron formularios ni se verificó la conservación de borradores o de la ampliación Mostrar más.
- Evidencia: `temp/inventario-1.1.45-tests.log`, compilación y logs con ese prefijo y captura `temp/inventario-1.1.45-local.jpg`. Nota de parche coincidente con el aviso y el historial.

### Comprobación local de I7–I9 — 06/10/2026, 1.1.46

- Kardex informa cuántas coincidencias muestra frente a las cargadas y conserva el límite de 200 filas. La carga de movimientos conserva su tope solicitado de 5.000; si el conteo real es distinto o no se pudo contar, aparece un aviso de alcance para indicadores y exportaciones. No se añadió otro flujo de consulta ni carga ilimitada.
- Los botones indican Excel (.xlsx), manteniendo el formato existente. La descarga desde Kardex aplica Tipo y Producto y exporta todas las coincidencias cargadas, no solo las 200 visibles. Reportes mantiene sus descargas sin filtros y lo aclara. Los archivos incluyen alcance, filtros de Kardex y aviso de carga parcial cuando corresponde.
- Las alertas y el indicador de 30 días excluyen los productos sin movimientos. Estos aparecen en un grupo separado sin antigüedad inventada; si no se confirmó un historial completo, el texto limita la ausencia al historial cargado. Los días comprobados usan el calendario de Perú, incluido el umbral de 30 días por la noche.
- 49 pruebas relacionadas aprobadas, con 17 nuevas: filtro y archivo Excel real, más de 200 filas, descarga vacía, autenticación, conteo parcial o fallido, clasificación de alertas y calendario. Las consultas usaron el SDK de Supabase con respuestas en memoria, sin red ni escrituras. Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores, con la advertencia anterior de imagen.
- En el navegador habitual, el producto de prueba sin historial mostró “Sin movimientos registrados” y el resumen contó cuatro productos con inactividad comprobada. Su botón abrió el editor correcto y se canceló sin guardar. Kardex mostró cinco movimientos; filtrar Salida venta y Tabla Tornillo dejó uno. El Excel descargado en el navegador contenía exactamente esa fila y esos filtros. Un filtro sin coincidencias mostró un mensaje explícito. Reportes mostró ambos nombres Excel.
- Una segunda copia aislada agregó 210 ajustes ficticios de cantidad cero para tener 215 movimientos. Kardex informó 200 de 215; con Ajuste y Tabla Tornillo informó 200 de 210. El Excel descargado contenía las 210 coincidencias, incluida la última referencia que no estaba en pantalla. La copia temporal y su pestaña se cerraron; el local habitual conserva sus cinco movimientos y cinco productos.
- Sin errores ni advertencias de consola en ambos recorridos. El archivo original y la copia habitual conservaron sus huellas. La copia amplia coincidió exactamente con la preparación prevista después de consultar y descargar. No se guardaron operaciones, conteos o eliminaciones ni se abrió producción.
- Evidencias: `temp/inventario-1.1.46-tests.log`, compilación, logs, captura local, captura del historial amplio, `temp/inventario-1.1.46-kardex-filtrado.xlsx` y `temp/inventario-1.1.46-kardex-210.xlsx`. El servidor habitual usa `temp/inventario-1.1.46-preview`, con autenticación habilitada y datos demo. Nota coincidente con el aviso y el historial; sin publicar.
- Incidencia compartida registrada: `getInventarioRobustoData` también alimenta Gerencial y la exportación de Respaldo. El contador de inactividad usa ahora solo días comprobados; esta prueba no cierra esos apartados. La carga acotada de movimientos no permite considerar un archivo de Respaldo como copia completa de toda la base; revisar ese alcance al trabajar Respaldo.

### Revisión final local — 06/10/2026, 1.1.47

- Se reprodujeron seis casos nuevos antes de corregirlos: dos errores en el conteo mensual por la zona del servidor, valor desconocido presentado como cero, sumas de medidas diferentes, totales circulares con catálogo vacío y descarga que fallaba con categorías personalizadas. Las correcciones se limitaron a `getInventarioRobustoData` y al Excel de Inventario; sin nuevas operaciones, migraciones ni cambios en guardados.
- “Movimientos del mes” usa el mismo calendario de Perú que el resumen. El Excel señala los costos desconocidos en sus filas y hojas de categoría, y el alcance parcial del valor registrado. No suma cajas con unidades en los totales de stock o vendido; conserva las sumas si la unidad coincide. Sin productos, los totales son cero sin fórmulas circulares.
- Las pestañas de categoría tienen nombres compatibles y distintos, incluidos caracteres prohibidos, nombres reservados y coincidencias después de recortar. El nombre original de categoría se conserva en el título y los datos del archivo; no se renombra ningún registro.
- Suite completa: 538 pruebas en 38 archivos aprobadas. Los cinco casos de lectura mensual también pasaron con `TZ=UTC`; los seis casos nuevos usan datos en memoria y Excel generado y leído. Tipos de aplicación y pruebas y compilación optimizada aprobados. ESLint sin errores; siete advertencias anteriores en el conjunto de archivos locales modificados.
- En el navegador, 1.1.47 mostró su nota y cargó Inventario, Inicio, Ventas y Caja sin errores ni advertencias de consola en el recorrido. Se descargó el Excel de stock real desde Reportes: cinco filas, S/ 1,596.00 de valor conocido, cuatro productos sin costo y totales de cantidades identificados como unidades distintas. Las filas coinciden con la copia. Esta comprobación breve de Inicio/Ventas/Caja no sustituye sus revisiones anteriores ni amplía su alcance.
- La descarga inicial se interrumpió en la herramienta de navegador; el segundo intento desde el mismo enlace terminó y el archivo se abrió y verificó con ExcelJS. El servidor no registró errores. Categorías especiales y catálogo vacío se verificaron en pruebas de la ruta con respuestas en memoria, no alterando la copia habitual.
- Original y copia conservaron sus huellas durante compilación, navegación y descarga. Servidor local en `temp/inventario-1.1.47-preview`, con modo demo y autenticación habilitada. No se guardaron formularios, ejecutaron bajas o conteos ni se abrió producción. No hubo commit, push o publicación. Evidencias con prefijo `temp/inventario-1.1.47`: pruebas, reproducción, tipos comprobados, revisión de código, compilación, logs, captura y archivo Excel con su comprobación.
- Nota de parche de 227 caracteres coincidente con el aviso y el historial. El alcance local revisado está preparado para publicación; siguen pendientes verificar el despliegue y sus consultas en producción cuando se publique. El límite compartido de Respaldo descrito arriba sigue pendiente de su propia revisión.

### Publicación y comprobación de lectura — 06/10/2026, funcional 1.1.47; registro 1.1.48

- Commit funcional `cfd7ef3fd940107fd2151fd2e801daa5488ed51d`, publicado en `main` mediante GitHub. Estado Vercel `success`: [despliegue confirmado](https://vercel.com/grupo-ark-ccatun-rumi-sac/project-ukk6w/CJ4ZT9TnMyZZvyxQKcgrHNogsa9i). La versión 1.1.47 se confirmó en el pie de producción.
- `/api/health` respondió 200: `demoMode=false`, `supabaseConfigured=true`, `supabaseServerDataReady=true`. Se conservaron las variables y la integración existentes; no se ejecutaron migraciones, reparaciones ni acciones de guardado en la base.
- Antes de abrir Inventario se inspeccionaron página, layout, sesión, funciones auxiliares, exportación y efectos de los componentes. Sus consultas usan selección y conteo; la consulta del catálogo ya no sincroniza datos. Las acciones de guardado, eliminación y unidades requieren interacción explícita y no se ejecutaron. La renovación normal de sesión no constituye una escritura de registros del negocio.
- Producción mostró 64 productos activos, 32 con stock bajo y ocho movimientos cargados, sin aviso de carga fallida o parcial. Resumen distinguió 229 `und` y 40 `unidad`, valor parcial y cinco productos con inactividad comprobada; no se normalizaron ni corrigieron etiquetas o datos reales.
- Productos mostró 20 de 64; búsqueda `CAMA` y categoría Muebles conservaron sus nueve filas y contenido exacto después de recargar. Kardex mostró ocho filas; Entrada compra y el producto elegido dejaron cuatro, y el enlace Excel transmitió ambos filtros. Alertas separó la ausencia de historial de la inactividad; Reportes identificó Excel y las descargas sin filtros. Sin errores ni advertencias de consola en ese recorrido.
- Se compararon las dos tablas visibles de Inicio antes y después de publicar: idénticas. No es una auditoría de todas las tablas o de todos los datos reales; no hubo una lectura previa de Inventario antiguo porque podía escribir durante la carga.
- La descarga de Kardex no pudo confirmarse automáticamente en Edge: dos mecanismos de descarga agotaron su espera, sin error visible de la aplicación o de consola. La herramienta bloqueó además consultar la página interna de descargas del navegador. Se pidió una comprobación manual; hasta recibir evidencia, Excel en producción sigue pendiente. Las descargas locales y los archivos generados en pruebas sí están verificados, y la falta de confirmación no demuestra por sí sola un fallo de la ruta publicada.
- 1.1.48 cambia únicamente el aviso, la nota y esta documentación para registrar la publicación y sus límites. Las verificaciones funcionales siguen siendo las de 1.1.47; no se afirma una prueba de guardados, conteos, bajas, triggers ni todos los datos de la base. El límite de Respaldo continúa reservado a su revisión propia.

## Regla para la siguiente parte

1. Consultar el estado del apartado y sus pendientes; comprobar el código actual antes de basarse en un informe histórico.
2. Corregir un problema concreto y conservar los flujos que funcionan. Si afecta código compartido, revisar únicamente los recorridos relacionados.
3. Verificar en local de forma proporcional, registrar la evidencia y distinguir los datos de prueba de los reales.
4. Publicar cuando corresponda a la autorización del usuario; confirmar la versión y comprobar en producción solo operaciones apropiadas para ese entorno.
5. Actualizar este registro, la incidencia resuelta y la nota de parche. Incorporar nuevos módulos solo cuando se trabajen.

## Limpieza de documentación

Se sustituye `AUDITORIA_INICIO.md`, una propuesta de rediseño de mayo que pedía retirar partes de Inicio ahora conservadas por decisión del usuario. No era una verificación del estado actual. Su versión anterior sigue recuperable en Git.

Se mantienen los informes fechados, notas de parche, alcance inicial, guías de despliegue, glosario y documentación de apartados aún no revisados. Los planes anteriores son contexto histórico, no órdenes para introducir nuevas funciones sin petición del usuario.

La limpieza local retiró nueve logs de compilaciones concluidas de Caja/Ventas y el PDF descartable `temp/comprobante-prueba-demasiado-grande.pdf` (unos 5 MB liberados). Se conservaron las capturas útiles, los respaldos, archivos de datos, compilación y logs vigentes, pruebas y carpetas necesarias para el servidor local. Los temporales estaban excluidos de Git; no eran archivos del programa publicado.
