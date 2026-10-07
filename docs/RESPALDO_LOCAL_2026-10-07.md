# Copia local y recuperación aislada — 07/10/2026

Registro local **1.1.59**. Producción continúa en **1.1.58**: esta tarea no publicó código ni cambió registros del negocio. El usuario pidió descargar temporalmente a su PC, conservando los datos existentes. Se canceló la propuesta de acceso temporal nuevo; no se creó ningún token, cambió contraseña ni contrató un plan.

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

El plan observado sigue siendo Free, sin respaldo automático configurado. No se hizo un `pg_dump` del origen porque no hay contraseña de base disponible ni se aprobó crear acceso nuevo. Tampoco se subió esta copia sobre la base sana: una recuperación posterior debe prepararse en un destino separado y completar permisos, servicios y elementos faltantes antes de considerar reemplazar producción.

La revisión automática bloqueó una repetición de la prueba por un límite de uso; esa acción no se ejecutó. Tras el mensaje posterior del usuario para continuar, la solicitud se revisó y la comprobación final autorizada pasó. No se eludió la revisión ni cambió el destino.

Referencias para continuar: [respaldos de Supabase](https://supabase.com/docs/guides/platform/backups) y [respaldo/recuperación con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Los archivos de Storage requieren conservación separada de la base. No publicar datos o credenciales en GitHub.

## Nota de parche

**1.1.59 — 07/10/2026.** Se documentó la copia local de datos y adjuntos, con recuperación comprobada en una base separada. El registro aclara qué protege el respaldo y qué falta para recuperar Supabase, sin alterar datos del negocio.
