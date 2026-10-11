# Correcciones financieras de prioridad alta — 10/10/2026

Versión 1.1.71. Alcance autorizado: solucionar los problemas de prioridad alta encontrados en el diagnóstico de la versión 1.1.70, conservando las fórmulas comerciales y los datos existentes. **Migración instalada en la base habitual; publicación del código en curso.** El diagnóstico original permanece en `temp/auditoria-financiera-2026-10-10/INFORME.md` como evidencia anterior.

## Hallazgos corregidos

| Caso del diagnóstico | Corrección y resultado comprobado con datos ficticios |
| --- | --- |
| Madera registra el total aunque sea crédito o adelanto | El formulario envía los campos de pago y la acción los valida. Una venta de S/1,000 registra S/0 a crédito, S/300 con ese adelanto y S/1,000 al contado. Guarda la modalidad para posteriores lecturas. |
| Aserradero registra el precio completo en todos los casos | Registra únicamente el importe recibido, conserva los campos de pago en local y usa la misma validación en el servidor. El editor ya no convierte un crédito o adelanto existente en cobro total. |
| Yape figura como efectivo en madera y aserradero | Caja usa el medio seleccionado; transferencia se corresponde con Banco y billetera digital conserva la correspondencia habitual con Yape. |
| Cotización cobra de nuevo el adelanto de la orden | La consulta reconoce ingresos y egresos activos vinculados directamente a la cotización o al adelanto de sus órdenes, separados por empresa. Un adelanto de S/300 y un cobro posterior de S/700 suman S/1,000. El diálogo muestra total, cobrado y saldo real; un saldo cambiado impide confirmar una vista anterior. |
| Dos cierres de alquiler duplican el saldo | El cierre bloquea el contrato durante la operación y rechaza otro cierre. En el caso de S/1,000 y depósito S/300 se registra una sola vez S/700. |
| Fallo de Caja deja el alquiler cerrado | Penalidades, saldo y estado se guardan en una transacción. Un fallo incluso después del primer movimiento revierte todo. El reintento funciona. |
| Compra confirmada queda sin egreso al fallar Caja | Compra y egreso comparten transacción; el fallo revierte la compra. El cálculo de contado/fiado, adelanto y saldo pendiente conserva su comportamiento. |
| Importador PDF genera datos simulados y deja una venta incompleta | Se retira el componente visible que no leía el archivo y se bloquea su acción antigua antes de escribir. El registro manual y los adjuntos habituales siguen disponibles. No se anuncia un lector PDF real. |
| El servidor permite un adelanto superior al total | Se valida antes de escribir en muebles, madera cortada, madera, aserradero, contratos y aprobación de cotizaciones. Un adelanto de S/1,500 para un total S/1,000 se rechaza. |

El guardado conjunto también cubre la creación de la orden con su adelanto y el cobro final con el estado de la cotización. El editor de Aserradero guarda servicio y movimiento juntos, verifica que la vista no esté desactualizada y bloquea movimientos de períodos cerrados o vinculaciones ambiguas. En local se restaura la memoria cuando falla el guardado estricto del archivo, sin escribir versiones intermedias.

## Archivos principales y tecnologías

- `app/actions.ts`: validación del pago y llamadas a las operaciones financieras completas; consulta del saldo para el diálogo.
- `lib/ventas-pago.ts`: importe recibido según modalidad y mensaje explícito cuando falta instalar la migración.
- `lib/cotizacion-cobros.ts`: pagos vinculados y saldo de la copia local, acumulados en centavos.
- `lib/demo-store.ts`: conserva datos de pago y agrupa escrituras locales con recuperación ante fallo.
- `components/sales/venta-madera-form.tsx`: envío de modalidad, medio y adelanto; dependencias completas de la validación del paso.
- `components/sales/cobro-cotizacion-dialog.tsx`: consulta previa del cobro real, carga/error visibles y confirmación del saldo mostrado.
- `supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql`: funciones transaccionales, bloqueos de fila y comprobación de organización/rol. Ejecución restringida a `service_role`; no accesibles por una sesión pública.
- `tests/unit/finanzas-acciones.test.ts` y `fixtures/finanzas.sql`: SDK real de Supabase, adaptador de protocolo sin red y PostgreSQL PGlite en memoria. PGlite 0.5.8 es dependencia de desarrollo para comprobar la migración, sin formar parte del programa de producción.
- `tests/unit/finanzas-local.test.ts`: acciones y almacén local reales con persistencia sustituida por memoria.

No cambian `lib/utils.ts`, las fórmulas de cubicaje/precios, el margen comercial, el depósito habitual del 30% ni las penalidades del 3%. La actualización cambia lo cobrado y su integridad, no la forma de calcular el precio.

## Comprobaciones realizadas

