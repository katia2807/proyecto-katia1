# Cotización unificada, Producción y Personal: reparación local

Fecha: 11/10/2026. Implementación inicial 1.1.80, incorporada a la entrega local **1.1.81**. Producción continúa en **1.1.78**: no se consultó la base real ni se instaló o publicó esta reparación.

El [diagnóstico 1.1.79](REVISION_COTIZACION_UNIFICADA_Y_PERSONAL_2026-10-11.md) se conserva como evidencia anterior. Sus once casos reproducen errores; las regresiones siguientes exigen resultados corregidos.

| Hallazgo | Reparación y resultado comprobado |
| --- | --- |
| UNI-01, alto | El wizard genera la clave antes del primer envío y la conserva en su borrador/reintento. El alta SQL guarda documento y recibo juntos; repetir una respuesta perdida devuelve el mismo ID. Otra clave permite otra cotización legítima. |
| UNI-02, alto | Validación de UUID, fecha, cliente y estado inicial en servidor. El alta solo acepta pendiente/lista para producción; «cobrada» requiere el cobro real. |
| UNI-03, alto | El cliente no cambia si existe una orden o movimiento de Caja vinculado, incluso anulado. Editar otros datos conserva las comprobaciones previas de importe y dinero recibido. |
| UNI-04, alto | El alta usa la organización autenticada y comprueba que el cliente pertenezca a ella. Segunda empresa solo ficticia en las pruebas. |
| PER-01, medio | Adelanto con ID estable, contenido comparado al reintentar y formulario protegido durante el envío. Una solicitud repetida queda en un adelanto de S/150, sin añadir movimientos automáticos a Caja. |
| PRO-01, medio | Aprobación ofrece documentos aceptados sin orden. Una cotización cobrada crea solo la orden con adelanto cero, comprobando antes que el pago realmente cubra el total. |
| PRO-02, medio | En Muebles personalizados, la fase mostrada sigue a la orden. Si está cobrada/deudora, conserva esa información y añade la fase como dato separado. No se reescribe el estado financiero de las cotizaciones ni se impide cobrar una orden entregada. |
| LAT-01, latente | La acción antigua de producción, sin control visible, ya no escribe. Indica usar la aprobación conjunta existente; no se activó el botón oculto. |

Archivos de continuidad: `lib/cotizacion-unificada-guardado.ts`, `lib/cotizacion-produccion.ts`, acciones correspondientes en `app/actions.ts`, wizard y paneles de Personal/Muebles personalizados. La migración preparada es `supabase/migrations/20261011040000_cotizacion_unificada_segura.sql`.

## Verificación y límites

- Regresiones con acciones actuales, SDK Supabase real y PostgreSQL en memoria; dominio ficticio exclusivo, autenticación/configuración/persistencia simuladas. Pruebas específicas en `tests/unit/cotizacion-unificada-{segura,local}.test.ts`.
- Cinco escenarios nuevos con conexiones independientes a PostgreSQL: altas simultáneas iguales/diferentes, aprobación frente a cambio de cliente en ambos órdenes y aprobación repetida de un documento pagado. Las pruebas incluyen permisos de RPC, fallo del recibo, rollback y mantenimiento de filas al volver a aplicar la migración en la base ficticia.
- Primera etapa: 844 pruebas y 19 escenarios PostgreSQL aprobados. La revisión ampliada 1.1.81 agrupa estas correcciones; sus resultados finales constan en [el informe general](REVISION_GENERAL_PRIORITARIA_2026-10-11.md).
- Edge, copia compilada aislada en puerto 3002: aprobación de AUD-80-PAGADA con adelanto cero, orden visible y estado cobrada conservado; AUD-80-ENTREGADA muestra entregado y AUD-80-PENDIENTE no se ofrece para aprobar. Adelanto ficticio S/150 guardado y visible. Sin errores de consola detectados en ese recorrido. Comparación del almacén confirma Caja intacta.
- Las fórmulas, precios calculados, redondeo comercial acordado de Aserradero y redondeos monetarios pospuestos no se cambiaron. No se hizo reconciliación de documentos históricos.

Durante la adaptación de una prueba antigua, dos marcadores unitarios llegaron transitoriamente al archivo local `data/store.json`, porque faltaba simular la persistencia. Se corrigió el aislamiento; solo se retiraron esos marcadores después de obtener exactamente la huella original. La copia intermedia se conserva en `temp/revision-1.1.80/almacen-con-marcadores-unitarios.json`. El almacén habitual de la propuesta no cambió. Esto no fue una escritura en Supabase; ambas huellas originales se comprobaron al cerrar.

## Para publicar

Preparar un respaldo completo reciente de la única base habitual; instalar la migración 040000 antes del código y, para publicar toda la entrega 1.1.81, también 050000. Las funciones son exclusivas del servidor. La instalación no repara ni cambia filas antiguas. Publicar por la integración GitHub/Vercel verificada y comprobar versión/salud y pantallas de lectura conservando las huellas del negocio. Las pantallas que ejecutan escrituras al cargar se deben excluir o verificar primero en la copia aislada. No dar por instalados los controles por haber compilado el código local.
