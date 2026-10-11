# Revisión posterior: cotización rápida de muebles — 11/10/2026

> Seguimiento: los tres hallazgos tienen [correcciones locales comprobadas en 1.1.77](CORRECCIONES_COTIZACION_RAPIDA_2026-10-11.md), pendientes de instalación y publicación. El texto siguiente describe el código de 1.1.75 al realizar el diagnóstico; se conserva como evidencia histórica.

**Registro 1.1.76 solo local. Diagnóstico con tres hallazgos altos pendientes; no es una reparación ni una publicación.** El código funcional publicado sigue en 1.1.75. La nueva revisión se centró en rutas de guardado y borrado menos cubiertas; no vuelve a certificar todos los apartados ni todos sus permisos.

## Ruta activa y origen del problema

En `/ventas/muebles-personalizados`, el panel **Cotización rápida** usa `submitCreateCotizacionForm` / `createCotizacion`. El estado predeterminado de su formulario es **Confirmada (Lista para producción)**; no pide monto recibido, medio de pago ni confirmación de cobro. Archivos: `components/ventas/muebles-personalizados-context-panels.tsx:252`, `:407` y `app/actions.ts:1640`.

La tabla `cotizaciones_mueble` conserva `trg_cotizacion_ingreso_caja`, un trigger posterior a INSERT/UPDATE que, al encontrar `estado='confirmada'`, inserta **todo `precio_acordado` como ingreso en efectivo**. Está en `supabase/migrations/20260430183000_init_erp_katia.sql:517` y en el esquema técnico exportado antes de 1.1.75, `temp/auditoria-critica-2026-10-11/esquema-previo.sql:834`. Ninguna migración posterior redefine o retira esa función/trigger. No se volvió a consultar producción para esta revisión.

Este trigger no estaba incluido entre los seis triggers heredados de las regresiones financieras anteriores. Se añadió a la estructura aislada de este diagnóstico, manteniendo las tres migraciones financieras vigentes hasta 1.1.75. Las pruebas anteriores conservan su alcance; no demostraban el guardado de esta cotización rápida con ese trigger. El cotizador unificado utiliza otra tabla y no queda afectado por este trigger.

## Hallazgos reproducidos

| ID / prioridad | Caso ficticio y resultado actual | Corrección necesaria |
| --- | --- | --- |
| **RAP-01 / alta** | Crear una cotización rápida confirmada por **S/1,000**, sin introducir dinero recibido, deja un ingreso activo de **S/1,000 en efectivo**. Intentar aprobarla después con un adelanto real de **S/300 por Yape** falla por exceso sobre el saldo: el programa ya considera recibido todo el precio. | Separar aceptación / producción del cobro. Mantener el precio acordado y permitir registrar únicamente el dinero efectivamente recibido desde el flujo de cobro correspondiente. No recalcular importes ni corregir ingresos históricos automáticamente. |
| **RAP-02 / alta** | Se confirma la inserción anterior y se simula pérdida de su respuesta. El formulario devuelve error; reenviar los mismos datos deja **dos cotizaciones y S/2,000 en Caja**. | Reconocer el mismo envío mediante una clave estable; comprobar también pérdida de respuesta después de confirmar. No basta deshabilitar el botón durante el envío. |
| **RAP-03 / alta** | La cotización anterior no tiene orden. Cambiar el cliente ficticio a inactivo habilita el borrado actual: `deleteCotizacionMueblePersonalizada` responde `{ok:true}`, elimina el documento y conserva **S/1,000 de ingreso activo**, cuyo origen ya no existe. | Proteger el borrado de una cotización con cobros; una anulación autorizada debe resolver documento, cobro, cierre y trazabilidad juntos. No borrar el dinero recibido sin aclarar la operación real. |

RAP-03 afecta `app/actions.ts:1702`: el borrado comprueba tipo, estado del cliente y orden vinculada, pero no el dinero enlazado. La Caja conserva `referencia_id` sin una clave foránea al documento. Los hallazgos representan riesgo de nuevas operaciones; **no prueban que el negocio haya sufrido estos descuadres**.

## Evidencia y controles

Se ejecutaron las acciones actuales con el SDK Supabase real, adaptado a PostgreSQL en memoria. La red externa y el acceso al disco del almacén habitual están sustituidos; todos los registros usados son ficticios. Se reprodujeron los tres errores en **cuatro pruebas** (RAP-01 tiene dos casos) y un control adicional: el borrado de una cotización **unificada** con orden y adelanto es rechazado por sus restricciones reales, conservando documento, orden y S/300 recibidos.

**Cinco pruebas aprobadas significa que se confirmaron cuatro reproducciones de errores y un control; no que se repararon los errores.** No se ejecutó una prueba de concurrencia con conexiones nativas para estos casos; la duplicación se reprodujo con un reintento secuencial después del guardado. No se repitió la suite completa ni una compilación funcional, porque no hay cambios en las operaciones. No se enviaron formularios en producción ni se publicaron cambios.

Comprobación de tipos de la aplicación y formato del diff aprobados después del registro documental. La nota de 206 caracteres coincide exactamente en el aviso y el historial. Solo cambian este informe, el estado, las notas y las constantes de versión.

Evidencia privada, excluida de Git: `temp/auditoria-posterior-1.1.75/preparar.mjs`, `auditoria.test.ts`, `vitest.config.ts` y `resultado.json`. El generador toma el transporte de las regresiones actuales y agrega el trigger heredado exacto del esquema exportado, con las columnas que requiere. Las referencias y restricciones comprobadas del control se incorporan expresamente.

Local reiniciado en desarrollo, mismo puerto 3001 y almacén `temp/propuesta-visual-1.1.64/store.json`. Salud HTTP 200: demo forzado, sin acceso Supabase. Huellas conservadas antes/después:

- Almacén de la propuesta: `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`.
- Almacén base `data/store.json`: `E388D7F712A5676027837CF7011305926633CC9BE15EBE575E85DE64C8A70B90`.

## Continuidad

Corregir los tres casos como una entrega relacionada, preservando el formulario habitual, precios y fórmulas. Incorporar el trigger real y sus restricciones a las regresiones permanentes. Revisar por separado la forma de cobrar cotizaciones antiguas de servicio de corte antes de retirar su automatismo: no se debe sustituir un comportamiento necesario sin revisar sus usos. No reconciliar datos históricos del negocio durante las pruebas.

Importación Excel, nómina, gestión de usuarios y adjuntos recibieron lectura de código en esta revisión; no se presentan como una evaluación completa ni quedan declarados libres de errores. Los dos redondeos monetarios medios pospuestos y el redondeo comercial de Aserradero siguen iguales.

Nota documental 1.1.76, 11/10/2026 (206 caracteres):

Se revisó la cotización rápida de muebles y se detectaron cobros automáticos, duplicaciones al reintentar y borrados sin anular Caja. Quedaron documentados para corregirlos, sin modificar datos ni cálculos.