- **731 pruebas aprobadas, 55 archivos**. Incluyen 34 comprobaciones nuevas con SQL real de la migración y 12 del modo local: contado/crédito/adelanto, límites, medios, doble envío, saldo previo, fallo parcial y reintento, editor de Aserradero y permisos.
- Instalación en una base ficticia que ya tenía ingresos y un adelanto excesivo histórico: las filas y sus importes permanecen iguales. Las nuevas restricciones `NOT VALID` no reclasifican ni corrigen filas anteriores; sí impiden nuevos adelantos excesivos.
- Tipos de aplicación y pruebas aprobados. Revisión de componentes React completada; ESLint de archivos afectados sin errores, con cinco avisos de variables/parámetros sin uso. La validación del formulario de madera se recalcula con el RUC y el comprobante actuales, sin una memoria parcial de sus dependencias.
- Compilación final aprobada con `preview-visual.mjs --build`, sin Supabase ni escritura en datos del negocio. Servidor local restituido en desarrollo demo, puerto 3001, con el mismo almacén aislado. Salud responde HTTP 200 y confirma `usesSupabaseForData: false`.
- Ventas y Cotizaciones responden HTTP 200 en sus rutas propias con la sesión ficticia de desarrollo, muestran los títulos esperados y contienen la versión 1.1.71. Sin sesión redirigen al inicio de sesión, como corresponde. Esta comprobación del HTML no equivale a un recorrido visual o de interacción con navegador.
- Almacenes habitual y de la propuesta local conservan la huella SHA-256 `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9` en la comprobación posterior a las pruebas. Las operaciones financieras de las pruebas no tocaron esos archivos.
- Nota del aviso y del historial: versión 1.1.71, fecha 10/10/2026, mismo párrafo de 208 caracteres.

Las pruebas PostgreSQL ejecutan las funciones reales sobre un esquema mínimo ficticio; no reproducen todos los triggers, permisos, índices o conexiones del Supabase publicado. Las llamadas superpuestas comprueban el control de duplicados y la coordinación de aprobación/cobro en el motor aislado; no constituyen una prueba de carga ni de múltiples conexiones simultáneas en producción. No se hizo un recorrido visual nuevo ni una conciliación del historial real del negocio.

## Instalación y publicación — 10/10/2026

La base habitual `rzjxobfgtlzdqmhbbvsk` recibió únicamente la migración `20261010010000_cobros_y_cierres_seguros.sql`. Su huella MD5 `a3c5dca96b5539cb06017ae2c2e32688` coincide con el archivo revisado y quedó registrada en el historial de migraciones. La instalación se ejecutó en una transacción; un primer intento se rechazó antes de modificar el esquema por los saltos de línea de Windows. Tras normalizarlos se conservó la comprobación del contenido exacto y la instalación terminó correctamente.

El respaldo manual conservado del 07/10/2026 mantiene su SHA-256 `f58116f333edce08c28ebb412d4083e4b7d0a5be9aa9a911720744363571d41d`; no es una copia nueva. La comparación inmediata antes/después de la instalación abarca las 42 tablas públicas más usuarios de Auth, depósitos y objetos de Storage: **45 tablas, 274 registros, cero diferencias**. Huella conjunta `c39dc3cca390f29bbcc23c849b8736f8`. La comparación de madera omite únicamente las cuatro columnas opcionales añadidas para comprobar los valores anteriores. No se corrigieron importes históricos, cambiaron cuentas ni creó otra base.

La publicación del código y su comprobación de lectura siguen pendientes en este punto del registro.

## Condiciones de publicación

1. Verificar el estado de migraciones de la base habitual y el respaldo conservado; instalar esta migración antes de desplegar 1.1.71. Añade columnas de pago opcionales a madera, restricciones para escrituras nuevas y funciones; no reescribe importes anteriores ni crea otra base del negocio.
2. Publicar el código y comprobar salud, versión y lecturas del saldo con la sesión habitual. Las operaciones de creación/cierre se verifican con registros aislados, sin modificar registros reales para probar.
3. Si faltan funciones en la base, las acciones afectadas muestran el requisito y no usan el guardado incompleto anterior como alternativa. Madera necesita las nuevas columnas; no publicar solo el código.

El diagnóstico no autoriza corregir cobros históricos automáticamente: sus vínculos y lo efectivamente recibido deben contrastarse antes de cualquier ajuste. Corregir el código no reconcilia movimientos antiguos que ya pudieran haberse registrado mal.

## Hallazgos medios conservados como pendientes

- Precisión de `roundMoney`: `10.075` puede producir `10.07` en vez de `10.08`. Afecta también el caso de cubicaje que debería entregar S/2.19 y actualmente da S/2.18.
- Ganancia de costo S/20.15 y margen 50%: redondea a S/10.07 en vez de S/10.08.

Se atenderán como precisión decimal, preservando las fórmulas, en un cambio separado. No quedan declarados corregidos por esta entrega. La revisión actual cierra los hallazgos altos descritos en local; no garantiza ausencia de otros errores en todo el programa.
