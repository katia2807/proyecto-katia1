# Copia local y recuperación aislada — 07/10/2026

Registro inicial **1.1.59**, publicado en `main` mediante `c4d1a48`; Vercel confirmó el despliegue y la versión/nota coinciden en producción. Salud HTTP 200, demo desactivado y Supabase listo. El respaldo se amplió en **1.1.60**, como se describe a continuación. El usuario eligió plan gratuito y copias manuales a su PC. No se creó ningún token, cambió contraseña ni contrató un plan.

## Ampliación nativa — 1.1.60

Documentación y nota publicadas en `main`, commit `ad6c5e8`, con despliegue correcto en Vercel. Navegador con sesión real: versión y nota **1.1.60** coincidentes, sin errores de consola detectados en la carga de Inicio. Salud HTTP 200, demo desactivado y Supabase listo. Evidencia privada `temp/respaldos-seguros/publicacion-1.1.60.png`. No se modificaron rutas, formularios o cálculos del programa; la compilación publicada pasó y se realizaron comprobaciones proporcionales de nota, documentos e integridad de la copia.

Una de las claves proporcionadas por el usuario permitió la conexión de base. La validación usó TLS con certificado y nombre del servidor verificados, usuario del proyecto y una consulta de lectura. Las claves no aparecen en esta documentación ni en el repositorio. La entrada temporal cifrada con Windows se vació al terminar; la propuesta de acceso nuevo se descartó.

Entrega privada: **`Descargas/Katia-respaldo-manual-2026-10-07.zip`**, con otra copia en `temp/respaldos-seguros/`. Tamaño **786,923 bytes**, 30 entradas, SHA-256 `35852328f29ffe05420af195386b33ca3191afb89c17c78b2201ff26e03f256e`. Se comprobaron los contenidos del ZIP contra sus tamaños y huellas, y la copia en Descargas conserva el mismo SHA-256. Los respaldos y evidencias anteriores se mantienen por separado.

| Elemento | Alcance y comprobación reales |
| --- | --- |
| Base nativa | PostgreSQL 17.11 `pg_dump`, formato custom, de origen 17.6: **82 tablas y 599 filas**. Una transacción `REPEATABLE READ READ ONLY` exportó la instantánea usada tanto por el dump como por sus huellas. `default_transaction_read_only=on` en la conexión. Sin advertencias de exportación. |
| Negocio | Las **42 tablas públicas y sus 257 registros**; huellas iguales a la copia lógica anterior y a la consulta final de producción. |
| Usuarios y servicios | Todas las tablas del dump de Auth, Storage, Realtime e historial; incluye sesiones/refresh tokens y cuentas del programa. No equivale a exportar toda la configuración o las claves externas del proveedor. |
| Roles y permisos | **16 roles y 22 membresías**, estructura, propietarios, ACL y RLS. Los roles se exportan deliberadamente **sin sus contraseñas de conexión**; las cuentas del programa permanecen en los datos de Auth. |
| Adjuntos | Los **12 archivos originales, 659,686 bytes**, y sus manifiestos. Huellas/tamaños comprobados; los metadatos de Storage coinciden entre la copia nativa y la lógica anterior. |
| Configuración observada | Referencia privada parcial de URLs y proveedor Email, consultados sin guardar. No se exportaron todas las claves JWT, variables de Vercel ni configuración externa. |

Recuperación final en un directorio nuevo con PostgreSQL 17.11 portátil, limitado a `127.0.0.1:55440`, contraseña local aleatoria y parada al terminar. **81 tablas y 599 filas** recuperadas con huellas coincidentes; **81 propietarios y ACL efectivos**, **16 roles, 22 membresías, 329 restricciones, 18 triggers y 50 políticas** coinciden con el origen. `pg_restore` terminó sin errores. La única normalización del comparador es una ACL explícita equivalente a la ACL por defecto de su propietario en `realtime.schema_migrations`; no se concedieron permisos adicionales.

