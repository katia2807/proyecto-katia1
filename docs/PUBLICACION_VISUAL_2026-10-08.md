# Entrega visual — 08/10/2026, 1.1.66

Estado: preparada para publicación por petición expresa del usuario. La última producción comprobada sigue en 1.1.63 hasta confirmar el nuevo despliegue. No requiere migraciones, cambios de cuenta ni variables nuevas en Vercel.

## Cambios incluidos

- Apariencia neutral normal del programa: principal negro en claro y blanco en oscuro, texto inverso; colores de alertas y acentos de cada apartado conservados. La comparación local no se publica.
- Un único control de menú en la cabecera. En escritorio libera todo el ancho; en pantalla pequeña abre un diálogo con desplazamiento, cierre, Escape y foco controlado. Marca común y misma identidad de cuenta en cabecera/menú, con nombre del rol legible.
- Ayuda presenta seis tareas resumidas con enlaces según permisos y cuatro dudas plegadas. Retirado el flotante antiguo (VIS-A1), sin consumidores restantes.
- Bienvenida con nota de parche y tres pasos sobre tema, menú y cuenta. Avance, regreso, salto, cierre y Escape; recuerdo en almacenamiento de cada navegador/origen/versión, sin escritura en Supabase. Se retira el recorrido automático anterior para evitar presentaciones superpuestas. Las siguientes versiones conservan su aviso habitual.

Archivos principales: `app/appearance.css`, `app/update-tour.css`, `components/app-shell.tsx`, `components/brand-mark.tsx`, `components/update-tour.tsx`, `components/app-version-notice.tsx`, los layouts, `app/(dashboard)/ayuda/page.tsx` y `lib/app-version.ts`. Herramientas locales: `scripts/preview-visual.mjs`, `components/visual-preview-controls.tsx` y `app/visual-preview.css`; su barra solo se activa en desarrollo demo explícito.

## Comprobaciones locales realizadas

La compilación de 1.1.66, TypeScript y ESLint de los archivos modificados pasaron. Se aprobaron 32 pruebas existentes en tres archivos relacionados: permisos de exportación, datos de Inicio y datos de Centro de Mando. No se repitieron las 665 pruebas del cierre funcional anterior. Una compilación inicial reintentó la descarga de una fuente; las siguientes terminaron correctamente.

La compilación y ejecución finales usan el lanzador Node con modo demo forzado, almacén separado y variables de Supabase/Auth/Sentry vacías explícitamente. El modo de producción local mostró salud HTTP 200, demo activo y conexiones Supabase desactivadas. La apariencia se activa sin barra de comparación ni hueco reservado para ella. El almacén de prueba anterior se conserva entre reinicios; `data/store.json` mantiene SHA-256 `19fa05d7758db65ef8854d7dc143f26a55bbd2f8100ea9105b398cc5b2472cc9`.

Se comprobó el recorrido automático 1.1.66 en el navegador de la app y luego su primera aparición independiente en Edge: verlo en uno no marcó el otro. Se completaron los tres pasos y la recarga no lo repitió. En la etapa local también se probaron regreso, salto, Escape, foco, restauración del desplazamiento y repetición manual. Con el recorrido abierto, cambiar entre 360 y 1440 px selecciona el control visible; a 320 px la tarjeta cabe y no ensancha el documento. La transición respeta movimiento reducido.

Marca/avatar/acciones principales alternan negro/blanco correctamente; menú y Ayuda se probaron en ambos temas. Ayuda y el enlace de stock abren la tarea correspondiente sin guardar formularios. Consolas locales inspeccionadas sin errores ni advertencias detectados. Nota del aviso e historial coincidentes, 213 caracteres; fecha de entrega 08/10/2026. Las evidencias históricas siguen en `temp/propuesta-visual-1.1.65/` y las de publicación en `temp/publicacion-visual-1.1.66/`, excluidas de Git.

## Publicación y límites

Pendiente: subir el código a `main`, confirmar el estado Vercel y comprobar mediante lectura la versión publicada, recorrido, menú, temas, Ayuda y apartados principales con sesión real. La sesión actual de Edge abre Inicio; se conservaron en memoria las dos tablas visibles como referencia previa. Las rutas y sus lectores auxiliares se revisaron antes de navegar para evitar escrituras del negocio.

La revisión se limita a apariencia y navegación compartida. No acredita todos los lectores de pantalla, toda la matriz de roles ni ausencia absoluta de errores. No se guardan, importan, restauran, borran o editan registros del negocio para verificar producción; tampoco se modifican conexiones, contraseñas o permisos.

Nota de esta entrega: Se renovó la imagen en blanco y negro y se ajustó el menú para liberar espacio. Ayuda reúne respuestas breves y la bienvenida recorre los cambios una vez por navegador, conservando los pasos habituales de trabajo.
