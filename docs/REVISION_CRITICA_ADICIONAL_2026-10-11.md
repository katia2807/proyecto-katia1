# Revisión crítica adicional — 11/10/2026

**Actualización 1.1.75:** los hallazgos siguientes tienen correcciones locales y regresiones en [el informe de correcciones](CORRECCIONES_ADICIONALES_2026-10-11.md). Instalación SQL y publicación pendientes; este documento conserva las reproducciones del error anterior.

Registro **1.1.74 solo local** sobre el código publicado 1.1.73. Se confirmaron **seis grupos de prioridad alta en funciones activas**, tres riesgos altos en acciones antiguas sin conexión visible y dos incidencias medias. **No se corrigieron funciones, instalaron migraciones ni publicaron cambios.** No se constató que estos errores hayan ocurrido en el negocio.

## Evidencia y alcance

Se siguieron los editores y botones actuales de Inventario, Aserradero, Alquiler y Cotizaciones hasta sus acciones, consultas, escrituras y triggers. Se extrajo únicamente el esquema público del respaldo privado creado el 11/10 a las 00:03 de Perú; no se restauró una base ni se consultó producción en esta revisión. Sobre la estructura ficticia anterior se ejecutaron las migraciones financieras 1.1.71 y 1.1.73, más la función real de corrección histórica. Las restricciones de cantidades, índices de código y origen de órdenes se contrastaron con ese esquema.

Las acciones TypeScript actuales y el SDK Supabase real se ejecutaron contra PostgreSQL PGlite 0.5.8 en memoria. El adaptador traduce peticiones a SQL, admite solo tablas/RPC permitidas y bloquea la red. Normaliza números y fechas como los envía PostgREST; no reproduce reglas financieras. Sesión y numeración son ficticias; lectura y escritura del almacén de disco están sustituidas. Fallos de escritura, lecturas simultáneas y respuestas perdidas se provocaron únicamente en ese entorno.

**Dieciséis reproducciones aprobadas**: once casos de funciones activas agrupados en seis hallazgos altos, tres casos de acciones antiguas y dos incidencias medias. Sus aserciones describen errores observados, **no prueban que estén corregidos**. Quedan fuera de la suite habitual para no convertir el fallo en requisito. Antes de confirmar los resultados se corrigieron dos diferencias del transporte ficticio —numeric como texto y date con hora—; no son fallos atribuidos a la aplicación.

## Prioridad alta en funciones activas

