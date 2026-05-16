# Auditoría de pantalla Inicio — Katia Suite

Fecha: 16 mayo 2026
Regla: cada elemento debe responder UNA pregunta real del dueño.
Si no responde ninguna pregunta, se archiva via feature flag.

## Preguntas reales del dueño al abrir el sistema

1. ¿Cómo vamos hoy? → KPI de ingresos del DÍA (no del mes)
2. ¿Qué tengo que resolver YA? → Lista priorizada de 3-5 pendientes
3. ¿Dónde está mi negocio en el mes? → 1 gráfico de tendencia
4. ¿Hay algo crítico? → Banner que SOLO aparece si hay algo crítico
5. ¿Quiero hacer algo rápido? → Atajos directos

## Análisis elemento por elemento (pantalla actual)

### Tarjetas de acción (5 cards superiores)

| Elemento                  | Responde pregunta | Decisión          | Flag legacy              |
|---------------------------|-------------------|-------------------|--------------------------|
| Stock por revisar          | SÍ — #2           | CONSERVAR         | —                        |
| Penalidades activas        | SÍ — #2           | CONSERVAR (renombrar a "Sanciones") | —         |
| Adelantos pendientes       | SÍ — #2           | CONSERVAR (renombrar a "Anticipos") | —         |
| Ventas por confirmar       | SÍ — #2           | CONSERVAR (renombrar a "En borrador") | —       |
| Alertas críticas           | SÍ — #4           | CONVERTIR a banner condicional | —          |

**Problema**: 5 cards compiten igual en jerarquía. Solución OLA 4: reducir a lista priorizada de items donde el más urgente está arriba con badge de prioridad.

### KPIs de métricas (4 metric cards segunda fila)

| Elemento                  | Responde pregunta | Decisión          | Flag legacy                     |
|---------------------------|-------------------|-------------------|---------------------------------|
| Ingresos del período      | SÍ — #1 (pero dice "período" no "hoy") | ADAPTAR a "Ingresos del día" | — |
| Egresos del período       | NO — no es urgente el egreso total | ARCHIVAR | `legacy.egresos_periodo_kpi` |
| Empleados activos         | NO — irrelevante en Inicio | ARCHIVAR | `legacy.empleados_activos_kpi` |
| Alertas operativas        | CONFUNDE — duplica "Alertas críticas" | ARCHIVAR | `legacy.alertas_operativas_kpi` |

### Tablas (segunda sección)

| Elemento                  | Responde pregunta | Decisión          | Flag legacy                      |
|---------------------------|-------------------|-------------------|----------------------------------|
| Movimientos de caja recientes | NO — vive en Caja | ARCHIVAR       | `legacy.movimientos_caja_inicio` |
| Plan de acción de hoy     | SÍ — #2           | REDISEÑAR como lista priorizada | —     |
| Ventas recientes          | NO — vive en Ventas | ARCHIVAR       | (se mueve a sección de Centro de Mando > Pasado) |
| Alquileres recientes      | NO — vive en Ventas/Alquiler | ARCHIVAR | —                          |
| Utilidad mensual          | SÍ — #3           | MOVER a Centro de Mando > Pasado | —    |

## Layout propuesto para Ola 4 (Centro de Mando > Hoy)

```
[Banner crítico - SOLO si hay algo urgente]

[KPI hero: Ingresos de HOY]    [Gráfico: tendencia del mes]
[Variación vs ayer]

[Lista de pendientes priorizados — máximo 5 items]
→ Item 1 (Alta)     [Abrir]
→ Item 2 (Alta)     [Abrir]
→ Item 3 (Media)    [Abrir]

[Atajos rápidos]
[+ Nueva venta] [+ Cotizar] [+ Cliente] [+ Producto]
```

## Nomenclatura a actualizar (ver GLOSARIO.md)

- "Penalidades activas" → "Sanciones aplicadas"
- "Adelantos pendientes" → "Anticipos por aplicar"
- "Ventas por confirmar" → "Ventas en borrador"
- "Ingresos del período" → "Ingresos del mes" / "Ingresos de hoy"
- "Alertas críticas" + "Alertas operativas" → "Alertas" (unificado)

## Elementos archivados (reactivables via feature flags)

Todos los elementos archivados quedan disponibles en la tabla `feature_flags`
con prefijo `legacy.*`. Para reactivar, el owner puede activar el flag desde
Admin > Configuración > Funciones avanzadas.
