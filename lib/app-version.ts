export const APP_VERSION = "1.1.67";
export const APP_LAST_UPDATE = "08/10/2026";
export const APP_UPDATE_SUMMARY =
  "El menú se recoge en una franja de iconos y vuelve a mostrar los nombres con un clic. Al elegir un apartado o trabajar fuera se contrae, dejando más espacio sin ocultar accesos ni cambiar tus formularios.";

/** Presentación de esta renovación; las siguientes notas no la reutilizan. */
export const APP_UPDATE_PRESENTATION = {
  version: "1.1.67" as string,
  seenVersion: "1.1.66",
  title: "Estrenamos imagen",
  description: APP_UPDATE_SUMMARY,
  steps: [
    { target: "appearance", title: "Una imagen más neutral", description: "Negro en modo claro y blanco en modo oscuro. Este botón cambia el tema; los colores de las alertas conservan su significado." },
    { target: "menu", title: "Más espacio para trabajar", description: "Este botón despliega los nombres del menú. Al elegir un apartado o volver al contenido queda una franja de iconos; en celular el menú se cierra por completo." },
    { target: "profile", title: "Tu cuenta, siempre reconocible", description: "La cuenta coincide con la del menú. Ayuda ahora reúne resúmenes prácticos; ya no hay un botón flotante cubriendo la pantalla." },
  ],
} as const;
