# Correcciones adicionales — 11/10/2026, 1.1.75

**Implementación local verificada y migración instalada; publicación del código pendiente.** La aplicación publicada sigue en 1.1.73 hasta confirmar el despliegue. Este informe sustituye el estado pendiente de los hallazgos de [la revisión 1.1.74](REVISION_CRITICA_ADICIONAL_2026-10-11.md), conservada como evidencia del diagnóstico.

## Correcciones

| Hallazgo | Cambio concreto |
| --- | --- |
| CRIT-01 / N12 | Corrección histórica comprueba el rol efectivo en la acción y en SQL. Un perfil antiguo de dueña con `readonly` no puede cambiar documentos ni dinero. |
| CRIT-02 / N1–N1b | Kardex bloquea el borrado separado de ventas, compras rápidas, devoluciones y anulaciones vinculadas. Se conserva también la entrada sin egreso cuando tiene recibo de compra. La protección incluye borrado SQL directo y eliminación forzada del producto. |
| CRIT-03 / N2–N3 | El borrado manual y su reversión de stock usan una transacción con bloqueos. Un fallo conserva ambos; dos borrados distintos descuentan ambas entradas. No se recorta stock a cero para ocultar una entrada ya consumida. El borrado forzado de producto también se revierte si falla su eliminación final. |
| CRIT-04 / N4–N5 | Conteo compara las existencias vistas al elegir el producto con las actuales y registra solo la diferencia, dentro de la transacción. Editar nombre/costo/foto conserva stock si su campo no se cambió; un cambio deliberado sobre un stock desactualizado se rechaza sin guardar parcialmente. |
| CRIT-05 / N14 | Aserradero y Alquiler guardan documento, cobro y recibo de solicitud juntos. Sus formularios mantienen una clave ante error. Perder la respuesta después de confirmar no borra el documento ni duplica el cobro al reintentar. El cliente provisional pertenece a la misma transacción y conserva la identificación `PEND-`. |
| CRIT-06 / N10–N13 | Editar Cotización considera el dinero activo realmente recibido, incluidos adelantos de órdenes. El total no puede bajar de ese importe. La corrección histórica aplica el mismo límite en adelanto/crédito y conserva la sincronización al contado ya acordada. Guardados/cobros/cierres comparten el bloqueo de empresa antes de bloquear documentos. |
| LAT-01–LAT-03 / N7–N9 | Se retiran las escrituras de importación antigua, repetición antigua de gastos y compra antigua de madera, sin activar pantallas ocultas. Sus acciones fallan antes de escribir y la RPC antigua de compra queda bloqueada. Los históricos y la compra rápida habitual de Inventario se conservan. |
| MED-01 / N6 | Catálogo refleja las existencias de un mueble también cuando cambian desde el trigger anidado de Kardex. Sincronización por ID y empresa, conservando el precio de venta independiente del costo. |
| MED-02 / N11 | SQL aplica la misma equivalencia de roles que la aplicación: operaciones → gerencia, readonly → vendedor y equivalencias heredadas. Los RPC nuevos permanecen exclusivos del servidor. |

## Archivos principales

- `app/actions.ts`, `lib/demo-store.ts`, `lib/operaciones-integrales.ts` y `lib/servicios-integrales.ts`.
- Campos internos de solicitud/stock en los formularios de Aserradero, Alquiler, edición de producto y Conteo. Sin rediseño de sus pasos habituales.
- Migración nueva: `supabase/migrations/20261011020000_integridad_adicional_operaciones.sql`. Las migraciones anteriores instaladas se conservan intactas.
- Regresiones: `tests/unit/integridad-adicional-acciones.test.ts`, casos locales adicionales y `tests/integration/operaciones-postgres.mjs`.

## Evidencia comprobada

- **776 pruebas en 56 archivos aprobadas** en la batería general. Incluye 26 regresiones de acciones con SDK real y PostgreSQL en memoria, más cinco casos locales nuevos de disco, conteo, editor, adelantos y cliente provisional.
- **11 casos aprobados en PostgreSQL 17.11**, con conexiones independientes y espera de bloqueos reales comprobada: sobreventa, reintento, cierre, anulación, dos borrados manuales, conteo frente a entrada en ambos órdenes, editor frente a venta, dos envíos de Aserradero, dos de Alquiler y edición frente a cobro. Todos usan estructura y registros ficticios, sin `.env` ni conexiones remotas. Servidor de pruebas detenido al finalizar.
- Los fixtures incluyen triggers heredados, restricciones y el tipo real de estado de Cotizaciones. Se retiraron dos casos antiguos basados en transportes de guardado sustituidos; sus requisitos de costo/precio independiente y edición concurrente están comprobados ahora con SQL real.
- Evidencias privadas ignoradas por Git: `temp/pruebas-1.1.75/suite-final.json` y `temp/pruebas-operaciones-postgres/916625f1-cc39-449d-98e4-89f673f56acd/resultado.json`. La prueba nativa se corrigió para coordinar por bloqueos en vez de depender de pausas y del orden de arranque de las conexiones.
- Tipos de aplicación y pruebas, compilación optimizada y revisión de cambios aprobados. ESLint sin errores; conserva cinco advertencias anteriores en los archivos de aplicación revisados. Nota 1.1.75 de 212 caracteres coincide en aviso e historial.
- Local reiniciado en desarrollo, mismo puerto 3001 y almacén aislado. Salud 200 y Supabase desactivado. Revisión visual completada en Edge después del reinicio: editor de producto, selección de Conteo y pasos de Aserradero/Alquiler hasta sus resúmenes, sin guardar. Se comprobó la presencia de los campos internos de referencia/solicitud; el navegador oculta sus valores y no se atribuye una inspección de esos valores. Aserradero conserva el ejemplo 2 × 10 × 8 → 13 PT comerciales / S/6.50; Alquiler conserva 80 × 2 → S/160 y garantía S/48. Sin errores de consola detectados. Los intentos iniciales de la pestaña integrada agotaron el tiempo; Edge permitió completar el recorrido.
- Las huellas de `temp/propuesta-visual-1.1.64/store.json` y `data/store.json` coinciden con las previas a este trabajo. No se probaron operaciones sobre los datos del negocio.

## Publicación y límites

Se instaló la migración exacta `20261011020000` en la única base habitual, después de un respaldo completo nuevo de solo lectura. Respaldo privado: `temp/publicacion-1.1.75/respaldo-previo/base-completa.dump`, 714,735 bytes, SHA-256 `10c76aed40a8bbf5a01cb3f78efebc1f6503cce9cddfa6126e490d50e0067d24`; índice legible y exportación sin advertencias. Comparación transaccional y posterior: 46 tablas / 274 registros conservados sin diferencias. Diez funciones restringidas al servidor; tabla de reintentos con RLS y sin filas. La versión registrada y su MD5 coinciden con el archivo revisado. Publicar ahora el código y comprobar las pantallas por lectura; no probar guardados sobre el negocio.

La migración está instalada; aún no se confirma la publicación del código 1.1.75. No se reconciliaron ni modificaron documentos, saldos, existencias o cuentas del negocio. Las fórmulas y el redondeo comercial de Aserradero se conservan; los dos casos medios de precisión monetaria pospuestos siguen fuera del alcance. Esta revisión confirma los casos descritos, no garantiza ausencia de otros errores.

## Nota de parche

Se corrigieron borrados, conteos y reintentos que podían alterar stock o duplicar cobros. Cotizaciones respeta los adelantos recibidos y los permisos se aplican correctamente, sin cambiar los cálculos habituales.
