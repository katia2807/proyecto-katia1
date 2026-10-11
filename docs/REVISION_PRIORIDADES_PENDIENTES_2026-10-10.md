# Revisión adicional de prioridades — 10/10/2026

**Estado posterior:** los doce hallazgos se corrigieron y comprobaron en local en 1.1.73. Migración instalada el 11/10/2026 sin diferencias en los registros existentes; publicación del código en curso. Ver [correcciones, regresión y límites](CORRECCIONES_PRIORITARIAS_2026-10-10.md). El resto de este documento conserva el diagnóstico original y sus evidencias anteriores a los cambios.

Registro local **1.1.72**. La versión publicada continúa en **1.1.71**. Petición: buscar riesgos prioritarios que quedaron fuera del diagnóstico anterior. Esta entrega documenta hallazgos; **no corrige acciones, instala SQL ni publica cambios**. Los doce riesgos siguientes son P1 por pérdida de coherencia entre operaciones, cobros y existencias. No demuestran por sí mismos que ya hayan ocurrido en los datos del negocio.

## Qué se comprobó y por qué cambia el diagnóstico

Se siguieron los formularios y botones hasta sus acciones y las escrituras relacionadas. La consulta de producción fue exclusivamente `BEGIN TRANSACTION READ ONLY` sobre funciones, triggers, columnas y restricciones del catálogo: no se llamaron acciones financieras, borrados, cierres ni cobros con datos reales.

Se obtuvieron las definiciones **vigentes** de `cancelar_venta_mueble`, `descontar_stock_venta_mueble`, `sync_catalogo_to_inventario`, `sync_inventario_to_catalogo`, `sync_stock_from_movimiento`, `prevent_closed_period_changes`, `set_update_metadata` y `cerrar_mes`. Los seis triggers relevantes están habilitados. Kardex tiene `referencia`, pero **no `referencia_id`**. La relación de madera cortada con clientes impide su eliminación con `ON DELETE RESTRICT`.

Las acciones TypeScript originales y el SDK Supabase ejecutaron sus peticiones contra PostgreSQL en memoria (PGlite 0.5.8). El adaptador solo traduce el transporte HTTP a SQL y bloquea conexiones externas; no reproduce las reglas financieras. Se cargaron las funciones y seis triggers reales de stock/Caja, los controles CHECK consultados y la relación restrictiva relevante. Los errores de Caja/segundo producto se inyectaron exclusivamente en esa base ficticia. Sesión, numeración y lectura/escritura a disco se sustituyeron para aislar la prueba.

**Quince casos reprodujeron los doce hallazgos.** Sus aserciones comprueban el comportamiento incorrecto actual; no son pruebas de regresión que deban conservar esos errores. Permanecen fuera de la suite habitual. La suite anterior de 731 pruebas y su compilación no se volvieron a ejecutar, porque no hubo correcciones funcionales. La diferencia relevante es que aquella estructura mínima no incorporaba estos triggers heredados; por eso sus resultados no descartaban estos problemas de integración.

## Hallazgos confirmados

