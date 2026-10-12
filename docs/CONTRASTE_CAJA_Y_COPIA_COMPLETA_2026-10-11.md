# Caja histórica y flujos sobre copia completa

Continuidad del 11/10/2026: respaldo reciente completo comprobado e instalación exacta de `20261011060000` realizada en la única base habitual. Solo cambió la ubicación de `digest`; 46 tablas / 274 registros coinciden antes/después, con propietario, permisos y configuración conservados. No se ejecutaron cierres ni reconciliaciones del negocio. Código/publicación y recorrido de lectura pendientes; el texto siguiente conserva el ensayo local anterior.

Fecha: 11/10/2026. Versión 1.1.82 **local, pendiente de instalación/publicación**. Producción permanece en 1.1.81. El usuario autorizó contrastar Caja histórica y probar una copia íntegra; los dos casos de precisión monetaria siguen pospuestos hasta que los solicite.

## Origen y aislamiento

- Conexión a la única base habitual, `rzjxobfgtlzdqmhbbvsk`, con TLS verificado y `default_transaction_read_only=on`. No se ejecutaron operaciones del negocio, cierres, reconciliaciones, cambios de cuentas ni migraciones en producción.
- Respaldo completo reciente: dump y huellas de **83 tablas / 629 registros** sobre la misma instantánea de lectura; 43 tablas públicas / 257 registros. El índice se comprobó y la huella SHA-256 se conserva en la evidencia privada.
- Recuperación en PostgreSQL 17.11 portátil, exclusivamente en loopback. **82 tablas / 629 filas coinciden** con el origen. La extensión `supabase_vault`, vacía y no disponible en Windows, se excluyó únicamente del ensayo; sigue en el archivo original.
- Se compararon roles, membresías, propietarios, permisos efectivos y las definiciones de políticas, índices, triggers, restricciones, funciones y migraciones. La copia conserva 50 políticas, 245 índices, 19 triggers, 331 restricciones y 63 funciones revisadas. Los dos índices y una restricción de Vault quedan fuera del ensayo. Se igualó el contexto de resolución de nombres; se ordenaron las entradas de permisos para comparar su efecto, sin otorgar accesos.
- Auth 2.197.0 y PostgREST 14.5 locales sobre el esquema recuperado. Adaptaciones exclusivas del destino: credenciales de conexión/JWT efímeras, `authenticator` sin el preload administrado no disponible en Windows y listener Auth compatible con Windows. Se usaron 13 cuentas y dos empresas ficticias. El programa no se convirtió en multiempresa.

## Contraste de Caja histórica

Se contrastaron los 53 movimientos activos y los 35 documentos actuales de ventas/servicios. Los importes se sumaron en centavos como comprobación independiente, sin cambiar cálculos del programa. El saldo registrado coincide con ingresos menos egresos.

| Hallazgo | Resultado y tratamiento |
|---|---|
| H82-01: origen no disponible | 16 movimientos: 15 de madera cortada y uno de Aserradero. Sus referencias no aparecen como documentos actuales ni como identificadores de otras tablas públicas recuperadas. No se borraron ni anularon: pueden conservar dinero efectivamente recibido. |
| H82-02: documento e ingreso diferentes | Un servicio de Aserradero tiene un ingreso superior al precio actual. No se reconstruyó el precio anterior ni se atribuyó una causa. El detalle queda privado para contrastarlo con la clienta. |
| Otros contrastes | No aparecieron importes activos negativos/inválidos, referencias a otra empresa, medios distintos en documentos disponibles ni grupos con todos los datos de cobro comparados iguales. Las referencias de Kardex comprobadas conservaron producto/documento. Esto no prueba ausencia de duplicaciones con otros patrones. |

Las **17 observaciones requieren confirmación del negocio**, no ajuste automático. Revisar comprobantes, cobros efectivamente recibidos y antecedentes antes de decidir qué registro corregir. No se comparó efectivo físico ni extractos bancarios, ni se reconstruyeron saldos iniciales no registrados.

Detalle privado, excluido de Git: `temp/revision-historica-1.1.82/CASOS_CAJA_PARA_REVISAR.md`. Incluye fechas, importes e identificadores; no publicar esta información en el repositorio.

## Error confirmado y corrección local

**C82-01, alto: el cierre mensual no genera su firma en el esquema real.** `public.cerrar_mes` fija `search_path=public`, pero `pgcrypto.digest` está instalada en `extensions`. La llamada sin esquema devuelve `function digest(text, unknown) does not exist`. La regresión anterior creaba la extensión en `public`, por eso no reproducía este caso.

