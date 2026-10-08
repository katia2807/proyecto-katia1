# Menú recogido con iconos — 08/10/2026, 1.1.67

Estado: corrección y compilación locales aprobadas; publicación en curso. El usuario indicó después de 1.1.66 que el panel debía esconder sus nombres dejando los iconos. La comprobación anterior validó ocultarlo por botón, pero no este comportamiento solicitado (VIS-A2).

## Cambio y archivos

`components/app-shell.tsx` conserva el menú de escritorio y comienza recogido, con ancho de 64 px. «Expandir menú» despliega los nombres a 220 px; selección de un apartado, clic en el contenido y Escape lo recogen. No abre al pasar el cursor ni anima el ancho mientras se trabaja. El clic exterior se atiende después de su acción, sin impedirla ni cambiar el foco; Escape devuelve el foco al activador si estaba dentro del menú.

Cada icono conserva su enlace, color, nombre accesible, indicación de apartado activo y contador de avisos. El título muestra el nombre al señalarlo. Marca, cuenta y salida siguen accesibles; no se cambia la acción de cierre de sesión. Los nombres ocultos visualmente siguen disponibles para tecnologías de asistencia. Solo en la franja recogida se oculta la barra de desplazamiento (`app/appearance.css`); rueda y teclado siguen disponibles, y el panel completo conserva su barra habitual. El menú móvil continúa como diálogo y no ocupa espacio hasta abrirlo.

Ayuda actualiza únicamente la respuesta sobre el menú. `lib/app-version.ts`, `components/app-version-notice.tsx` y `components/update-tour.tsx` conservan la presentación para esta entrega relacionada con recuerdo de 1.1.66: no vuelve a abrirse para quien ya la terminó y muestra en su lugar la nota breve de 1.1.67. La repetición manual local sigue disponible. No hay preferencias en Supabase ni modificación de roles o formularios.

## Comprobaciones locales

- Servidor reiniciado con el mismo modo demo y almacén `temp/propuesta-visual-1.1.64/`. Salud 200, Supabase/Auth desactivados. El original `data/store.json` conserva SHA-256 `19fa05d7758db65ef8854d7dc143f26a55bbd2f8100ea9105b398cc5b2472cc9`.
- TypeScript y ESLint de los archivos modificados aprobados. Nota de aviso/historial igual, 204 caracteres; revisión de espacios correcta. No se añaden pruebas que dupliquen el comportamiento del componente ni se repiten pruebas de cálculos sin cambios.
- Navegador: inicio/recarga con franja de 64 px; enlaces de aproximadamente 43 × 40 px; expansión a 220 px y recogida con selección, clic exterior y Escape. Un clic exterior abrió la respuesta de Ayuda y conservó el foco, sin necesitar otro clic.
- En Cotizaciones aislada se escribió un texto de prueba sin guardar. Desplegar el menú y volver al campo conservó ese texto; se vació el campo al terminar. Escape desde un enlace devolvió el foco a «Expandir menú».
- Recorrido manual local abre/cierra y devuelve foco al activador; recargar no lo repite. A 360 × 800 px el diálogo móvil abre, se cierra al elegir Ayuda y no ensancha la página; se restituyó el tamaño habitual.
- Compilación ejecutada en modo de producción local: salud 200 y Supabase desactivado, franja de 64 px desde el inicio, expansión/recogida por clic exterior aprobadas, sin barra de comparación ni repetición del recorrido. Consola de esta carga sin errores/advertencias detectados. Se abrió una pestaña HTTP limpia tras detener el servidor de desarrollo; no se reutilizó su página de error.
- Durante la recarga en caliente apareció una advertencia por cambiar las dependencias de un efecto mientras se editaba; la carga completa posterior utiliza las dependencias finales. Algunas rutas nuevas tardaron en compilar y el navegador agotó su espera; el registro confirmó respuestas 200 y se verificó la pantalla antes de seguir.

Evidencia local en `temp/menu-1.1.67/`, excluida de Git. La compilación final se ejecuta con el lanzador aislado `node scripts/preview-visual.mjs --build`; no se comparte `.next` con un servidor de desarrollo activo.

## Publicación

Compilación optimizada y sus tipos aprobados, sin servidor de desarrollo concurrente. Pendiente subir a `main`, esperar el despliegue y comprobar por lectura el menú con sesión real. Las rutas de Ayuda, Inicio, Cotizaciones y sus auxiliares ya se verificaron como lectores en la entrega 1.1.66; no se guardarán formularios, editarán cuentas ni cambiarán datos del negocio.

Nota: El menú se recoge en una franja de iconos y vuelve a mostrar los nombres con un clic. Al elegir un apartado o trabajar fuera se contrae, dejando más espacio sin ocultar accesos ni cambiar tus formularios.
