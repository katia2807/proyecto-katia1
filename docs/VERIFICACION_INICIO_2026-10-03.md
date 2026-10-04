# Verificación previa a producción — Inicio 1.1.17

Fecha: 03/10/2026.

## Resultado

La verificación local de Inicio y de los cambios asociados está aprobada. La aplicación compila para producción y los flujos comprobados funcionan en esa compilación. El lanzamiento con datos reales queda pendiente: este equipo no tiene credenciales de Supabase y no se dispone de un entorno de staging.

## Flujo comprobado

La persona abre Inicio, ve totales completos y el mes de Perú, entra al listado del pendiente elegido y puede quitar el filtro. Las consultas distinguen un resultado vacío de un fallo de carga. La actualización muestra una nota de parche en español.

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Compilación optimizada | Aprobada | `npm run build` terminó con código 0, incluyendo TypeScript y generación de rutas. |
| Pruebas automáticas | Aprobadas | 14 archivos y 132 pruebas aprobadas. Incluyen consultas con el SDK real de Supabase y respuestas PostgREST simuladas. |
| Tipos de aplicación y pruebas | Aprobados | `npm run typecheck` y `npx tsc --noEmit -p tests/unit/tsconfig.json`, código 0. |
| Control de calidad | Aprobado con advertencias | `npm run lint`: 0 errores y 53 advertencias anteriores, principalmente variables sin usar y dependencias de efectos. |
| Inicio en la compilación de producción | Aprobado | Stock 2, alertas 2, borradores 1, penalidades 1 y adelantos 1, con datos de prueba separados. Mes: octubre de 2026. |
| Stock | Aprobado | El enlace abre las dos alertas esperadas. La prueba automatizada incluye 1.005 productos activos, uno inactivo y uno eliminado; ambos lados conservan el mismo stock pendiente. |
| Ventas sin confirmar | Aprobado | Una venta en borrador, S/ 540,00, fecha 26/04/2026. Quitar el filtro recupera las cinco operaciones del historial. |
| Penalidades | Aprobado | Un contrato abierto con S/ 120,00 de penalidad. Quitar el filtro recupera los dos contratos. |
| Adelantos | Aprobado | Un adelanto pendiente por S/ 200,00. Quitar el filtro recupera los dos adelantos. |
| Alertas críticas | Aprobado | Dos alertas altas sin resolver; el enlace para quitar el filtro vuelve al Centro de Mando habitual. |
| Detalle y comprobantes | Aprobado | Vista interactiva, A4 y ticket muestran la misma fecha guardada y el mismo total de la venta. No se imprimieron documentos físicos. |
| Estados vacío y error | Aprobados en pruebas | Un fallo no se convierte en cero ni en “Sin pendientes”; se conserva el resto de los datos y existe reintento. |
| Acceso sin sesión | Aprobado en local | La raíz responde 307 y redirige a `/login?aviso=panel`. |
| Disponibilidad del servidor | Aprobada en local | `/api/health`: HTTP 200, `ok: true`, `demoMode: true`, `supabaseConfigured: false`. |
| Navegador | Aprobado | Sin mensajes de error o advertencia durante los flujos verificados. Se comprobó también el menú desplegable al reducirse el ancho de la ventana. |
| Nota de parche | Aprobada | Versión 1.1.17, fecha 03/10/2026 y 207 caracteres; el aviso coincide con `docs/NOTAS_DE_PARCHE.md`. |

## Correcciones durante la revisión

- Se corrigieron los 29 errores anteriores que impedían aprobar el control de calidad, con tipos explícitos, comprobaciones de datos y tratamiento correcto de excepciones, sin desactivar reglas.
- Inventario recorre páginas completas y excluye los productos eliminados, para coincidir con el total de Inicio incluso al superar 1.000 productos.
- Las fechas sin hora conservan el día guardado. Los instantes con hora se presentan en Perú; el ticket no inventa una hora para una fecha de calendario.
- Se corrigió un dato sobrante en una prueba que impedía verificar los tipos de los tests.
- Se estableció en `AGENTS.md` la obligación de incluir notas de parche en cada actualización, incluso mínima.

## Límite de esta verificación

La compilación se ejecutó localmente con `next start`, `KATIA_USE_DEMO_DB=1`, `NEXT_PUBLIC_COMBOBOX_MOCK=0` y datos aislados en `temp/inicio-production-preview`. No se desplegó ni se modificó una base de datos real. No se ejecutó la suite Playwright completa ni se verificaron todas las operaciones de escritura de los demás módulos.

Antes de lanzar con datos reales, configurar Supabase y la organización en el entorno de destino, comprobar que sus migraciones están aplicadas, desactivar el modo demo y los catálogos simulados, y repetir los flujos con una sesión real. Quedan sin comprobar la conexión real, sus permisos, los datos existentes y las escrituras contra esa base.
