# Instrucciones del proyecto

## Continuidad y alcance de las revisiones

- El punto de entrada es `docs/ESTADO_DEL_PROYECTO.md`: resume lo revisado, lo pendiente, las tecnologías y los archivos principales. Consultar primero el apartado afectado; no releer todo el historial para cada cambio.
- Trabajar por apartados y conservar la forma de trabajo acordada con el usuario. Priorizar errores y problemas de diseño; no añadir funciones ni rediseñar lo que funciona sin una petición que lo justifique.
- Antes de trabajar o entregar una vista local, reiniciar el servidor correspondiente y comprobar que la página responde: el usuario apaga o reinicia la PC con frecuencia. Si hay un proceso anterior, identificarlo por ruta y puerto antes de detenerlo; conservar su modo y almacén de datos, sin detener otros servicios ni asumir que la sesión previa sigue activa.
- Actualizar el estado solo del apartado trabajado, con fecha, versión, cambios concretos y comprobaciones realmente realizadas. Distinguir revisión local, publicación y verificación en producción; los demás apartados siguen sin evaluación completa.
- Una revisión cerrada describe su alcance comprobado, no garantiza que no existan otros errores. Registrar también las incidencias nuevas que afecten a funciones compartidas, aunque se descubran desde otro apartado.
- Antes de revisar producción, comprobar que la ruta y sus funciones auxiliares sean de lectura: una carga de página también puede ejecutar escrituras. Usar datos locales aislados para operaciones que puedan modificar registros; no cambiar datos del negocio para verificar una pantalla.
- La documentación es una referencia para continuar, no una dependencia del programa ni una obligación de repetir pruebas completas sin motivo. Elegir verificaciones proporcionales al cambio y a los riesgos encontrados.
- Limpiar solo documentos sustituidos o archivos temporales claramente prescindibles. Conservar evidencias útiles, respaldos y documentación importante o de apartados aún no revisados. Verificar referencias y rutas antes de borrar; no eliminar dependencias ni archivos usados por el servidor local.

## Notas de parche obligatorias

- Cada actualización entregable debe incluir una nota de parche, aunque el cambio sea mínimo, visual, de documentación o una corrección.
- Escribirla en español, en un párrafo fácil de leer, de aproximadamente 200 caracteres (orientación: 180–240). Explicar qué mejoró y qué beneficio tiene para la persona que usa el programa; evitar detalles técnicos innecesarios y frases vagas.
- Actualizar `APP_VERSION`, `APP_LAST_UPDATE` y `APP_UPDATE_SUMMARY` en `lib/app-version.ts` para que el aviso del programa muestre la nota nueva. Incrementar la versión de parche y usar la fecha de la actualización.
- Añadir la misma nota al principio de `docs/NOTAS_DE_PARCHE.md`, con versión y fecha. Conservar las notas anteriores.
- Una actualización puede agrupar cambios relacionados en una sola nota. No inventar mejoras ni afirmar verificaciones que no se hayan realizado.
- Antes de entregar, verificar que la nota del aviso coincide con la del historial e incluirla en el resumen al usuario.