| ID | Operación y evidencia ficticia | Impacto y causa |
| --- | --- | --- |
| **P1-08 — corregir primero** | Editar un alquiler anuncia éxito: el depósito del contrato pasa a S/600 pero Caja conserva S/300. Editar Aserradero a S/1,200 conserva S/1,000 en Caja. Anular un movimiento devuelve éxito sin guardar `voided_at`. Marcar `periodo_cerrado=true` conserva `false`. | El trigger vigente `prevent_closed_period_changes()` retorna **OLD** tanto al borrar como al actualizar. En UPDATE deshace silenciosamente los cambios solicitados. Es una incidencia compartida que afecta también al editor nuevo de 1.1.71. Debe devolver NEW en las actualizaciones permitidas y conservar la protección de registros cerrados. |
| **P1-01** | Stock inicial 100; vender 2 muebles lo reduce a 98; cancelar la venta lo deja en **102**, elimina la venta y mantiene **S/1,000 activos en Caja**. | `cancelar_venta_mueble()` suma la cantidad al producto y después inserta un ajuste que vuelve a sumarla mediante el trigger de Kardex. La función no anula el cobro asociado. |
| **P1-02** | Al fallar Caja en la creación de una venta de 2 muebles, se borró la venta y no quedó cobro, pero Catálogo muestra **100** e Inventario **98**. | La compensación restaura únicamente `muebles_catalogo.stock_disponible`. El trigger de catálogo no replica stock en registros existentes; no restaura el descuento hecho en Inventario. |
| **P1-03** | Una compra rápida de 10 unidades a S/10 falla en Caja: stock **110**, egreso **0**. Al reintentar: stock **120**, un solo egreso **S/100** y dos entradas de Kardex. | Entrada de Inventario y egreso se guardan por separado. El fallo no revierte la entrada ni identifica el reintento como la misma compra. |
| **P1-04** | Se edita alquiler de S/1,000, depósito S/300, a S/2,000 y S/600. Se inyecta error de Caja: responde error, pero contrato queda **S/2,000 / S/600** y Caja **S/300**. | Se guarda el contrato antes de cambiar su cobro y no hay una transacción que revierta ambos. Este fallo es independiente del UPDATE silencioso P1-08. |
| **P1-05** | Con su cobro marcado cerrado, eliminar Aserradero y eliminar alquiler devuelven **ok**, borran la operación y conservan su ingreso de **S/1,000** o **S/300** activo. La actualización de Caja devolvió el rechazo de período cerrado. | Las acciones ignoran el error de anular Caja y continúan borrando el documento. No garantizan que documento y cobro cambien juntos. |
| **P1-06** | Venta de madera cortada descuenta 12 unidades: 100 → 88. Eliminar devuelve **ok**, borra la venta, pero stock sigue **88** y queda el movimiento de Kardex. La petición de borrado falla con **42703** por columna inexistente. | La acción filtra `inventario_movimientos.referencia_id`, inexistente en la base actual, e ignora el error. El propio código intenta revertir el inventario pero no lo consigue. Con P1-08 también permanece activo el ingreso. |
| **P1-07** | Venta de madera cortada con dos productos: primera salida de 12 guardada; segunda falla. Se borra venta y Caja, pero stocks quedan **88 / 100** y sobrevive una salida de Kardex. | La compensación borra cabecera y cobro, pero omite los movimientos ya guardados y la restauración de existencias. |
| **P1-09** | Con septiembre cerrado, reporte ficticio de S/100 y un movimiento bloqueado, registrar otro ingreso de S/50 con fecha de septiembre se acepta: Caja queda **S/150**, cierre sigue S/100 y el nuevo movimiento está desbloqueado. | El control real protege UPDATE/DELETE de filas marcadas, pero no INSERT ni la fecha de destino. Las acciones no consultan un cierre vigente antes de insertar. Es independiente de P1-08: incluso si se guarda bien la marca, entran filas nuevas. |
| **P1-10** | Stock 10; dos peticiones de madera cortada leen 10 y solicitan 8 cada una. Ambas se aceptan: **16 vendidas** con stock final **0**. | La disponibilidad se comprueba antes de guardar y sin reservar/bloquear el producto. El trigger aplica `greatest(0, stock + delta)` y oculta el exceso. La condición debe comprobarse dentro de la misma transacción del descuento. |
| **P1-11** | Venta normal de madera descuenta 10 y falla en Caja. Se borran venta y Kardex, pero stock queda **90** de las 100 iniciales; Caja cero. | El trigger de stock solo actúa en INSERT. Borrar el movimiento no devuelve el descuento; la compensación asume una reversión que no existe. |
| **P1-12** | Cliente con venta de mueble y madera cortada; se confirma «ELIMINAR TODO». Borra muebles y alquileres, pero el cliente no se elimina: queda madera cortada y error **23001** de relación restrictiva. Los cobros activos permanecen. | El borrado completo no incluye madera cortada y hace eliminaciones sucesivas sin transacción. Un rechazo al final conserva un resultado parcialmente destruido. La misma ruta tampoco coordina Caja y stock de lo eliminado. |

## Rutas para corregir

