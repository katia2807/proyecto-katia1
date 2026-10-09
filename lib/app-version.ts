export const APP_VERSION = "1.1.69";
export const APP_LAST_UPDATE = "08/10/2026";
export const APP_UPDATE_SUMMARY =
  "Caja y Cotizaciones facilitan la navegación y validan mejor los datos. Inventario aclara el stock y la hora de registro; Reportes ofrece resúmenes filtrados en Excel, CSV y PDF. El aviso del login gana contraste.";

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