| ID / prueba | Problema confirmado y condición | Corrección necesaria |
| --- | --- | --- |
| **CRIT-01 / N12 — permisos** | Una cuenta con `role=owner_admin` heredado y `ui_role=readonly` tiene rol efectivo Vendedor y no ve la corrección histórica. Sin embargo, la acción y RPC revisan el rol antiguo: aceptan una petición que cambia venta y Caja de S/1,000 a **S/1,200**. Requiere esa combinación concreta de perfil; no afecta a cualquier lector. | Aplicar el rol efectivo en la acción y SQL. Una cuenta de solo lectura no debe cambiar dinero aunque conserve un rol antiguo. Corregir primero. |
| **CRIT-02 / N1 y N1b — Kardex vinculado** | Borrar una salida de venta desde Kardex restaura stock **90 → 100**, aunque venta e ingreso de **S/1,000** siguen activos. Borrar la entrada de una compra rápida restaura **110 → 100**, pero deja **S/100** de egreso activo. Su recibo de solicitud sigue marcado: repetir esa compra no repone el movimiento borrado. | Impedir la eliminación independiente de movimientos vinculados y remitir a la corrección/anulación de su origen. Conservar los movimientos manuales corregibles. |
| **CRIT-03 / N2 y N3 — borrado manual separado** | Al fallar la actualización del producto después de borrar un movimiento, este desaparece y stock sigue **110**. En dos borrados coordinados de entradas de 10 y 20, ambos leen stock 130: desaparecen las dos entradas, pero stock acaba en **110** en vez de 100. | Borrar y revertir stock dentro de una transacción que bloquee el producto y compruebe el resultado. Un error debe conservar ambas partes; no ocultar un saldo negativo. |
| **CRIT-04 / N4 y N5 — guardados desactualizados** | Conteo lee 100, aparece una entrada de 10, inserta ajuste +20 y sobrescribe stock con 120: Kardex explica **130**, producto **120**. Abrir el editor con 100, vender 10 y guardar solo un nombre arrastra su campo antiguo de stock: devuelve **90 → 100** sin ajuste, con la venta vigente. | Resolver el conteo en una transacción y detectar vistas desactualizadas al guardar. Conservar la edición deliberada de stock; evitar que cambios de nombre/foto sobrescriban ventas posteriores. |
| **CRIT-05 / N14-aserradero y N14-alquiler — cobro sin documento** | Caja confirma un ingreso, pero se pierde su respuesta. La creación interpreta que falló y borra servicio o contrato: queda **cobro activo sin documento**. Reintentar Aserradero deja un servicio pero **S/2,000** registrados por uno de S/1,000; Alquiler deja un contrato y **S/600** de depósitos por uno de S/300. | Guardar documento y cobro juntos, con clave que reconozca el mismo envío tras perder su respuesta. Cierre, edición y anulación anteriores no cubren esta creación. |
| **CRIT-06 / N10 y N13 — total inferior a lo recibido** | Cotización en producción con adelanto real de S/300 permite guardar total de **S/100**; después su consulta de saldo se bloquea por cobro excesivo. La corrección histórica de madera con adelanto permite venta de **S/100** y mantiene ingreso activo de **S/300**. | Comprobar el dinero recibido al editar/corregir dentro de la misma transacción. Rechazar un total inferior o requerir un proceso explícito de devolución; no cambiar fórmulas ni ajustar dinero antiguo automáticamente. |

### Archivos para continuar

- CRIT-01: `app/actions.ts:4929`, `lib/permissions.ts:87` y `supabase/migrations/20260903130000_correct_historical_madera_cortada.sql:50`. La sesión sin lista de roles es válida; el fallo es comprobar después el rol antiguo en vez del efectivo.
- CRIT-02/03: `app/actions.ts:2810` y botones de `components/inventario-interactivo.tsx:1456`. El trigger actual de stock opera en INSERT; no devuelve existencias al borrar automáticamente.
- CRIT-04: `app/actions.ts:2631` y `:2861`; `components/inventario/inventario-producto-edit-modal.tsx:108` envía siempre el stock cargado, incluso al cambiar otro campo.
- CRIT-05: `app/actions.ts:3467` y `:3782`. Ambas altas reales usan peticiones separadas y una compensación de borrado; la agrupación local existente no protege el transporte de Supabase.
- CRIT-06: `app/actions.ts:1255` y `:4929`; SQL de corrección histórica y lectura de cobros en `supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql`.

## Riesgos altos en acciones antiguas sin conexión visible

No se encontraron referencias de estas acciones en los formularios actuales. **No se presentan como botones activos ni se recomienda habilitarlas.** El código exportado permanece en `app/actions.ts`; habrá que retirarlo si quedó sustituido o protegerlo antes de conectarlo. No se verificó su exposición por el manifiesto de acciones de un build de producción.

| ID / prueba | Resultado aislado | Ubicación y alcance |
| --- | --- | --- |
| **LAT-01 / N7 — importar gastos** | Archivo con gasto válido de S/100 y segundo gasto en septiembre cerrado: devuelve error, pero guarda el primero. Repetir el archivo deja **dos gastos / S/200**, con otro error; no reconoce el lote ni revierte lo guardado. | `importarArchivo`, `app/actions.ts:678`. `/admin/importar` está deshabilitado por `FEATURES.importar=false`; su componente tampoco llama a esta acción. |
| **LAT-02 / N8 — repetir gastos** | Copia un egreso anulado del mes anterior y lo convierte en **S/100** de gasto activo nuevo; no filtra `voided_at`/`deleted_at`. | `repetirGastosMesAnterior`, `app/actions.ts:564`. Su wrapper tampoco tiene referencias visibles actuales. |
| **LAT-03 / N9 — comprar madera** | RPC confirma compra/egreso de S/100, se pierde la respuesta y falla el formulario. Repetirlo crea **dos compras / S/200** de egreso. La transacción evita escrituras parciales, pero no reconoce el mismo envío. | `createCompraMadera`, `app/actions.ts:1940`. Comparador lee compras históricas; no se encontró un formulario actual que llame a esta acción. Compra rápida activa usa otra ruta. |