- **Caja / P1-08 y P1-09:** funciones SQL vigentes `prevent_closed_period_changes` y `cerrar_mes`; entrada manual en `app/actions.ts:507`. La nueva edición de Aserradero llama `editar_aserradero_con_caja` desde `app/actions.ts:5515`. El cambio deberá probarse con todos los triggers reales, no solo con la migración nueva.
- **Muebles / P1-01 y P1-02:** creación en `app/actions.ts:3338`, cancelación en `:3567`; botón `components/ventas/cancelar-venta-button.tsx`. El SQL de cancelación existe en producción aunque su definición original no esté en las migraciones del repositorio.
- **Compra rápida / P1-03:** `app/actions.ts:2738`, wrapper `submitInventarioCompraRapidaForm` y formulario de compras de Inventario.
- **Alquiler / P1-04:** `app/actions.ts:5111`, edición habitual del contrato. Debe comprobarse además que no cambie mientras otro usuario lo cierra.
- **Anulaciones / P1-05:** `app/actions.ts:5389` y `:5452`; tablas de Aserradero y alquileres en `components/sales/`.
- **Madera cortada / P1-06, P1-07 y P1-10:** creación `app/actions.ts:3692`, eliminación `:5594`; `components/sales/venta-madera-cortada-table.tsx`.
- **Madera / P1-11:** `app/actions.ts:918`, compensación tras el fallo de Caja. Mantener precio, modalidad y redondeo comercial existentes.
- **Cliente completo / P1-12:** `app/actions.ts:4801`; formulario de Dueña en `app/(dashboard)/gerencial/page.tsx:258`.

## Orden propuesto y límites

1. Resolver el trigger compartido P1-08 con pruebas reales de editar, anular, marcar cierre y rechazar cambios en registros cerrados. Revisar su instalación antes de desplegar acciones que dependan de él.
2. Coordinar cancelaciones y borrados con Caja y stock en una transacción: P1-01, P1-05, P1-06 y P1-12. Conservar historial y no aceptar éxito cuando una parte falla.
3. Guardar compras y ventas completas o revertirlas completas: P1-02, P1-03, P1-07 y P1-11. El reintento no debe crear otra operación de la misma solicitud.
4. Proteger edición de alquileres, disponibilidad concurrente y meses cerrados: P1-04, P1-10 y P1-09.

Son correcciones de integridad, no nuevas funciones ni cambios de fórmulas. Los doce hallazgos requieren atenderse antes de cerrar nuevamente el alcance financiero. No se ajustarán automáticamente cobros o stocks históricos: primero habrá que contrastar documentos, vínculos y lo recibido realmente. No se constató aquí un descuadre histórico del negocio.

`cerrar_mes` se leyó íntegramente, pero no se ejecutó su cierre completo en la estructura mínima: se comprobó el UPDATE exacto de su marca y una inserción en un período preparado como cerrado. La concurrencia se provocó coordinando las lecturas de dos peticiones; no equivale a una prueba de carga. No se repitió la matriz completa de roles ni la revisión de todo el programa. El aislamiento tampoco replica todo Supabase/Auth/Storage. Estos límites no eliminan los errores reproducidos en las reglas financieras vigentes.

Los dos casos de precisión monetaria ya pospuestos por el usuario permanecen pendientes. Se conserva el redondeo comercial de PT de Aserradero solicitado por la clienta. No hubo modificaciones de cálculos, preferencias ni datos reales.

## Evidencia local y continuidad

- `temp/auditoria-prioritaria-2026-10-10/reglas-vigentes.json` y `estructura-vigente.json`: catálogo técnico consultado, sin filas del negocio ni credenciales.
- `auditoria.test.ts`, `vitest.config.ts`, `hallazgos.json` y `resultado.json` en esa misma carpeta: quince reproducciones, transportes y cantidades ficticias. Excluidos de Git por `temp/`.
- Servidor reiniciado conservando desarrollo demo, puerto 3001 y `temp/propuesta-visual-1.1.64/store.json`; salud local HTTP 200, sin Supabase. SHA-256 del almacén conservado: `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`.
- Entrega modificada únicamente en documentos y constantes de versión/aviso. Producción sigue 1.1.71; no se subió esta revisión ni se instaló otra migración.

Nota local 1.1.72, 10/10/2026: Se amplió la revisión de Caja, ventas, alquileres e Inventario con pruebas aisladas de errores y reintentos. Quedan identificadas las correcciones prioritarias para evitar descuadres, sin alterar datos reales.
