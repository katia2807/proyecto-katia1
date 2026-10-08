# Entrega visual — 08/10/2026, 1.1.66

Estado: **publicada y comprobada mediante lectura**, por petición expresa del usuario. Producción muestra 1.1.66 y fecha 08/10/2026. No requirió migraciones, cambios de cuenta ni variables nuevas en Vercel.

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

El commit `0340cdead354e14f55da1c598b720ed8547d18d8` se subió a `main` y GitHub/Vercel confirmó estado `success`, despliegue `E2DjZL2PsBfRyYNVfmpbFXEVKYZ6`, en el proyecto existente `project-ukk6w` del equipo `grupo-ark-ccatun-rumi-sac`. El dominio habitual `https://proyecto-katia.vercel.app/` muestra versión/fecha correctas. Las rutas y sus lectores auxiliares se revisaron antes de navegar para evitar escrituras del negocio.

Con la sesión real existente de Edge, la primera bienvenida mostró exactamente la nota de parche, seguida de los tres pasos sobre los controles reales. Se terminó con «Listo»; recarga y navegación no la repitieron. A 360 × 800 px el segundo paso reajustó el resaltado al botón visible; tarjeta de 328 × 318 px situada a 16 px del borde. El menú compacto mide 220 px, presenta nombre/rol coherentes y se cierra al abrir Ayuda. No hay botón flotante, barra de comparación ni hueco de propuesta en producción.

En escritorio se probó ocultar/mostrar el menú con un solo control visible. Cabecera y menú coinciden en «Administrador 1 / Dueña», con inicial A; la marca K se distingue de la identidad personal. Tema claro principal `#202125`, oscuro `#f4f4f5`, con texto inverso; se comprobaron también las acciones principales estándar de Inventario. Ayuda mostró sus seis tareas y cuatro dudas; la respuesta sobre el menú se abrió correctamente. Los acentos secundarios siguen siendo de color.

Se cargaron Inicio, Ventas, Caja, Inventario, Cotizaciones, Centro de Mando, Reportes y Ayuda, con versión 1.1.66, sin avisos de carga fallida ni desbordamiento horizontal en escritorio. No se probaron otra vez todos sus guardados/exportaciones: este recorrido verifica la integración visual compartida. Las dos tablas visibles de Inicio coincidieron exactamente con la referencia previa, tanto al publicar como después de las comprobaciones; no equivale a una comparación completa de las tablas de la base. Consola inspeccionada: cero errores/advertencias detectados. Salud pública HTTP 200, demo desactivado, Supabase/Auth/datos preparados. No se enviaron formularios del negocio.

Capturas locales de evidencia: `bienvenida-produccion.png`, `recorrido-menu-movil-produccion.png`, `inventario-oscuro-produccion.png`, `ayuda-clara-produccion.png` y resumen `navegacion-produccion.json`, bajo `temp/publicacion-visual-1.1.66/`. La documentación de estas comprobaciones completa la misma entrega 1.1.66.

La revisión se limita a apariencia y navegación compartida. No acredita todos los lectores de pantalla, toda la matriz de roles ni ausencia absoluta de errores. No se guardan, importan, restauran, borran o editan registros del negocio para verificar producción; tampoco se modifican conexiones, contraseñas o permisos.

Nota de esta entrega: Se renovó la imagen en blanco y negro y se ajustó el menú para liberar espacio. Ayuda reúne respuestas breves y la bienvenida recorre los cambios una vez por navegador, conservando los pasos habituales de trabajo.
