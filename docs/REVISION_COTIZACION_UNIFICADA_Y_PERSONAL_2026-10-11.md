# Revisión adicional de Cotización unificada, Producción y Personal

Fecha: 11/10/2026. Base funcional: 1.1.78 publicada. Registro del diagnóstico: **1.1.79 solo local**. Estado posterior: los ocho hallazgos se repararon localmente en 1.1.80/1.1.81; [correcciones, pruebas y límites](CORRECCIONES_COTIZACION_UNIFICADA_Y_PERSONAL_2026-10-11.md). La instalación y publicación siguen pendientes. El contenido siguiente conserva el diagnóstico anterior, no las conclusiones de reparación.

## Alcance y evidencia

Se inspeccionaron los guardados y reintentos de Cotización unificada, el cambio de cliente con orden y adelanto, la aprobación y los estados de Producción, y el registro de adelantos de Personal. Se conservaron las fórmulas, el redondeo comercial de Aserradero, los casos de redondeo pospuestos y la separación existente entre nómina y Caja.

**11 casos aprobados: nueve reproducciones y dos controles.** Las aserciones de las reproducciones describen el comportamiento incorrecto observado; aprobarlas confirma el diagnóstico, no una reparación. Se ejecutaron las acciones actuales de `app/actions.ts` con el SDK real de Supabase y PostgreSQL en memoria (PGlite). El transporte sustituido ejecuta SQL solo en esa base ficticia y rechaza cualquier dominio distinto de `audit.invalid`. Autenticación, configuración, correlativos y persistencia en disco están simulados. No se consultó producción.

El esquema financiero procede de las fixtures de regresión y las migraciones vigentes hasta `20261011030000`, incluidos los triggers heredados de esos flujos. Se completaron el ID predeterminado de cotizaciones y `updated_at` de órdenes que faltaban en la fixture reducida. Para Personal se incorporó un esquema mínimo con FK al empleado, monto positivo y estado pendiente; el catálogo del respaldo privado anterior no registra triggers de adelantos. Esto no equivale a comprobar todos los permisos, políticas, restricciones o triggers de producción.

Los ejemplos usan una cotización ficticia de muebles por S/ 1,000, con margen cero y costo de mano de obra, y clientes/empleado ficticios. Los fallos de respuesta se provocan **después de confirmar la escritura**: se devuelve un error 503 y luego se repite la solicitud. No se hicieron pruebas de carga ni de concurrencia con conexiones independientes, ni guardados mediante el navegador habitual.

Evidencia privada conservada, fuera de la suite habitual: `temp/revision-1.1.79/auditoria.test.ts`, configuración propia y `resultado.json`. No integrar estas aserciones del comportamiento incorrecto en las pruebas exigidas para publicar; al reparar, convertir cada caso en una regresión que exija el resultado correcto.

## Prioridad alta: cuatro hallazgos

| ID | Disparador y resultado confirmado | Impacto y dirección de corrección |
| --- | --- | --- |
| UNI-01 | Primer guardado sin ID; la inserción se confirma, se pierde la respuesta y el usuario reintenta. Quedan dos cotizaciones de S/ 1,000, total documental S/ 2,000. Caja sigue en S/ 0. | Duplicación del documento y riesgo de procesarlo dos veces posteriormente. Generar una clave estable antes del primer envío y reconocer el guardado previo sin impedir dos documentos distintos legítimos. |
| UNI-02 | Solicitud alterada al alta con `estadoFlujo: cobrada`. La acción acepta una cotización de S/ 1,000 como cobrada; Caja sigue en S/ 0. | El estado deja de representar un cobro real. Validar el estado inicial en el servidor y reservar «cobrada» al cobro registrado. La restricción del tipo TypeScript no valida una entrada recibida. |
| UNI-03 | Aprobar una cotización del cliente A con S/ 300 de adelanto; editarla y elegir el cliente B. El guardado se acepta: cotización B, orden A y adelanto vinculado a esa orden. | Identidad contradictoria entre documentos. El importe no cambia: Caja S/ 300, cobrado de la cotización S/ 300 y saldo S/ 700. Impedir cambiar la parte vinculada después de generar orden/cobros o definir una corrección coordinada y autorizada que conserve la atribución financiera. |
| UNI-04 | Solicitud alterada con el ID de un cliente de una segunda organización ficticia. Se crea una cotización de la organización del actor que apunta al cliente ajeno. | Falta un control de pertenencia en el alta; la FK por sí sola comprueba existencia. Validar el cliente dentro de la organización autenticada y guardar con esa identidad. La prueba no demuestra que exista otra empresa real ni que la selección normal permita elegirla. |

UNI-01 y UNI-03 afectan a acciones disponibles en el uso habitual. UNI-02 y UNI-04 requieren entradas alteradas; el formulario normal no envía esos valores, pero la acción expuesta debe rechazarlos. No se afirma que estos fallos hayan ocurrido en los datos del negocio.

Fuentes principales:

