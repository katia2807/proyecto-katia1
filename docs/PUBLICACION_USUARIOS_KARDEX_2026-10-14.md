# Publicación segura de Usuarios y Kardex — 14/10/2026

## Estado de instalación y publicación

**Versión 1.1.90 en preparación de publicación.** La migración exacta `20261014010000_usuarios_y_kardex_seguros.sql` se instaló en el proyecto habitual `rzjxobfgtlzdqmhbbvsk`; el código todavía debe completar el despliegue y la comprobación pública. No se creó otra base ni se cambiaron contraseñas o planes.

El usuario autorizó respaldo, instalación y publicación de las correcciones H83-01, H83-02 y M83-01 comprobadas en [el candidato local](CORRECCIONES_USUARIOS_KARDEX_2026-10-14.md). La maqueta de Inicio/Centro de Mando continúa aparte y no se incluye. Las fórmulas, los redondeos pospuestos y los registros históricos conservan su tratamiento anterior.

## Respaldo y conservación de datos

- Respaldo completo nuevo, descargado mediante TLS verificado y conexión de solo lectura: **83 tablas / 592 filas**, incluidas **43 tablas del negocio / 257 filas**. El dump y las huellas proceden de una instantánea compartida; se conservaron estructura, permisos, roles sin contraseñas e índice legible.
- Archivo privado: `temp/publicacion-1.1.90/origen/base-completa.dump`, 755,256 bytes. SHA-256: `3483e4e4053e6f2835ef7a925878cea18041a4e58d258cd92587a7fc51b90931`. El dump contiene datos privados y no se incorpora a Git.
- Instalación en una transacción protegida: fuente idéntica a la probada, migración anterior comprobada y bloqueo breve de escrituras en tablas públicas. Se compararon **82 tablas / 528 filas existentes**, excluyendo únicamente la tabla del historial de migraciones que recibe el registro nuevo. Las huellas fueron idénticas antes y después.
- Se conservaron triggers, permisos de tablas existentes, las demás funciones y todas las entradas anteriores de migración. La tabla técnica nueva quedó vacía. Los tres auxiliares nuevos y el trigger corregido solo admiten ejecución del servidor; la tabla está protegida con RLS y sin acceso de cuentas normales.
- No se invocaron invitaciones, cambios de roles, ventas, anulaciones, ajustes de stock ni cobros en producción. La corrección de Kardex se aplica a ventas futuras; no añade salidas antiguas.

## Validación del código y límites

El candidato funcional separado de `main` aprobó **884 pruebas / 63 archivos**, compilación optimizada con tipos y ESLint. Se aprobaron **18 casos distintos con servicios locales reales**, incluido el caso adicional de compatibilidad, y el navegador local comprobó la invitación repetida sin cambios en Auth/perfil. Esta publicación solo cambia su versión/nota y documentación respecto a esos archivos probados.

La revisión en producción comprueba la fuente instalada, permisos, integridad y disponibilidad; no prueba guardados reales ni una matriz completa de roles. La reserva de gestión de usuarios puede permanecer pendiente ante una respuesta incierta y requerir soporte; no se libera por tiempo ni borrando identidades. El procedimiento está en el informe de correcciones.

Evidencia privada y herramientas específicas de esta instalación: `temp/publicacion-1.1.90/`. Mantener el respaldo y los informes; vaciar la entrada privada temporal al terminar. El borrador visual conserva su error de tipos previo y requiere otra revisión antes de publicarse.

Nota 1.1.90: Las invitaciones conservan las cuentas existentes y los cambios de usuarios protegen la última dueña activa. Las ventas nuevas de muebles aparecen en Kardex, con una sola salida de stock y sin alterar el historial.
