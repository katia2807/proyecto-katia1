# Correcciones de cotización rápida — 11/10/2026, 1.1.77

**Migración instalada, código publicado y recorrido de lectura comprobado en 1.1.77.** Esta entrega resuelve los tres hallazgos de [la revisión 1.1.76](REVISION_COTIZACION_RAPIDA_2026-10-11.md), cuyo diagnóstico se conserva como evidencia histórica. La actualización visual 1.1.78 conserva estas correcciones.

## Correcciones

| Hallazgo | Resultado comprobado |
| --- | --- |
| RAP-01 / alta | Confirmar una cotización rápida de mueble personalizado conserva el precio y la deja lista para producción, sin registrar dinero en Caja. Aprobar una cotización ficticia de S/1,000 con S/300 recibidos por Yape crea una orden y un ingreso de S/300; quedan S/700 por recibir. El formulario mantiene sus campos y estado habitual, con una aclaración breve. |
| RAP-02 / alta | El formulario conserva una clave de envío ante errores. Cotización y recibo de solicitud se guardan juntos; perder la respuesta después de confirmar y reintentar devuelve el documento original. Dos conexiones con el mismo envío crean una sola cotización. Cambiar los datos de una solicitud ya guardada se rechaza; solicitudes distintas con datos iguales siguen siendo documentos distintos. Un documento eliminado no se recrea al repetir su envío antiguo. |
| RAP-03 / alta | Se impide borrar una cotización vinculada a movimientos de Caja, incluidos anulados o borrados, para conservar el origen histórico. También se mantienen las restricciones de orden vinculada y cliente activo. Sin cobros ni orden, un cliente inactivo permite borrar cotización y cortes juntos. Un fallo conserva todo; aprobación y borrado simultáneos no separan el adelanto de su documento. |

Se conserva el cobro heredado de cotizaciones de **servicio de corte**: esta entrega separa la confirmación y el cobro de **muebles personalizados**. El alta de servicio de corte también reconoce reintentos; no se atribuye una revisión completa de sus ediciones históricas. No se retira un comportamiento de otro tipo de servicio sin revisar sus usos.

## Archivos y estructura

- Acciones `createCotizacion` y `deleteCotizacionMueblePersonalizada` en `app/actions.ts`.
- `lib/cotizacion-rapida.ts`, guardados completos en `lib/demo-store.ts` y campo interno de envío en `components/ventas/muebles-personalizados-context-panels.tsx`.
- Migración nueva `supabase/migrations/20261011030000_cotizacion_rapida_segura.sql`: redefine el séptimo trigger heredado e incorpora dos RPC con permiso efectivo y bloqueo de empresa. Solo el servidor puede ejecutar los RPC; no hay alternativa de guardado insegura si falta la migración.
- Regresiones en `tests/unit/cotizacion-rapida-segura.test.ts`, `tests/unit/finanzas-local.test.ts` y `tests/integration/operaciones-postgres.mjs`.
- Fixture `tests/unit/fixtures/finanzas-cotizacion-rapida.sql`: incluye el trigger original de Caja, los tipos de cotización y las restricciones de orden y `cotizacion_cortes`. Los registros de prueba son ficticios.

## Comprobaciones realizadas

- **807 pruebas en 57 archivos aprobadas**, sin fallos. Incluyen 25 regresiones nuevas con acciones actuales, SDK Supabase real y PostgreSQL en memoria, más seis casos locales de reintento, fallo de disco, adelanto, borrado y conservación de servicio de corte.
- **14 casos aprobados en PostgreSQL 17.11 con conexiones independientes**. Se conservaron los once casos anteriores y se añadieron tres: dos envíos de una rápida, borrado antes de aprobación y aprobación antes de borrado. La coordinación comprueba bloqueos reales. La base temporal usa solo loopback y datos ficticios, sin `.env` ni conexión remota, y se detuvo al finalizar.
- Tipos de aplicación y pruebas, compilación optimizada y formato del diff aprobados. ESLint sin errores; seis advertencias previas en los archivos de aplicación revisados. Los archivos nuevos no añaden advertencias. Se corrigió una entrada incompleta del caso de prueba local de aprobación, sin modificar la validación de la aplicación.
- Local reiniciado antes del trabajo y nuevamente después de compilar, en desarrollo, puerto 3001 y mismo almacén aislado. Salud 200: demo forzado y Supabase desactivado.
- Revisión de pantalla completada en Edge: Muebles personalizados y apertura/cierre de Cotización rápida, sin enviar formularios. Estado habitual, campos, texto del adelanto y presencia de una sola clave interna comprobados; sus valores no se inspeccionaron. Sin errores de consola detectados. Los primeros intentos de navegación agotaron el tiempo; se completó el recorrido mediante el menú existente.
- Nota de parche de 212 caracteres coincidente en el aviso y el historial. La pantalla local muestra 1.1.77.