La tabla 82 es `vault.secrets`, vacía en el origen. Su extensión administrada `supabase_vault` no existe en el PostgreSQL portátil de Windows: se omitieron ocho entradas de Vault **solo en la prueba**, sin modificar el dump original, que las conserva. Esto no comprueba recuperación de Vault ni inicio de los servicios Auth/Storage/Realtime. Tampoco se probó un inicio de sesión con las cuentas recuperadas o una subida de los binarios a Storage. Una recuperación del programa completo requiere un destino Supabase compatible, preparar sus conexiones/configuración y verificar sus servicios antes de cambiar producción.

Consulta final mediante lectura: **42 tablas públicas, 257 registros, cero tablas con diferencias, 12 adjuntos y dos usuarios**. Ninguna restauración o escritura del negocio en producción. La configuración automática del proveedor no se activó: el usuario eligió mantener Free y respaldo manual. La copia no se actualiza sola; debe renovarse tras cambios relevantes y antes de operaciones delicadas. El `LEEME.txt` del ZIP explica su uso en un destino separado y que no corresponde a la importación Excel o JSON local del programa.

Evidencias privadas: `temp/respaldos-seguros/base-nativa-verificada-2026-10-07/` (dump, huellas, catálogo de permisos, comprobación final, integridad y recuperación); prueba final en `recuperacion-dump-nativo-2026-10-07-5/`. Se conservaron los intentos intermedios para diagnosticar arranque y comparación de ACL; no forman parte de la entrega ZIP ni son dependencias del programa.

Nota **1.1.60 — 07/10/2026**: Se amplió el respaldo manual con la base, sus permisos y adjuntos. La recuperación local conservó los datos del negocio y los accesos de tablas, sin modificar producción ni contratar un plan de pago.

## Registro de la copia lógica inicial — 1.1.59

Los apartados siguientes describen la primera copia y sus límites en ese momento. La ampliación nativa anterior sustituye los pendientes de contraseña, dump, sesiones y recuperación de roles/ACL; sus límites de servicios y configuración externa siguen vigentes.

## Ubicación y alcance

Archivo privado: `temp/respaldos-seguros/Katia-respaldo-local-2026-10-07.zip`. Originales exactos y evidencias: `temp/respaldos-seguros/2026-10-07/`. La carpeta está excluida de Git; contiene información del negocio y usuarios, por lo que no se publica en el repositorio.

| Copia conservada | Alcance real |
| --- | --- |
| Tablas del negocio | Las 42 tablas de `public`, incluidas vacías; 257 registros. |
| Usuarios | Dos filas de `auth.users` y dos de `auth.identities`. No son una copia de todas las tablas o servicios de Auth. |
| Adjuntos y metadatos | Tres buckets y 12 objetos de Storage, más sus 12 archivos binarios; 659,686 bytes. |
| Historial técnico | 56 filas de `supabase_migrations.schema_migrations`, con sus textos exactos. |
| Estructura | Columnas/tipos/defaults/generadas, enums, restricciones, índices, funciones, vistas, triggers, RLS y políticas; también propietarios y accesos originales como metadatos. Tres funciones auxiliares de `app` conservadas aparte. |

Total: **47 tablas, 332 filas y 12 archivos**. El ZIP incluye la exportación exacta, funciones auxiliares, manifiestos, comprobaciones y explicación de alcance. No incluye las herramientas de PostgreSQL ni los intentos previos de recuperación. Es un formato lógico propio, distinto del JSON de restauración del modo local y de la importación Excel del programa.

## Comprobaciones realizadas

