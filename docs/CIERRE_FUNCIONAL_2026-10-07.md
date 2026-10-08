# Cierre funcional — 07/10/2026, 1.1.62

El usuario autorizó completar los pendientes funcionales y publicar, dejando únicamente la renovación visual. Código 1.1.62 preparado localmente; la migración nueva está instalada y comprobada en la base publicada. La comprobación de la publicación del código se registra al finalizar esta misma entrega. No se cambió la paleta, la ubicación de opciones ni los pasos habituales.

## Correcciones compartidas

- **COMP-RLS1:** los helpers de organización/rol consultan exclusivamente el perfil activo de `auth.uid()` con propietario y búsqueda fijados. La lectura de perfiles ya no entra en recursión. El rol efectivo coincide con la aplicación, incluidos permisos de presentación y roles heredados.
- El navegador puede usar Auth y leer únicamente su perfil activo. Las lecturas/guardados del negocio siguen pasando por el servidor, que valida sesión, permisos y empresa. Se retiraron privilegios directos de tablas y RPC heredadas a visitantes/cuentas del navegador, incluidos DELETE/TRUNCATE y procedimientos que aceptaban empresas arbitrarias. Se conservaron el acceso del servidor y las extensiones administradas. Nuevos objetos creados por `postgres` quedan protegidos por defecto.
- **USU3:** se retiró la relación redundante de `perfiles.id` con Auth que impedía crear invitaciones. La clave primaria, unicidad y relación correcta `perfiles.user_id` se conservan. El alta de una cuenta Auth ya no le crea automáticamente un perfil de dueña ni duplica el perfil que asigna Usuarios. No se cambiaron las cuentas existentes.
- **COMP-export:** Inventario comprueba sesión/rol antes de exportar, limita los datos a la empresa autenticada y consulta el historial completo. Ante un fallo devuelve un error, sin descargar una muestra parcial. Se mantienen filtros, formato y botones.
- Las pantallas privadas se autorizan en cada petición, también cuando la compilación no dispone de credenciales: evita que una redirección de inicio de sesión quede prerenderizada para todos los usuarios. No se cambiaron formularios ni cálculos.
- Se excluyó `temp/` del análisis de tipos y de ESLint. Los archivos privados de recuperación y dependencias de prueba no forman parte del programa ni condicionan su compilación; no se borraron herramientas útiles.

Archivos: `supabase/migrations/20261007150000_perfiles_y_acceso_servidor.sql`, `tests/sql/permisos-perfiles.mjs`, `app/(dashboard)/inventario/export/route.ts`, `tests/unit/inventario-export.test.ts`, `app/(dashboard)/layout.tsx`, `tsconfig.json`, `eslint.config.mjs`. No volver a ejecutar las migraciones antiguas para instalar este ajuste.

## Comprobaciones realizadas

- **664 pruebas en 51 archivos**, pruebas SQL de permisos (13 combinaciones) y nueve grupos de integridad SQL aislada aprobados. ESLint de los archivos modificados y compilación optimizada con comprobación de tipos aprobados. Todas las pantallas privadas quedaron dinámicas.
- Recuperación inicial: **81 tablas / 599 filas**, con Auth 2.197.0, PostgREST 14.5 y la misma corrección SQL. Trece sesiones reales: roles actuales/heredados, cambios de permisos de presentación y una cuenta inactiva. Perfil propio/empresa correctos, anónimo sin datos, operaciones directas y RPC no autorizadas bloqueadas, altas sin permisos automáticos e inserciones autorizadas del servidor aprobadas. Cuenta activa recuperada, renovación/salida sin correos; cuenta ya desactivada conservada.
- Programa compilado contra esos servicios locales: **16 rutas HTTP 200**, sin pantalla de fallo del panel; tres exportaciones descargadas. Matriz de trece sesiones sobre exportación de Inventario, Reportes y Respaldo: permisos respetados. El JSON de respaldo devuelve 400 a la dueña cuando se usa Supabase, conforme al diseño existente; no se habilitó esa importación/exportación para producción.
- **Storage 1.80.0 oficial sin modificar**, ejecutado en Alpine 3.24.2 temporal en RAM mediante QEMU 11.1.0 portátil: tres buckets, doce archivos recuperados, descargados y comparados por tamaño/SHA-256; **659686 bytes** iguales. Intentos anónimos de reemplazo rechazados. No se ejecutaron esas escrituras en producción.
- Contenido del Excel publicado de Reportes y del recuperado comparado por valores con el origen: nueve hojas, **53 movimientos de Caja, 7 muebles, 20 ventas de madera, 8 servicios, 8 movimientos de Kardex y 2 créditos**; compras, alquileres y sueldos vacíos coincidentes. CSV publicado/recuperado: tres meses e importes iguales. Kardex de Inventario recuperado: ocho filas, códigos, cantidades, costos, referencias e impacto coincidentes. No equivale a haber inspeccionado aún el archivo independiente de Kardex de la nueva publicación.
- Después de todas las pruebas locales, las **42 tablas / 257 registros** conservaron las huellas originales y las contraseñas cifradas de las dos cuentas siguieron iguales. Los almacenes habituales del programa se conservan; las escrituras de prueba usaron exclusivamente las copias aisladas.