Evidencias privadas, excluidas de Git: `temp/correcciones-1.1.77/completas.json`, `sql-final.json`, `relacionadas.json`, `cotizacion-rapida-local.png` y `temp/pruebas-operaciones-postgres/123e3dd3-b1ec-44f7-afb7-b493e4555bf8/resultado.json`. Las reproducciones anteriores de errores siguen en su carpeta histórica y no se cuentan como pruebas de reparación.

Los dos almacenes habituales conservan las huellas previas:

- Propuesta local: `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`.
- `data/store.json`: `E388D7F712A5676027837CF7011305926633CC9BE15EBE575E85DE64C8A70B90`.

## Publicación y límites

Durante la reparación local no se instaló la migración ni se consultó o modificó la base real. Después, el usuario autorizó su publicación. Se creó un respaldo completo nuevo de solo lectura en `temp/publicacion-1.1.77/respaldo-previo/base-completa.dump`: 736,265 bytes, SHA-256 `11fffe710a56f1b21dea9b936eb45c361c552e6472c44f9fd0d9b863a18b2587`, índice legible y sin advertencias de exportación. Se instaló únicamente `20261011030000_cotizacion_rapida_segura.sql` en la base habitual, con su contenido exacto y MD5 `fd9e226c69573107f48ad66f8db5b34f`. Las 46 tablas / 274 registros coinciden con el respaldo, antes/después de la transacción y en la primera comprobación posterior. Los dos RPC permiten ejecución solo del servidor; el trigger sigue activo y limita el ingreso automático a servicio de corte. No se reescribieron cobros históricos. Evidencias privadas en `temp/publicacion-1.1.77/`, fuera de Git.

Código `3fdcae04a6d11c8b1ac0a05eb38f02a75ca1f4bd` publicado en `main`; Vercel confirmó éxito mediante GitHub, despliegue `5vn9naA1zhcAV42vp6JzYNxRZ9Js`, en el equipo/proyecto habituales. Caja y Muebles personalizados muestran 1.1.77. Salud HTTP 200, Supabase listo y demo desactivado. Caja conserva 53 movimientos, saldo S/74,677.29 y resumen/primera página iguales antes/después. Formulario rápido publicado abierto/cerrado sin guardar: estado habitual, texto del adelanto y una sola clave interna comprobados, sin errores de consola detectados. No hay cotizaciones personalizadas ni órdenes reales en este módulo; no se crearon documentos del negocio para probarlo. Los guardados y la concurrencia se comprobaron con datos ficticios en las regresiones citadas.

La comparación posterior conserva todas las tablas del negocio. Detectó una diferencia en `auth.users`: el diagnóstico independiente comparó sus columnas con el respaldo y solo cambió `updated_at`; las cuentas, contraseñas y permisos siguen iguales. Se conserva el resultado estricto original y este diagnóstico privado, sin atribuir la causa del metadato ni confundirlo con un cambio de datos financieros. Comprobación final tras 1.1.78: 45 tablas ajenas a autenticación sin diferencias, 46 tablas / 274 registros totales conservados y la misma diferencia aislada en `updated_at`. Entrada cifrada temporal retirada; respaldo conservado. Evidencia privada adicional: `diagnostico-auth.json`, `cierre-base.json`, `caja-final-78.json` y capturas de los botones publicados en ambos temas. No se inspeccionaron registros de ejecución de Vercel: el conector directo devolvió acceso insuficiente; se usó la integración Git existente y el programa publicado.

La actualización visual **1.1.78**, código `cb9d90f5bd4cbadc1f7e4a59baa9a2b5b86bc007`, conserva esta reparación. Vercel confirmó éxito del despliegue `674Z8wz9oLp1pnzKHFUkTEeU5MYV`. Muebles personalizados muestra 1.1.78; los botones se comprobaron negros en claro y blancos en oscuro, con tema claro restaurado, sin enviar operaciones ni detectar errores de consola. Caja mantiene el resumen y la primera página previos. Compilación y tipos finales aprobados; la nota visual de 205 caracteres coincide en aviso e historial. No se añadieron pruebas funcionales para el cambio de CSS, que no modifica cálculos ni guardados.

Se conservan precios, fórmulas, preferencias y el redondeo comercial de Aserradero. Los dos casos medios de precisión monetaria pospuestos siguen fuera del alcance. Esta entrega comprueba los tres hallazgos descritos y los controles citados; no declara todo el programa libre de otros errores ni vuelve a cerrar apartados ajenos.

## Nota de parche

La cotización rápida de muebles ya no registra cobros al confirmarla. Los reintentos conservan una sola cotización y el borrado protege documentos con cobros u órdenes, para mantener Caja y producción coherentes.