Nueva migración `20261011060000_cierre_mensual_huella_segura.sql`: únicamente califica la llamada como `extensions.digest`. La comparación de la definición antes/después en la copia confirmó ese cambio único; propietario y permisos se conservaron. Importes, fórmulas, reporte mensual, confirmaciones, bloqueos y redondeos quedan iguales. No se reescriben cierres existentes.

La prueba opcional `tests/integration/operaciones-postgres.mjs` ahora instala pgcrypto en `extensions` y aplica la nueva migración para evitar que su ubicación anterior oculte el error.

## Comprobaciones y límites

**32 casos aprobados con las acciones actuales, Auth y PostgREST reales y el esquema completo recuperado.** Se reemplazó únicamente el contexto de cookies/caché/navegación de Next para ejecutar acciones fuera de una petición HTTP; no se simularon decisiones de autorización, SQL ni servicios. La matriz independiente de 13 perfiles comprobó Caja, Ventas, Inventario, Personal y cierre mensual, incluidos roles efectivos de solo lectura, operaciones y cuenta inactiva. Se verificaron respuesta perdida tras confirmar, reintento sin duplicar, rollback de Caja/Kardex, compras, anulaciones, actualización de Aserradero, cotización/adelanto/saldo, alquiler/cierre, existencias concurrentes y RPC restringidos al servidor. La lectura directa de clientes con usuario/visitante está denegada por permisos de tabla; no se presenta como prueba de filtrado por RLS que no llegó a ejecutarse. La acción del servidor también rechaza un cliente de otra empresa ficticia.

**24 escenarios adicionales aprobados con conexiones independientes a PostgreSQL 17.11**, incluido cierre concurrente con venta, snapshot, bloqueo posterior y la nueva ubicación de pgcrypto. Esta batería usa la estructura controlada de regresión, distinta de la copia completa; no se suman ambos grupos como si compartieran el mismo esquema. Un ensayo focalizado adicional verificó firma, snapshot y evento `MONTH_CLOSE` en la tabla real `audit_log`, distinta de `audit_logs`.

**Navegador Edge sobre la copia:** login con cuenta ficticia, ingreso de S/10 guardado y mostrado en Caja/Reportes, cierre del mes y firma visible. El recorrido usó el programa compilado 1.1.81 con la migración 1.1.82 aplicada únicamente a la copia; la nueva compilación 1.1.82 pasó después. No se detectaron errores/advertencias de consola en ese recorrido. Captura: `temp/revision-historica-1.1.82/cierre-verificado.png`. Tipos, compilación optimizada y comprobación de diff aprobados. El primer intento de compilación dentro del entorno restringido falló por acceso a fuentes/carpetas; el ensayo aislado con el acceso necesario terminó correctamente.

**Conservación final:** las 83 tablas del origen coinciden con sus huellas iniciales por una consulta final de solo lectura. Se retiraron solo filas nuevas de las copias, identificadas contra otra restauración local original: las 82 tablas / 629 filas restauradas también conservaron sus huellas, sin reescribir valores originales. Esa referencia temporal se eliminó al terminar. Los servicios Auth/API/PostgreSQL y el programa de pruebas 3002 se apagaron; se retiraron los cuatro directorios de datos temporales creados por esta revisión, conservando respaldos, recetas y evidencia. Se vaciaron las credenciales temporales. Los dos almacenes locales habituales conservan sus huellas; el servidor habitual continúa en desarrollo/3001.

La evidencia de ejecución y del navegador se conserva en `temp/revision-historica-1.1.82/`. Las pruebas preparan y limpian datos exclusivamente de las empresas ficticias entre casos; durante el flujo evaluado se mantienen las reglas originales. Dos triggers añadidos solo a la copia provocan fallos de escritura tardíos y permiten comprobar el rollback. No se probaron nuevas escrituras reales en Storage, cargas masivas, todos los teléfonos ni toda combinación posible de políticas. El ensayo no garantiza que no existan otros errores.

Antes de publicar: respaldo reciente, instalar la migración exacta en la base habitual sin ejecutar un cierre para probarla, luego publicar código/nota y comprobar por lectura. La revisión actual no autoriza cambiar datos históricos ni resolver los redondeos pospuestos.

Nota de parche 1.1.82, 197 caracteres: Se revisó Caja histórica y se probaron cobros, stock y permisos con una copia completa de la base. Se corrigió el cierre mensual para guardar su firma, conservando los datos reales y los redondeos.
