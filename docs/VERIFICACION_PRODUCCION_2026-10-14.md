# Verificación segura de la versión publicada — 14/10/2026

**El programa responde, pero no se puede declarar libre de errores.** Permanecen dos riesgos altos de Usuarios y uno medio de Kardex ya reproducidos en una recuperación aislada el 11/10. Esta revisión no los corrige ni publica cambios. El registro local 1.1.88 solo actualiza documentación y aviso; producción conserva 1.1.82.

## Código y aislamiento

GitHub confirmó `main` en `eccee9838e556b743e4174ef5b2eb30434f55e5c`, con `lib/app-version.ts` en 1.1.82. Es el estado de código registrado para la publicación del 11/10; su padre funcional es `e5c63fe63ee2c1f1c779c0b954851174d35ce0f7`. No se consultó el panel de Vercel ni se afirma haber comparado sus archivos compilados byte a byte.

Se exportó ese commit a `temp/verificacion-produccion-2026-10-14/codigo-1.1.82/`, separándolo de la propuesta visual inconclusa del directorio habitual. La copia no contiene `.env.local` ni el almacén habitual. Usa las dependencias ya instaladas del proyecto mediante una unión de directorio, sin instalar paquetes nuevos. Pruebas y navegador tienen almacenes ficticios diferentes, `almacen-aislado/` y `browser-aislado/`.

Se forzó demo, se vaciaron las variables de conexión y se bloqueó la red del proceso salvo localhost y los dos dominios de fuentes estáticas de Google necesarios para compilar. Supabase quedó fuera de la lista permitida. El primer intento de compilación falló por el bloqueo de esas fuentes; al permitir solo sus dominios terminó correctamente. No se alteró el código publicado para superar ese fallo del entorno de prueba.

## Producción: comprobaciones sin sesión real

Todas las peticiones públicas se hicieron sin cookies ni autorización de una cuenta real, después de revisar su entrada en el código.

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `/api/health` | HTTP 200; demo desactivado y configuración de Supabase disponible | Indica disponibilidad y configuración, no prueba que una consulta a la base funcione. |
| `/login` | HTTP 200; ingreso privado, sin credenciales de demostración visibles | Comprueba la pantalla pública de entrada, sin iniciar sesión. |
| `/ventas`, `/reportes`, `/registro` | Redirigen a `/login?aviso=panel` y muestran el login | Confirma la protección sin sesión de estas tres rutas; no valida sus datos ni funciones privadas. |
| Consulta directa de lectura a la base | No ejecutada: no hay conexión privada disponible | No se generaron credenciales ni se descargaron filas del negocio. |

`proxy.ts` valida la sesión con Auth; su renovación puede escribir cookies o metadatos de sesión al abrir una página. Por eso no se navegaron pantallas privadas en producción con la cuenta real bajo la condición de no tocar ningún dato. Tampoco se probaron públicamente otras rutas sin revisar primero sus consultas y efectos.

## Copia local del código publicado

- **881 pruebas en 62 archivos aprobadas.** Incluyen lógica y controles automatizados, con sus simulaciones y datos de prueba. No equivalen a probar las transacciones y sesiones del PostgreSQL/Auth de producción.
- **Compilación optimizada y comprobación de tipos aprobadas.** La advertencia de raíz por archivos de bloqueo múltiples corresponde a la carpeta anidada de auditoría.
- Servidor aislado iniciado en `127.0.0.1:3002`, desde la copia exportada. Salud local 200, demo forzado, Supabase desconectado. No se detuvieron servicios ajenos.
- Inicio y trece apartados principales recorridos en navegador: Caja, Ventas, Cotizaciones, Inventario, Clientes, Centro de Mando, Reportes, Registro, Configuración, Respaldo, Usuarios, Equipo y Ayuda. No se detectaron errores de consola en el recorrido. Es una comprobación de carga de pantallas, no de todos sus formularios, filtros, roles, exportaciones o rutas auxiliares.
- Usuarios mostró «Supabase no configurado», como corresponde al aislamiento. No se afirma haber comprobado invitaciones ni cambios administrativos desde esa pantalla.
- **Caja, operación ficticia completa:** antes, ingresos 1,970 / gastos 8,495 / saldo −6,525. Un ingreso de S/10 en Empresa dejó ingresos 1,980 / gastos 8,495 / saldo −6,515. Al recargar siguió exactamente una fila de prueba, sin duplicarse; buscar su descripción devolvió una sola fila. Esto comprueba el guardado y presentación en demo, no una operación SQL contra la base real.
- El servidor temporal se detuvo y su pestaña se cerró. El servidor habitual del usuario en 3001 ya estaba apagado; no se inició el borrador visual inconcluso ni se cambió su almacén.

