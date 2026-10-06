# Estado del proyecto y continuidad

Actualizado: 05/10/2026. Registro de mantenimiento: 1.1.39 (documentación).

## Punto de partida

La última revisión funcional publicada y comprobada es 1.1.38, commit `bcdc338`. Esta actualización documental no corrige los problemas de Inventario ni cambia operaciones del negocio. La versión vigente se consulta en `lib/app-version.ts` y su historial en [Notas de parche](NOTAS_DE_PARCHE.md).

El criterio acordado es corregir errores y detalles de diseño por partes, conservando el uso habitual. Esta página permite retomar el trabajo; leer solo la sección afectada y consultar el detalle cuando haga falta. No se integra en la aplicación ni se usa para bloquear su ejecución o exigir revisiones completas en cada cambio.

## Apartados trabajados

| Apartado | Estado de la revisión | Base y comprobaciones | Pendientes conocidos |
| --- | --- | --- | --- |
| Inicio | Revisión funcional cerrada dentro del alcance comprobado | 1.1.38: ventas recientes de las dos tablas de madera, enlaces al detalle correcto y tablas en celular. Verificado en local y producción. | No quedaron incidencias propias de esa revisión. |
| Ventas | Revisión funcional cerrada dentro del alcance comprobado | 1.1.38: historial, filtros, acceso a Clientes y regreso desde comprobante interactivo, A4 y ticket. Las operaciones mostradas antes y después de publicar coincidieron. | La revisión posterior de Inventario detectó una escritura automática en `getMueblesCatalogoRows`, también llamada por Ventas. Ver I1 en la revisión de Inventario; no está corregida. |
| Caja | Revisión funcional cerrada dentro del alcance comprobado | 1.1.37: resumen completo, filtros, movimientos protegidos, adjuntos y formulario en celular. En 1.1.38 se compararon todos los movimientos mostrados y el saldo sin diferencias. | No quedaron incidencias propias de esa revisión. |
| Inventario | Revisado para diagnóstico; correcciones pendientes | 05/10/2026: lectura de código y consulta de la copia local de productos, resumen, kardex, filtros y alertas. | [Lista de incidencias y prioridades](REVISION_INVENTARIO_2026-10-05.md). No se ejecutaron compras, ajustes, ediciones ni eliminaciones para esta revisión. |

Los otros apartados no tienen una revisión completa registrada en este proceso. No trasladarles el estado de los anteriores. El uso de componentes de Clientes, Cotizaciones o Configuración durante una comprobación de Ventas no significa que esos módulos estén terminados.

## Evidencia de la base funcional 1.1.38

- Suite de 473 pruebas aprobada. Las 12 pruebas de Inicio se repitieron tras el último ajuste de su modelo y pasaron.
- Compilación optimizada, tipos de aplicación y de pruebas aprobados. La revisión de los archivos modificados no encontró errores de ESLint; conservó cuatro advertencias anteriores.
- Publicación de Vercel confirmada y versión 1.1.38 visible en producción. `/api/health` respondió 200, con modo demo desactivado y configuración de Supabase lista para datos reales.
- Navegación, filtros, detalle y tres formatos de comprobante comprobados con una sesión real, sin errores de consola detectados en los recorridos revisados.
- Comparación de las filas visibles de Ventas y todas las páginas de Caja antes y después de publicar: sin diferencias. Esto no equivale a una auditoría de cada campo de todas las tablas de la base.
- Las escrituras completas en producción no se probaron con registros del negocio. La prueba real de adjunto PDF de Caja usó un archivo de prueba y no guardó un movimiento financiero.

Los informes de [Inicio del 03/10](VERIFICACION_INICIO_2026-10-03.md) y [Ventas del 04/10](VERIFICACION_VENTAS_2026-10-04.md) describen versiones anteriores. Sus limitaciones de publicación corresponden a esas fechas; se conservan por su evidencia y trazabilidad.

## Tecnologías de los apartados revisados

Versiones del archivo de dependencias fijadas al elaborar este registro; no indican una actualización solicitada de paquetes.

