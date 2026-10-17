export const APP_VERSION = "1.1.92";
export const APP_LAST_UPDATE = "17/10/2026";
export const APP_UPDATE_SUMMARY =
  "Renovamos el acceso y el icono de Katia Suite. La carga muestra una vista limpia mientras esperas e Inicio te recibe con mensajes diarios variados, conservando tu forma de trabajo y los datos del negocio.";

/** Presentación de esta renovación; las siguientes notas no la reutilizan. */
export const APP_UPDATE_PRESENTATION = {
  version: "1.1.68" as string,
  seenVersion: "1.1.66",
  title: "Estrenamos imagen",
  description: APP_UPDATE_SUMMARY,
  steps: [
    { target: "appearance", title: "Una imagen más neutral", description: "Negro en modo claro y blanco en modo oscuro. Este botón cambia el tema; los colores de las alertas conservan su significado." },
    { target: "menu", title: "Más espacio para trabajar", description: "En escritorio, pasa el cursor por la franja de iconos para ver los nombres; al salir se recoge con una pequeña pausa. También funciona con Tab. En celular, usa el botón para abrir el menú." },
    { target: "profile", title: "Tu cuenta, siempre reconocible", description: "La cuenta coincide con la del menú. Ayuda ahora reúne resúmenes prácticos; ya no hay un botón flotante cubriendo la pantalla." },
  ],
} as const;
