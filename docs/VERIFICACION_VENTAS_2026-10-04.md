# Verificación previa a producción — Ventas 1.1.29

Fecha: 04/10/2026.

## Resultado

La versión de Ventas supera las verificaciones de código y compilación realizadas en este equipo. Durante la revisión se corrigieron registros eliminados que podían reaparecer en el historial, el bloqueo de cambios para usuarios de solo lectura y una eliminación simultánea que podía borrar una cotización recién cobrada.

El funcionamiento con Supabase real y la configuración del despliegue remoto siguen pendientes de verificación. Este equipo no dispone de sus credenciales y no hay staging disponible. Las respuestas locales del SDK y el almacén de pruebas no sustituyen esa comprobación. No se ha publicado esta actualización.

## Evidencia comprobada

| Comprobación | Resultado y alcance |
| --- | --- |
| Pruebas automáticas | 21 archivos y 268 pruebas aprobados. El SDK real de Supabase recibe respuestas locales que aplican los filtros y cambios enviados. No se contactó la base del negocio. |
| Compilación de producción | Aprobada con el modo demo desactivado y los clientes de prueba del selector desactivados durante la compilación. Incluye TypeScript y generación de rutas. |
| Tipos | Aprobados tanto para la aplicación como para las pruebas unitarias. |
| Revisión de código | 0 errores y 51 advertencias de variables sin usar y otros avisos existentes. |
| Acceso en modo producción | La ruta `/ventas` redirige a `/login?aviso=panel` sin una sesión real. La cookie de pruebas del entorno local no permite entrar con el modo demo desactivado. |
| Disponibilidad local sin demo | `/api/health` responde HTTP 200, con `demoMode: false` y los indicadores de Supabase en falso; confirma el arranque, no una conexión real. |
| Historial en la compilación optimizada | En una copia aislada hay una cotización activa cobrada de S/ 650 y otra eliminada de S/ 130. Solo aparece la activa, junto a las cinco operaciones originales. El filtro Aserradero muestra una sola operación. |
| Eliminación y paginación | Las pruebas excluyen los registros eliminados antes del rango de consulta. La tabla de servicios de aserradero conserva su consulta sin una columna que su esquema no incluye. |
| Detalle y documento | Una cotización eliminada no se recupera por su ID ni aparece en el listado. Las pruebas preservan el acceso a operaciones activas antiguas y su empresa. |
| Cobro | Se rechaza una cotización eliminada, incluso si se elimina entre la lectura y el guardado. No se genera el ingreso. Se mantienen las pruebas de importe, medio, duplicados y recuperación cuando Caja rechaza el ingreso. |
| Solo lectura | Los intentos de guardar y cobrar se rechazan en el servidor antes de consultar o modificar los datos, aun cuando el rol anterior del perfil permita escribir. |
| Eliminación simultánea | Una cotización cobrada después de abrir la confirmación no se elimina. Una propuesta sin cobrar conserva la posibilidad de eliminación. |
| Navegador | Sin errores de consola durante la comprobación del historial en la compilación optimizada. |
| Nota de parche | Versión 1.1.29, 04/10/2026; 207 caracteres. El aviso y el historial contienen la misma nota. |

## Comprobación pendiente del entorno real

Antes de dar por validada la publicación, comprobar que el despliegue remoto usa las credenciales correctas de Supabase, que `ERP_ORG_ID` coincide con la organización del negocio y que el modo demo y los clientes de prueba estén desactivados.

Confirmar que la base real ya tiene las migraciones existentes que añaden `deleted_at` a las tablas operativas y el estado `cobrada` a las cotizaciones. Esta revisión no añade ni ejecuta migraciones.

Comprobar en la versión publicada el inicio de sesión, la carga del historial, la lectura de un detalle y su documento, y que los permisos e importes coincidan con los registros reales. La persistencia de nuevos cobros requiere una prueba controlada con la base real; no se han creado movimientos del negocio durante esta revisión.

## Nota de parche

Ventas deja fuera los registros eliminados e impide cobrar propuestas descartadas. El acceso de solo lectura bloquea cambios y cobros; una eliminación desde otra pestaña respeta las cotizaciones ya cobradas.