## Incidencias medias confirmadas

| ID / prueba | Resultado y alcance | Próximo ajuste |
| --- | --- | --- |
| **MED-01 / N6 — stock mostrado distinto** | Compra rápida de 10 muebles: Inventario muestra **110** y Catálogo **100**, con egreso 100. El trigger de sincronización sale cuando está anidado bajo el de Kardex. Venta integral comprueba ambas existencias y rechaza un exceso: se confirmó inconsistencia y posible rechazo de stock disponible, **no sobreventa**. | Sincronizar existencias por ID al terminar el movimiento, sin doble descuento ni recursión. La función heredada se reproduce en `tests/unit/fixtures/finanzas-heredado.sql:211` y permanece igual en 1.1.73. |
| **MED-02 / N11 — permiso de operaciones** | Aplicación traduce `ui_role=operaciones` a Gerencia. RPC financieras comparan literalmente `operaciones`, rechazan la solicitud y no guardan nada. Cuenta Dueña no está afectada por este caso. | Compartir la resolución de rol entre servidor y SQL: `lib/permissions.ts:42` y `supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql:16`. |

## Orden de corrección y límites

1. Cerrar CRIT-01 en ambos límites de permisos, con matriz de roles heredados y `ui_role`.
2. Coordinar Kardex, conteos y editores: CRIT-02/03/04; incorporar MED-01 sin alterar precios ni aplicar movimientos dos veces.
3. Agrupar creación de servicios/contratos: CRIT-05. Cubrir pérdida de respuesta después de confirmar, además del fallo SQL antes de confirmar.
4. Proteger importes ya cobrados al editar: CRIT-06; incluir adelantos de órdenes vinculadas.
5. Resolver MED-02 y decidir retirada/protección de las tres acciones antiguas; no activar funciones ocultas para arreglarlas.

La concurrencia se provocó coordinando lecturas de peticiones independientes del SDK a una sola base en memoria. **No se ejecutaron conexiones PostgreSQL nativas independientes ni pruebas de carga** en esta revisión. Tampoco se repitieron la suite completa de 747 pruebas, el build, toda la matriz de roles, Auth/Storage o el recorrido publicado. Las verificaciones anteriores de 1.1.73 mantienen su alcance y no descartan estas rutas adicionales.

La comprobación de tipos de la aplicación pasó después del registro documental. Se verificaron el formato del diff, la referencia al informe y la coincidencia exacta de la nota del aviso con el historial (215 caracteres). Solo cambian este informe, el estado, las notas y las constantes de versión; los archivos privados de reproducción permanecen excluidos de Git.

No se recalcularon fórmulas, importes antiguos ni stocks del negocio. Los dos casos medios de redondeo pospuestos y el redondeo comercial de PT de Aserradero siguen iguales. Resolver estos hallazgos requerirá otra entrega y sus pruebas; este registro no equivale a repararlos ni a garantizar ausencia de otros errores.

Evidencia privada en `temp/auditoria-critica-2026-10-11/`: `auditoria.test.ts`, `vitest.config.ts`, `resultado.json`, `hallazgos.json` y `esquema-previo.sql`. Sin credenciales, excluida de Git. No se creó otra base del negocio. Local reiniciado en desarrollo demo, puerto 3001 y mismo almacén `temp/propuesta-visual-1.1.64/store.json`; salud 200, sin Supabase. SHA-256 conservado antes/después: `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`. Todas las reproducciones tenían sustituido el acceso al almacén original.

Nota local 1.1.74, 11/10/2026: Se amplió la revisión con pruebas aisladas de permisos, Kardex, conteos y reintentos. Se identificaron riesgos nuevos que pueden alterar cobros o existencias, con evidencia y prioridades, sin modificar datos reales.
