# Menú automático — 08/10/2026, 1.1.68

Estado: corrección comprobada en desarrollo y compilación local final; publicación pendiente. Sustituye la interacción por botón de 1.1.67, cuyo registro se conserva como antecedente. El usuario pidió abrir los nombres al pasar el cursor y recogerlos al salir sin incomodar.

## Cambio

`components/app-shell.tsx` retira únicamente el botón de la cabecera en escritorio. La franja reserva siempre 64 px; el panel crece sobre el contenido hasta 220 px sin desplazarlo. Iconos y filas conservan sus posiciones al abrir/cerrar. Entrada con ratón o lápiz: 140 ms; salida: 320 ms. Reentrar cancela el cierre pendiente. Selección y clic exterior lo recogen sin impedir la acción pulsada. Los temporizadores se limpian al desmontar.

Tab despliega los nombres, mantiene el panel mientras el foco de teclado esté dentro y permite recogerlo con Escape conservando el enlace enfocado y su icono visible. Al salir con el teclado se recoge. La marca K permite desplegarlo con toque en pantallas grandes. En pantallas inferiores a 1280 px se conserva el botón y diálogo móvil, cierre, fondo y permisos anteriores.

`app/appearance.css` anima ancho/opacidad y desactiva esas transiciones para la preferencia de movimiento reducido. La barra de desplazamiento se oculta en la franja y está disponible en el panel abierto. Ayuda resume el uso nuevo. La presentación 1.1.68 conserva `seenVersion: 1.1.66`, evitando repetir el recorrido terminado; la nota nueva se muestra mediante el aviso habitual. No hay cambios de datos, permisos, conexión, cálculos o guardados.

## Comprobaciones realizadas

- Servidor reiniciado tras identificar ruta, puerto y cadena de procesos del proyecto; mismo modo demo, puerto 3001 y almacén separado `temp/propuesta-visual-1.1.64/`. Salud 200, Supabase/Auth desactivados. Original `data/store.json` conserva SHA-256 `19fa05d7758db65ef8854d7dc143f26a55bbd2f8100ea9105b398cc5b2472cc9`.
- TypeScript y ESLint de archivos modificados aprobados. No se repite la revisión de cálculos que no cambian.
- Navegador local: franja inicial de 64 px, panel de 220 px. Coordenadas y ancho del contenido, y coordenadas de los primeros cuatro iconos, iguales antes/después de abrir. Entrada por área vacía sin activador; salida con movimiento mediante clic secundario en área no interactiva, sin disparar el cierre por clic principal. Se observó la recogida automática.
- Teclado: Tab abre y enfoca Inicio; Escape recoge conservando ese enlace y su icono; Tab posterior abre y avanza a Caja. Recorrido manual: paso del menú apunta a la marca visible y presenta la explicación nueva.
- Celular 360 × 800: botón y diálogo abren; elegir Ayuda cierra. Ancho de documento 350 px dentro del viewport de 360 px, sin desbordamiento; desplazamiento del cuerpo restituido. Tamaño habitual restablecido.
- Cotizaciones aislada: texto escrito sin guardar conservado tras abrir por entrada en la barra y recogerse al salir. Se vació el campo de prueba al terminar. El recorrido cerrado devuelve el foco al activador local.
- Nota de aviso e historial coincidentes, 210 caracteres. Revisión React: temporizador y escuchas con limpieza, foco y teclado disponibles, sin consultas nuevas ni cambios de autorización. Estilos de movimiento reducido revisados en código; no se cambió la preferencia del sistema.
- Compilación optimizada y sus tipos aprobados, sin desarrollo concurrente. Servidor compilado con salud/Ayuda 200 y Supabase desactivado; navegador con barra inicial de 64 px, apertura a 220 px, recogida al volver al contenido, contenido sin desplazarse y botón de cabecera ausente en escritorio. Consola de la carga válida sin errores/advertencias detectados. Una pestaña quedó vacía; salud y registros del servidor seguían correctos, se abrió la ruta HTTP conocida y se repitió esta comprobación. El diagnóstico demo se muestra solo en esta instancia aislada, sin cambiar producción.

Evidencias locales en `temp/menu-1.1.68/`, excluidas de Git. Las verificaciones de producción se registrarán después de confirmar su despliegue; las anteriores no se atribuyen automáticamente a esta entrega.

Nota: El menú muestra los nombres al pasar el cursor por sus iconos y se recoge suavemente al salir. Se retiró el botón de escritorio para despejar la cabecera, sin mover el contenido ni cambiar tu forma de trabajar.