- `app/actions.ts`, `saveCotizacionUnificada`: el alta inserta un ID generado por la base y un correlativo nuevo en cada intento; valida el detalle y total, pero usa directamente el estado y cliente recibidos.
- `components/cotizacion-unificada-wizard.tsx`: el primer envío lleva `id: guardadaId ?? undefined`; `guardadaId` solo se asigna tras recibir éxito. El selector permite cambiar el cliente durante la edición y no borra el ID guardado.
- `supabase/migrations/20261011020000_integridad_adicional_operaciones.sql`, `editar_cotizacion_unificada_segura`: protege importe, estado y dinero recibido, pero cambia el cliente de la cotización sin coordinar la orden vinculada.
- `app/(dashboard)/ventas/muebles-personalizados/page.tsx`: el historial usa el cliente de la cotización y el tablero usa el de la orden. La posibilidad de mostrar nombres distintos se deduce de ese mapeo y de los IDs reproducidos; no se guardó el caso en el navegador habitual.
- `lib/gerencial-model.ts`: las cotizaciones «cobradas» integran operaciones. UNI-02 puede introducir un documento falsamente cobrado en esa fuente; no se reprodujo la pantalla gerencial ni se afirma un saldo de Caja incorrecto.

## Prioridad media: tres hallazgos

| ID | Disparador y resultado confirmado | Alcance y dirección de corrección |
| --- | --- | --- |
| PER-01 | Registrar S/ 150 de adelanto de Personal, perder la respuesta después de confirmar y repetir. Quedan dos adelantos pendientes por S/ 300. | No genera movimientos de Caja en este flujo. Añadir reconocimiento del mismo envío, como ya tiene el sueldo, sin automatizar pagos ni descuentos y sin impedir dos adelantos diferentes legítimos. |
| PRO-01 | La lista «Aprobar → Orden + Adelanto» incluye cotizaciones unificadas pendientes o cobradas sin orden. La acción rechaza ambas. Se reprodujeron dos casos: pendiente sin Caja y cobrada mediante un ingreso real ficticio de S/ 1,000, con adelanto de aprobación cero. | Opciones que prometen una acción que no se puede completar. En ambos rechazos no se crea orden ni cambia Caja. Alinear opciones y validaciones; si se conserva la producción de un pedido ya pagado, crear solo la orden, sin volver a cobrar ni desmarcar su pago. |
| PRO-02 | Aprobar con S/ 300 de adelanto y mover la orden a «entregado». La orden cambia, la cotización queda «en_produccion» y Caja conserva S/ 300. | Incoherencia del seguimiento. Mostrar la fase de producción de la orden vinculada sin confundirla con el estado de cobro ni sobrescribir «cobrada». No se detectó por este caso un cambio del saldo ni se atribuye un fallo a la agenda gerencial. |

Fuentes: `createAdelanto`, `aprobarCotizacionAOrden` y `cambiarEstadoOrden` en `app/actions.ts`; `components/personal/personal-context-panels.tsx` (el adelanto no usa clave estable, el sueldo sí); `app/(dashboard)/ventas/muebles-personalizados/page.tsx` (filtro de opciones y mapeo de estados); `aprobar_cotizacion_con_adelanto` en las migraciones financieras. La aprobación unificada acepta `lista_produccion`/`en_produccion`, mientras su selector incluye `pendiente`/`lista_produccion`/`cobrada`.

## Riesgo latente: acción con botón oculto

**LAT-01:** `pasarCotizacionAProduccion` cambia la cotización y después inserta la orden en operaciones separadas. Si se pierde la respuesta de una orden ya insertada, el manejo de error devuelve la cotización a `lista_produccion`, aunque la orden existe. El reintento rechaza porque ya existe esa orden. Se confirmó una orden, ninguna duplicación y Caja S/ 0.

Su llamada en `components/cotizacion-unificada-wizard.tsx` está dentro de un contenedor `hidden`. No presentarlo como un botón habitual que falla. Si la acción se conserva, necesita guardado conjunto y reconocimiento del reintento; si está sustituida, retirarla o bloquearla sin activar otra función oculta. La aprobación visible usa otro camino y no debe confundirse con esta acción.

## Controles que funcionaron

- Tras recibir el ID de la cotización unificada, volver a guardar con ese ID conserva un solo documento y Caja S/ 0. El fallo UNI-01 corresponde a perder la respuesta del primer alta.
- La Cotización rápida corregida en 1.1.77 reconoce el reintento con la misma clave después de perder la respuesta: una sola cotización y Caja S/ 0. Esa corrección no cubre automáticamente el alta unificada.

## Continuidad y límites

El servidor local habitual se reinició en desarrollo con el mismo puerto 3001 y almacén de la propuesta. Salud HTTP 200: demo forzado, Supabase desactivado; Muebles personalizados mostró 1.1.79 en Edge sin guardar formularios. Las dos huellas SHA-256 coinciden con el inicio de la revisión: `temp/propuesta-visual-1.1.64/store.json`, `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`; `data/store.json`, `E388D7F712A5676027837CF7011305926633CC9BE15EBE575E85DE64C8A70B90`.

Tipos de la aplicación y comprobación del diff aprobados. Nota de 206 caracteres idéntica en el aviso y el historial. No se repitieron la compilación optimizada ni la batería completa: el único código entregable modificado es la información de versión, y los once casos del diagnóstico se ejecutan por separado. No se realizó una nueva verificación de producción.

Corregir primero UNI-01 y UNI-03 por su incidencia en el trabajo habitual, junto con los controles de alta UNI-02/UNI-04. Después PER-01 y las coherencias PRO-01/PRO-02; tratar LAT-01 como acción oculta. Las decisiones de presentación y seguimiento deben conservar el flujo del cliente, separar pago de producción y evitar cobros automáticos.

La documentación y la nota de versión son los únicos cambios entregables de esta revisión. No se repararon estas acciones, no se instalaron migraciones y no se publicó 1.1.79. Las comprobaciones históricas no se invalidan ni se amplían automáticamente por estos nuevos hallazgos. Tampoco se garantiza que no queden otras incidencias.
