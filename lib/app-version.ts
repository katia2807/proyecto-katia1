export const APP_VERSION = "1.1.66";
export const APP_LAST_UPDATE = "08/10/2026";
export const APP_UPDATE_SUMMARY =
  "Se renovó la imagen en blanco y negro y se ajustó el menú para liberar espacio. Ayuda reúne respuestas breves y la bienvenida recorre los cambios una vez por navegador, conservando los pasos habituales de trabajo.";

/** Presentación de esta renovación; las siguientes notas no la reutilizan. */
export const APP_UPDATE_PRESENTATION = {
  version: "1.1.66" as string,
  title: "Estrenamos imagen",
  description: APP_UPDATE_SUMMARY,
  steps: [
    { target: "appearance", title: "Una imagen más neutral", description: "Negro en modo claro y blanco en modo oscuro. Este botón cambia el tema; los colores de las alertas conservan su significado." },
    { target: "menu", title: "Más espacio para trabajar", description: "Este único botón abre y oculta el menú. En pantallas pequeñas el menú se esconde para dejar espacio a lo que estás haciendo." },
    { target: "profile", title: "Tu cuenta, siempre reconocible", description: "La cuenta coincide con la del menú. Ayuda ahora reúne resúmenes prácticos; ya no hay un botón flotante cubriendo la pantalla." },
  ],
} as const;