1. SQL Editor con la sesión existente y una transacción `REPEATABLE READ READ ONLY`; consultas de catálogo y datos. Ninguna escritura en producción. Exportación de texto del resultado mediante `textContent`: `innerText` reducía espacios del historial y no sirve para conservar esta copia exacta. Se comprobaron las 47 huellas también directamente desde el archivo exportado.
2. Recuperación en **PostgreSQL 17.11**, portátil oficial, frente al origen 17.6. Directorio nuevo, conexión limitada a `127.0.0.1:55439`, contraseña aleatoria para la prueba y parada al terminar. No se conectó el programa ni se usó la base habitual como destino.
3. Datos cargados antes de activar triggers, para no repetir inventario, Caja o auditoría. Se conservaron columnas generadas y restricciones históricas `NOT VALID`. Las **47 tablas** recuperadas conservaron conteos y huellas, incluido el historial técnico. El control de estructura confirmó **209 restricciones, 136 índices, 17 triggers y 50 políticas**. Se crearon las 54 definiciones de funciones y la vista pública; no se ejecutaron operaciones del negocio para probar sus cuerpos o una matriz de permisos.
4. Descarga por lectura de los 12 objetos públicos. Tamaños y MD5 coinciden con sus ETag; SHA-256 guardado por archivo. Esto comprueba los archivos descargados, no una subida o recuperación del servicio Storage.
5. Consulta final de producción: **42 tablas públicas, 257 registros, cero tablas con diferencias**, 12 objetos y dos usuarios. Sus huellas coinciden con la copia exacta y con la comprobación anterior. No se guardaron formularios, restauraron datos ni cambiaron accesos.
6. `data/store.json` conserva SHA-256 `19FA05D7758DB65EF8854D7DC143F26A55BBD2F8100EA9105B398CC5B2472CC9`; el local habitual `temp/inventario-1.1.47-preview/store.json` conserva `AF94DF15EC2DFC6A0CC3BBBD4802404168A1FC9C22B4ACF76C850A42E8FB336E`.

Evidencias privadas: `recuperacion-verificada.json`, `produccion-final.json`, `storage-verificado.json`, `integridad-sha256.json` y `produccion-intacta.png`. El script privado `temp/respaldos-seguros/probar-recuperacion-local.mjs` fija el destino local y rechaza reemplazar una copia anterior; no acepta conexión externa. Los archivos originales y la prueba aislada se conservan, sin convertirse en dependencias del programa.

## Límites y continuación

Esta copia protege los datos y archivos enumerados. **No es un respaldo completo del proveedor**: no contiene sesiones/refresh tokens, todas las tablas administradas, configuración y claves externas, Vault ni sus claves de cifrado. Los roles/grants originales se conservaron en los metadatos; la prueba creó roles locales para reconstruir políticas, pero no reprodujo sus propietarios, concesiones ni servicios de Supabase. No certifica inicio de sesión, acceso entre roles ni recuperación de Auth/Storage.

Al terminar la primera copia, el plan observado seguía siendo Free, sin respaldo automático configurado. En esa etapa no se hizo un `pg_dump` porque no había contraseña disponible ni se aprobó crear acceso nuevo; esta limitación quedó resuelta en la ampliación 1.1.60. No se subió ninguna copia sobre la base sana: una recuperación posterior debe prepararse en un destino separado y completar servicios y configuración faltantes antes de considerar reemplazar producción.

La revisión automática bloqueó una repetición de la prueba por un límite de uso; esa acción no se ejecutó. Tras el mensaje posterior del usuario para continuar, la solicitud se revisó y la comprobación final autorizada pasó. No se eludió la revisión ni cambió el destino.

Referencias para continuar: [respaldos de Supabase](https://supabase.com/docs/guides/platform/backups) y [respaldo/recuperación con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Los archivos de Storage requieren conservación separada de la base. No publicar datos o credenciales en GitHub.

## Nota de parche

**1.1.59 — 07/10/2026.** Se documentó la copia local de datos y adjuntos, con recuperación comprobada en una base separada. El registro aclara qué protege el respaldo y qué falta para recuperar Supabase, sin alterar datos del negocio.