| Tecnología | Versión registrada | Uso observado |
| --- | --- | --- |
| Next.js / React | 16.2.4 / 19.2.4 | Rutas App Router, páginas de servidor, componentes interactivos y acciones de servidor. Compilación actual con Webpack. |
| TypeScript | 5.9.3 | Tipos de aplicación, datos y pruebas. |
| Tailwind CSS | 4.2.4 | Diseño, temas y adaptación a tamaños de pantalla. |
| Supabase JS / SSR | 2.105.1 / 0.10.2 | Consultas de servidor, sesión y conexión con PostgreSQL y Storage. |
| Zod | 4.4.1 | Validación de entradas en las acciones. |
| Vitest / ESLint | 4.1.6 / 9.39.4 | Pruebas y revisión de código. |
| ExcelJS | 4.4.0 | Exportación de Inventario a XLSX; pendiente corregir los botones que lo llaman CSV. |
| Node.js local | 24.15.0 | Entorno local observado. La versión exacta del runtime remoto no se comprobó. |

Producción está publicada en Vercel desde la rama `main` de `katia2807/proyecto-katia1`. URL: `https://proyecto-katia.vercel.app/`. No asumir que una configuración local antigua de `.vercel` identifica el proyecto correcto: la publicación comprobada fue mediante la integración con GitHub.

## Mapa breve para retomar

| Área | Archivos principales |
| --- | --- |
| Inicio | `app/(dashboard)/page.tsx`, `lib/inicio-data.ts` |
| Historial y detalle de Ventas | `app/(dashboard)/ventas/page.tsx`, `components/ventas/ventas-list-with-filters.tsx`, `lib/ventas-historial-navigation.ts`, `lib/venta-detalle.ts` |
| Comprobantes de Ventas | `app/(dashboard)/ventas/comprobante/[tipo]/[id]/page.tsx`, `components/sales/print-a4-voucher.tsx`, `components/sales/print-ticket-voucher.tsx`, `app/print/` |
| Caja | `app/(dashboard)/caja/page.tsx`, `components/caja/`, los archivos `lib/caja-*` y acciones correspondientes en `app/actions.ts` |
| Inventario | `app/(dashboard)/inventario/page.tsx`, `components/inventario-interactivo.tsx`, `components/inventario/`, `lib/data.ts` y acciones correspondientes en `app/actions.ts` |
| Datos y entornos | `lib/runtime.ts`, `lib/demo-mode.ts`, `lib/demo-store.ts`, `lib/server-data-dir.ts`, `lib/supabase/` |
| Aviso de actualización | `lib/app-version.ts`, `docs/NOTAS_DE_PARCHE.md` |

La vista local usada en estas revisiones está en `http://127.0.0.1:3001/`, con `KATIA_USE_DEMO_DB=1` y un almacén separado mediante `KATIA_SERVER_DATA_DIR`. Es una copia de pruebas, no una réplica sincronizada de producción. La sesión existente se reutilizó; no se habilitó acceso sin autenticación para esta revisión.

## Regla para la siguiente parte

1. Consultar el estado del apartado y sus pendientes; comprobar el código actual antes de basarse en un informe histórico.
2. Corregir un problema concreto y conservar los flujos que funcionan. Si afecta código compartido, revisar únicamente los recorridos relacionados.
3. Verificar en local de forma proporcional, registrar la evidencia y distinguir los datos de prueba de los reales.
4. Publicar cuando corresponda a la autorización del usuario; confirmar la versión y comprobar en producción solo operaciones apropiadas para ese entorno.
5. Actualizar este registro, la incidencia resuelta y la nota de parche. Incorporar nuevos módulos solo cuando se trabajen.

## Limpieza de documentación

Se sustituye `AUDITORIA_INICIO.md`, una propuesta de rediseño de mayo que pedía retirar partes de Inicio ahora conservadas por decisión del usuario. No era una verificación del estado actual. Su versión anterior sigue recuperable en Git.

Se mantienen los informes fechados, notas de parche, alcance inicial, guías de despliegue, glosario y documentación de apartados aún no revisados. Los planes anteriores son contexto histórico, no órdenes para introducir nuevas funciones sin petición del usuario.

La limpieza local retiró nueve logs de compilaciones concluidas de Caja/Ventas y el PDF descartable `temp/comprobante-prueba-demasiado-grande.pdf` (unos 5 MB liberados). Se conservaron las capturas útiles, los respaldos, archivos de datos, compilación y logs vigentes, pruebas y carpetas necesarias para el servidor local. Los temporales estaban excluidos de Git; no eran archivos del programa publicado.