## Riesgos que siguen pendientes

| Caso | Prioridad | Situación y límite de la evidencia |
| --- | --- | --- |
| H83-01 | Alta | Reenviar una invitación de una cuenta pendiente puede eliminar una identidad preexistente y su perfil si falla el segundo alta. El código compensa el fallo con un borrado sin distinguir quién creó la cuenta. Reproducido el 11/10 en Auth local; no es un incidente atribuido a cuentas reales. |
| H83-02 | Alta | Dos dueñas pueden retirarse simultáneamente el rol o desactivarse entre sí y dejar cero administradoras activas. La consulta previa no serializa las operaciones. Reproducido el 11/10 con sesiones locales independientes; no se provocó en producción. |
| M83-01 | Media | La venta de muebles terminados puede conservar stock y Caja correctos, pero omitir su salida en Kardex; al anular queda solo la devolución. Reproducido el 11/10 sobre el esquema restaurado de 1.1.82. No se volvió a consultar el esquema real hoy. |

El archivo remoto `app/(dashboard)/admin/usuarios/actions.ts` conserva el blob `5ca4025a174c4ff08d86c979400c62d1f0360c9d`, igual al código auditado con H83-01/H83-02. Por ello los dos riesgos altos siguen presentes en el código de `main`, aunque la batería automática pase. Sus mecanismos, reproducción y reparación propuesta constan en [la revisión del 11/10](REVISION_FINAL_PRIORITARIA_2026-10-11.md).

Orden recomendado: corregir primero ambos riesgos de Usuarios y probarlos con Auth/PostgreSQL aislados; después reparar el registro de Kardex sin descontar el stock dos veces. Las precisiones monetarias pospuestas y las observaciones históricas de Caja conservan su tratamiento anterior; no se conciliaron registros ni cambiaron redondeos.

## Conservación y límites

Las huellas de los almacenes habituales coinciden antes y después:

| Almacén local | SHA-256 |
| --- | --- |
| `data/store.json` | `E388D7F712A5676027837CF7011305926633CC9BE15EBE575E85DE64C8A70B90` |
| `temp/propuesta-visual-1.1.64/store.json` | `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9` |

No se guardaron registros, iniciaron sesiones reales, enviaron invitaciones ni ejecutaron cobros, cierres, restauraciones o migraciones en producción. No se publicaron cambios ni modificaron fórmulas. No hay una comparación nueva de huellas de la base real: su integridad completa, sesiones/roles y pantallas con datos actuales quedan fuera de esta comprobación. La ausencia de errores detectados en las cargas locales no es una garantía de ausencia de otros fallos.

Evidencia local privada en `temp/verificacion-produccion-2026-10-14/`: comprobaciones públicas, decisión de no conectar la base, navegación, registro ficticio, captura, aislamiento de red y resumen de entrega. No se añade esa carpeta a Git.

Nota 1.1.88: Se comprobó la disponibilidad del programa publicado y se probó su código en una copia aislada. La revisión conserva los datos reales y documenta los riesgos pendientes para decidir las próximas correcciones.
