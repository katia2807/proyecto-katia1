# Revisión externa: correcciones locales 1.1.69

Fecha: 08/10/2026. Estado: **implementado en local; pendiente de publicación**. Se atendieron las correcciones y opciones aprobadas tras comparar el borrador externo con el comportamiento del programa. El borrador no acreditó un fallo nuevo concreto en Centro de Mando o Registro; no se cambiaron esos apartados.

## Cambios entregables

| Apartado | Cambio | Forma de trabajo conservada |
| --- | --- | --- |
| Caja | La tabla puede desplazarse horizontalmente en celular y recibe foco de teclado. Selector de 20, 50, 100 o 200 filas; filtros y tamaño viajan en los enlaces de página. | El saldo sigue usando el historial completo; movimientos protegidos y acciones existentes conservan su tratamiento. |
| Cotizaciones | Empezar, reiniciar y editar llevan al bloque de datos del cliente. DNI admite 8 dígitos y RUC 11, también en el alta rápida. Teléfono opcional con validación de 7–15 dígitos y formatos habituales. | Alta rápida permite documento vacío. No cambia cálculos, cobros, pasos ni registros existentes. Validación de altas y cambios rápidos también en el servidor. |
| Inventario | Stock sin existencias, bajo o disponible tiene etiqueta y color legible en ambos temas. Productos permite elegir tamaño del bloque sin quitar Mostrar más. Kardex incorpora tamaño de página, enlaces y fecha/hora de registro de Perú. | Filtro individual existente conservado. Fecha de operación y fecha de registro se distinguen; si falta la hora se indica y no se inventa. Excel conserva todos los movimientos seleccionados, no solo la página visible. |
| Reportes | Resumen de Caja por fechas, categoría y ámbito; totales y categorías separan empresa/personal. Excel y CSV descargan la misma selección, con vista imprimible para guardar el resumen como PDF. Detalle paginado y exportaciones completas identificadas aparte. | Exportaciones anteriores y cierre mensual conservados. Resultado equivale a ingresos menos gastos, no utilidad contable; transferencias excluidas de los importes. |
| Login | Mejora del contraste del aviso de sesión expirada en tema claro. | Sin cambios de autenticación. El recorte de la imagen del usuario no se reprodujo en el login publicado a 768 px; no es una certificación de todos los tamaños. |

## Comprobaciones realizadas

- 177 pruebas en 13 archivos relacionados aprobadas: modelos, filtros, paginación, historial/Excel de Inventario, permisos y exportación de Reportes; validaciones, estados y cobros de Cotizaciones.
- Tipos aprobados y ESLint sin errores en los archivos cambiados. Permanecen ocho advertencias anteriores: variables/importación sin uso y una imagen sin optimización; no se atribuyen a esta entrega.
- Caja a 390 × 844: tabla de 807 px dentro de región de 305 px, desplazamiento horizontal con flechas y acceso a acciones. Segunda página conserva 20 filas y filtros. Reportes a 390 px: el ancho de la página no supera la pantalla y las tablas desplazan su contenido.
- Empezar Cotización deja Nombre/Razón social visible a 471 px en una pantalla de 900 px. Alta rápida: DNI máximo 8 y RUC máximo 11. Teléfono corto rechazado antes de avanzar, sin guardar; campos de prueba vaciados.
- Kardex local: cinco movimientos con fecha/hora de registro distinta de la fecha de operación. Filtro por Tabla Tornillo devuelve dos movimientos y conserva el producto en el enlace de Excel; tamaño 20 y bloque de productos 50 se conservan en la URL.
- Reportes: abril de 2026, compra de insumos, empresa. Dos movimientos (S/ 180 y S/ 480), gastos S/ 660 y resultado -S/ 660. Excel y CSV descargados desde el navegador y abiertos por lectura: mismas dos filas y totales. Vista imprimible PDF comprobada con el mismo resumen; **no se verificó el archivo PDF binario ni el diálogo de impresión**.
- Navegador local sin mensajes de error o advertencia detectados en el recorrido final de Reportes.

Compilación final aprobada (Next.js 16.2.4, webpack y comprobación de tipos). Servidor restituido en desarrollo demo con el mismo almacén y puerto 3001; Login responde HTTP 200 y Reportes muestra 1.1.69 con el resumen correcto tras reiniciar. La nota del programa y el historial coinciden, con 212 caracteres. Las huellas SHA-256 de ambos almacenes locales siguen iguales a la inicial: `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`.

Evidencias visuales locales: `temp/mejoras-externas-2026-10-08/reportes-movil.jpg` y `reportes-final.jpg`. Excel y CSV descargados: `katia-caja-seleccion-2026-10-08.xlsx` y `.csv` en Descargas. Son archivos de prueba, fuera de la aplicación y sin incluirse en la publicación.

## Seguridad y límites

Servidor reiniciado con `scripts/preview-visual.mjs`, puerto 3001, desarrollo demo y el almacén anterior `temp/propuesta-visual-1.1.64/store.json`. Supabase y Sentry desactivados en ese proceso. Operaciones de escritura rechazadas se probaron con respuestas aisladas; no se guardaron formularios, eliminaron movimientos ni cerraron períodos del negocio. No hay migraciones, nuevas dependencias ni cambios de conexión.

Producción conserva 1.1.68. Solo se abrió el login anónimo publicado para comparar el diseño, después de leer su ruta; no se probaron escrituras reales ni se publicó esta entrega. Las revisiones históricas siguen teniendo sus propios límites.

Archivos principales: `lib/reportes-resumen.ts`, `app/api/export/reportes-resumen/route.ts`, `app/print/reportes/page.tsx`, `components/reportes/reportes-resumen-panel.tsx`, `lib/listado-paginacion.ts`, `lib/cotizacion-cliente-validacion.ts`, `lib/inventario-historial.ts`. Se conserva Next.js/React/TypeScript, ExcelJS y la impresión del navegador usada por los documentos existentes; la documentación no participa en la ejecución.

## Nota de parche

Caja y Cotizaciones facilitan la navegación y validan mejor los datos. Inventario aclara el stock y la hora de registro; Reportes ofrece resúmenes filtrados en Excel, CSV y PDF. El aviso del login gana contraste.
