# Instrucciones del proyecto

## Notas de parche obligatorias

- Cada actualización entregable debe incluir una nota de parche, aunque el cambio sea mínimo, visual, de documentación o una corrección.
- Escribirla en español, en un párrafo fácil de leer, de aproximadamente 200 caracteres (orientación: 180–240). Explicar qué mejoró y qué beneficio tiene para la persona que usa el programa; evitar detalles técnicos innecesarios y frases vagas.
- Actualizar `APP_VERSION`, `APP_LAST_UPDATE` y `APP_UPDATE_SUMMARY` en `lib/app-version.ts` para que el aviso del programa muestre la nota nueva. Incrementar la versión de parche y usar la fecha de la actualización.
- Añadir la misma nota al principio de `docs/NOTAS_DE_PARCHE.md`, con versión y fecha. Conservar las notas anteriores.
- Una actualización puede agrupar cambios relacionados en una sola nota. No inventar mejoras ni afirmar verificaciones que no se hayan realizado.
- Antes de entregar, verificar que la nota del aviso coincide con la del historial e incluirla en el resumen al usuario.