## Instalación de estructura en producción

Se comprobó el proyecto original `rzjxobfgtlzdqmhbbvsk` con conexión TLS verificada y lectura forzada. Antes de instalar, las 42 huellas públicas coincidían con el respaldo original; había dos cuentas, tres buckets y doce adjuntos. Se instaló **solo `20261007150000_perfiles_y_acceso_servidor.sql`** en una transacción, registrando el SQL exacto en el historial de migraciones.

Después: las 42 huellas / 257 registros, las dos cuentas con sus contraseñas/estado y todos los metadatos de Storage coincidieron. Helpers con propietario/búsqueda fijos, relación correcta conservada y acceso directo de visitante/cuenta a tablas y RPC heredadas bloqueado. La instalación solo cambió estructura, permisos e historial técnico; no creó, borró ni modificó registros del negocio ni cambió contraseñas, planes o conexiones del cliente.

## Respaldo manual final

Archivo recomendado en Descargas: **`Katia-respaldo-manual-1.1.62-2026-10-07.zip`**, **792139 bytes**, 35 entradas; SHA-256 **`f58116f333edce08c28ebb412d4083e4b7d0a5be9aa9a911720744363571d41d`**. Copia privada adicional bajo `temp/respaldos-seguros/`; excluida de Git. Los ZIP anteriores se conservan, sin sustituirlos.

El dump final incorpora los permisos corregidos: **82 tablas / 604 filas**, tomadas en una instantánea de lectura compartida con `pg_dump`. Los registros del negocio siguen siendo 257; el aumento respecto de la copia anterior corresponde a sesiones/historial técnico. Recuperación nueva del archivo final: **81 tablas / 604 filas**, huellas, propietarios y permisos efectivos iguales; 16 roles, 22 membresías, **328 restricciones, 18 triggers y 50 políticas**. La restricción redundante eliminada explica la diferencia frente a las 329 anteriores.

Incluye doce binarios, manifiestos, catálogo, roles sin contraseñas de conexión, referencia visible de Auth y evidencias de servicios/permisos/exportaciones. La operación de Auth/Storage/programa se probó aparte sobre la recuperación inicial con **la misma corrección**; no se repitió innecesariamente toda esa matriz sobre el segundo archivo.

Free/manual, según elección del usuario: no hay copias diarias contratadas ni tareas automáticas. El ZIP no contiene todas las claves administradas o variables externas del proveedor. Una recuperación requiere preparar conexiones/JWT nuevos y configurar correo/URLs/destino; no garantiza conservar sesiones antiguas. Vault está vacío, incluido en el dump y omitido solo de la prueba de Windows. Realtime/Vault no se usan en los flujos revisados; no se certificó su operación administrada. Esos límites describen la recuperación técnica, no errores funcionales pendientes del programa.

Se retiraron **cinco directorios de base nuevos**, detenidos y con rutas verificadas; no quedaron puertos de recuperación. Linux/adjuntos temporales en RAM fueron retirados. Se conservaron respaldos, herramientas, logs y evidencias. El programa utiliza únicamente su proyecto Supabase habitual; no se creó otro proyecto ni se cambió de base.

Evidencia privada: `temp/respaldos-seguros/cierre-1.1.62/`, `base-final-1.1.62-2026-10-07-2/`, `servicios-locales/prueba-cierre-2026-10-07-4/` y `recuperacion-final-1.1.62-2026-10-07/`. Estos directorios no son una dependencia de la aplicación.

## Alcance del cierre

Quedan resueltos los pendientes funcionales identificados, con los límites de cada informe conservados. No se hicieron guardados reales, correos de invitación, restauraciones, cierres de mes ni limpiezas del negocio para comprobar pantallas. Las pruebas aprobadas no garantizan ausencia absoluta de cualquier error futuro. La siguiente tarea acordada es **únicamente la renovación visual**, manteniendo los pasos habituales.

Nota de parche: Se corrigieron los permisos de acceso y las descargas de inventario. Las cuentas mantienen su forma de trabajo y las invitaciones ya no fallan. Se verificaron exportaciones y el respaldo sin alterar los datos del negocio.
