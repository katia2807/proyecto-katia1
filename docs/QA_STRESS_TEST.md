# QA Humano — Stress Test Checklist
## Katia Suite v1.0 — Simular un día real de operación

**Objetivo**: Simular 2-3 horas de operación real como si fueras el cliente. Explorar TODOS los módulos, intentar romper todo lo que se pueda.

---

## Preparación
- [ ] Abrir en Chrome Desktop (pantalla completa)
- [ ] Abrir en Chrome Android (celular) o Safari iPad — verificar mobile
- [ ] Limpiar cookies/localStorage antes de empezar (para ver tour de bienvenida)
- [ ] Abrir Sentry dashboard en otra pestaña para monitorear errores en tiempo real

---

## Escenario 1: Primer ingreso (onboarding)
- [ ] Tour de bienvenida aparece automáticamente
- [ ] El tour tiene 6 pasos navegables
- [ ] Se puede saltar en cualquier paso
- [ ] Después de completarlo, no vuelve a aparecer al recargar
- [ ] Cookie consent aparece y se puede aceptar

---

## Escenario 2: Operación diaria completa
- [ ] Agregar 3 clientes nuevos (distintos tipos: persona, empresa, vip)
- [ ] Agregar 5 productos al inventario con distintas categorías
- [ ] Verificar que los códigos de producto se generan automáticamente
- [ ] Crear una cotización con 3 líneas de productos
- [ ] Confirmar/cobrar la cotización → verificar que aparece en Caja
- [ ] Registrar 3 movimientos de caja (2 ingresos, 1 egreso)
- [ ] Registrar una venta de madera cortada
- [ ] Registrar una venta de mueble terminado
- [ ] Verificar que los totales del Centro de Mando se actualizan

---

## Escenario 3: Inventario bajo presión
- [ ] Reducir el stock de un producto a 0 manualmente
- [ ] Verificar que aparece alerta en el Centro de Mando
- [ ] Verificar que aparece badge en el ícono de Inventario en el sidebar
- [ ] Intentar descontar más stock del disponible (debe fallar elegantemente)

---

## Escenario 4: Búsqueda global
- [ ] Buscar un cliente por nombre
- [ ] Buscar un cliente por teléfono
- [ ] Buscar un producto por nombre parcial
- [ ] Buscar una cotización por correlativo
- [ ] Verificar que los resultados llevan al lugar correcto

---

## Escenario 5: Reportes y exportaciones
- [ ] Exportar inventario a Excel → abrir el archivo y verificar que tiene datos
- [ ] Exportar reportes generales a Excel → verificar múltiples hojas
- [ ] Verificar que los cobros vencidos aparecen (si hay)
- [ ] Verificar la tabla de caja auditables

---

## Escenario 6: Tema y responsive
- [ ] Cambiar a tema claro
- [ ] Navegar todos los módulos en tema claro (verificar que no hay texto ilegible)
- [ ] Cambiar de vuelta a oscuro
- [ ] Verificar que al recargar la página mantiene el tema
- [ ] En mobile: verificar que el menú lateral funciona
- [ ] En mobile: verificar que los formularios son usables

---

## Escenario 7: Casos extremos y robustez
- [ ] Dejar un formulario a medias y navegar a otra página (no debe crashear)
- [ ] Intentar acceder a `/admin/respaldo` como usuario no-owner (debe denegar o redirigir)
- [ ] Recargar la página en el medio de una cotización abierta
- [ ] Abrir dos pestañas: crear una venta en cada una (verificar concurrencia)
- [ ] Intentar enviar un formulario vacío (validación debe funcionar)
- [ ] Buscar texto especial en la búsqueda: `'; DROP TABLE`, `<script>alert(1)</script>`

---

## Escenario 8: Concurrencia (2 sesiones)
- [ ] Abrir dos ventanas del navegador con la misma sesión (o dos usuarios distintos)
- [ ] En ambas ventanas, intentar registrar movimiento de caja simultáneamente
- [ ] En ambas ventanas, intentar modificar el mismo producto de inventario
- [ ] Verificar que los datos quedan consistentes

---

## Escenario 9: Centro de Mando completo
- [ ] Verificar tab "Hoy": KPI de ingresos del día es correcto
- [ ] Verificar tab "Hoy": Lista de pendientes muestra los correctos
- [ ] Verificar tab "Pasado": Métricas del mes son consistentes con Caja
- [ ] Verificar tab "Futuro": Cotizaciones pendientes coinciden con módulo Cotizaciones
- [ ] Verificar tab "Clientes 360°": buscar un cliente y ver su historial
- [ ] Verificar tab "Herramientas": los atajos llevan al lugar correcto

---

## Escenario 10: Centro de Mando bajo datos vacíos
- [ ] Con BD limpia (sin datos), verificar que no hay errores JS
- [ ] Todos los estados vacíos son descriptivos ("Sin pendientes", "Sin ventas", etc.)
- [ ] No hay NaN, undefined, ni errores en consola

---

## Post-stress: Verificaciones finales
- [ ] Abrir DevTools → Console: NO debe haber errores rojos
- [ ] Abrir DevTools → Network: NO debe haber requests con 500
- [ ] Sentry dashboard: revisar si capturó algo durante las pruebas
- [ ] Lighthouse: performance score > 70, accesibilidad > 80 (mobile)

---

## Bugs encontrados durante stress test

| # | Módulo | Descripción | Severidad | Estado |
|---|--------|-------------|-----------|--------|
| 1 |        |             |           |        |
| 2 |        |             |           |        |

---

*Katia Suite v1.0 — QA Stress Test — Mayo 2026*
