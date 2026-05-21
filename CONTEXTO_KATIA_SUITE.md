# CONTEXTO COMPLETO — Katia Suite (ERP)
> Archivo generado el 16/05/2026. Pasar este archivo a cualquier IA antes de trabajar en el proyecto.

---

## 1. IDENTIDAD DEL PROYECTO

- **Nombre comercial:** Katia Suite (antes "ERP Katia")
- **Tipo:** ERP web para empresa de madera, aserradero y muebles (Perú)
- **Cliente final:** Grupo ARK Ccatun Rumi S.A.C.
- **Desarrolladora:** Txnit (tú, la dev)
- **Estado actual:** v1.0.0 — en cierre final (entrega objetivo: 26 mayo 2026)

---

## 2. STACK TÉCNICO

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Deploy | Vercel (CI/CD automático desde GitHub) |
| Iconos | @tabler/icons-react |
| Gráficas | Recharts |
| Errores | Sentry (integrado en v1.0) |
| Tests E2E | Playwright |
| Tests unitarios | Vitest |

---

## 3. REPOSITORIOS Y URLs

| Recurso | URL |
|---------|-----|
| Producción | https://proyecto-katia.vercel.app |
| Repo clienta (deploy activo) | https://github.com/katia2807/proyecto-katia1 |
| Repo dev (tuyo) | https://github.com/Txnit/proyecto-katia |
| Supabase project-ref | rzjxobfgtlzdqmhbbvsk |
| Supabase URL | https://rzjxobfgtlzdqmhbbvsk.supabase.co |

---

## 4. VARIABLES DE ENTORNO (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://rzjxobfgtlzdqmhbbvsk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=configurada
SUPABASE_SERVICE_ROLE_KEY=configurada
ERP_ORG_ID=00000000-0000-0000-0000-000000000001
ANTIFRAUD_ACCESS_CODE=configurada
NEXT_PUBLIC_SITE_URL=https://proyecto-katia.vercel.app
```

---

## 5. PERFIL DEL USUARIO ADMINISTRADOR (Supabase)

```
Email:           katiamenestaype@gmail.com
user_id:         07aab2c6-a727-4d0a-ab31-14ee7fd9089c
role:            owner_admin
organization_id: 00000000-0000-0000-0000-000000000001
```

---

## 6. SISTEMA DE ROLES

| Rol | Acceso |
|-----|--------|
| `owner_admin` | Todo el sistema, incluyendo eliminar en cascada, resetear datos |
| `gerencia` | Panel gerencial, reportes, vista de operación |
| `vendedor` | Ventas, cotizaciones, clientes |
| `almacen` | Inventario |
| `caja` | Módulo de caja |

---

## 7. ESTRUCTURA DE RUTAS (App Router)

```
app/
├── (auth)/login/                    → Login glassmorphism split-screen
├── (dashboard)/
│   ├── layout.tsx                   → Shell con sidebar + header + auth guard
│   ├── page.tsx                     → Centro de Mando (dashboard principal)
│   ├── gerencial/page.tsx           → Panel gerencial con gestión de clientes
│   ├── ventas/
│   │   ├── page.tsx                 → Hub de ventas (resumen + links)
│   │   ├── clientes/page.tsx        → Listado master-detail de clientes
│   │   ├── clientes/[id]/page.tsx   → Ficha de cliente
│   │   ├── muebles-terminados/      → Ventas de muebles terminados
│   │   ├── muebles-personalizados/  → Ventas de muebles a medida
│   │   ├── madera-cortada/          → Ventas de madera
│   │   ├── alquiler-mixer/          → Alquiler de mezcladora
│   │   ├── aserradero-servicios/    → Servicios de aserradero
│   │   ├── zonas-entrega/           → Zonas y choferes
│   │   ├── proveedores-comparador/  → Comparador de proveedores
│   │   ├── comprobante/[tipo]/[id]/ → Vista de comprobante/PDF
│   │   └── dashboard/               → Dashboard de ventas
│   ├── cotizacion/page.tsx          → Cotizaciones (wizard unificado)
│   ├── caja/page.tsx                → Movimientos de caja
│   ├── inventario/page.tsx          → Inventario con filtros y métricas
│   ├── reportes/page.tsx            → Reportes + antifraude
│   ├── registro/page.tsx            → Bitácora / registro general
│   ├── personal/page.tsx            → Gestión de personal
│   ├── configuracion/page.tsx       → Cuenta + empresa + preferencias
│   ├── ayuda/page.tsx               → Manual de usuario interno
│   ├── admin/
│   │   ├── usuarios/                → Gestión de usuarios
│   │   ├── empresa/                 → Config de empresa (logo, datos)
│   │   ├── respaldo/                → Backup + import/export + reset
│   │   └── importar/                → Importador con revisión humana
│   └── seguridad/page.tsx           → Seguridad (2FA, sesiones)
├── api/health/route.ts              → Health check endpoint
├── error.tsx                        → Página de error global
├── not-found.tsx                    → 404 personalizado
└── legal/                           → Términos + privacidad
```

---

## 8. ARCHIVOS CLAVE DEL PROYECTO

| Archivo | Rol |
|---------|-----|
| `app/actions.ts` | TODAS las server actions (3982+ líneas). Aquí van todas las mutaciones |
| `lib/data.ts` | Queries de lectura a Supabase |
| `lib/permissions.ts` | Helpers de control de acceso por rol |
| `lib/constants.ts` | NavItems del sidebar, constantes globales |
| `lib/features.ts` | Feature flags del sistema |
| `lib/demo-store.ts` | Store en memoria para modo demo (sin Supabase) |
| `lib/codigo-producto.ts` | Generador de códigos de producto automáticos |
| `lib/precio-sugerido.ts` | Lógica de sugerencia de precios por historial |
| `components/app-shell.tsx` | Shell principal: sidebar + header + navegación |
| `components/ui/theme-toggle.tsx` | Toggle tema oscuro/claro (componente cliente) |
| `components/gerencial/cliente-estado-form.tsx` | Form cliente de estado (corrige bug de select) |
| `app/globals.css` | CSS variables del sistema de diseño (tokens `--katia-*`) |

---

## 9. SISTEMA DE DISEÑO (tokens CSS)

El diseño usa variables `--katia-*` definidas en `app/globals.css`.
Tema oscuro en `:root`, tema claro en `[data-theme="light"]`.

### Paleta oscura (base)
```css
--katia-bg-base:        #0A0A14
--katia-bg-elevated:    #14141F
--katia-primary:        #8B5CF6   /* violet 500 */
--katia-secondary:      #EC4899   /* pink 500 */
--katia-gradient-hero:  linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)
--katia-text-primary:   #F4F4F5
--katia-text-secondary: #A1A1AA
--katia-success:        #10B981
--katia-warning:        #F59E0B
--katia-danger:         #EF4444
```

### Glass card (receta)
```css
background: rgba(255,255,255,0.04);
backdrop-filter: blur(20px) saturate(1.4);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.40);
```

### Toggle de tema
- Componente: `components/ui/theme-toggle.tsx` ("use client")
- Persiste en `localStorage` con key `theme_override`
- `ThemeByTime` en `app/layout.tsx` aplica tema automático por hora (oscuro de noche, claro de día), respetando override manual

---

## 10. BASE DE DATOS — TABLAS PRINCIPALES

```
clientes          (id, organization_id, nombre, documento, telefono, direccion, tipo, estado, created_at, deleted_at)
productos         (id, organization_id, nombre, codigo, categoria, stock, precio, stock_minimo, deleted_at)
movimientos_caja  (id, organization_id, fecha, tipo, medio, categoria, monto, descripcion, es_personal, modulo_origen)
cotizaciones_unificadas (id, organization_id, cliente_id, estado, total, correlativo, created_at)
cotizaciones_mueble     (id, organization_id, cliente_id, estado, tipo, items, total)
ventas_mueble_terminado (id, organization_id, cliente_id, estado_entrega, total, fecha)
ventas_madera           (id, organization_id, cliente_id, estado_entrega, total, fecha)
servicios_aserradero    (id, organization_id, cliente_id, tipo_servicio, monto, fecha)
alquileres              (id, organization_id, cliente_id, equipo, fecha_inicio, fecha_fin, monto)
ordenes_produccion      (id, organization_id, cliente_id, estado, descripcion, fecha_entrega)
perfiles                (id, organization_id, email, role, ui_role, nombre)
audit_logs              (id, organization_id, user_id, action, table_name, record_id, created_at)
notifications           (id, organization_id, user_id, tipo, mensaje, leida, created_at)
feature_flags           (id, organization_id, key, enabled, descripcion)
```

### Migraciones ejecutadas (en orden)
```
20260515120000_add_estado_clientes.sql           ✅ ejecutada en Supabase
20260516_002_add_deleted_at_global.sql           ejecutar en Supabase
20260516_003_add_indices_criticos.sql            ejecutar en Supabase
20260516_004_add_constraints_integridad.sql      ejecutar en Supabase
20260516_005_codigos_familiares_productos.sql    ejecutar en Supabase
20260516_006_feature_flags_table.sql             ejecutar en Supabase
20260516_007_auto_crear_perfil_usuario.sql       ejecutar en Supabase
20260517_001_audit_logs_table.sql                ejecutar en Supabase
20260517_002_notifications_table.sql             ejecutar en Supabase
20260517_003_rls_policies_review.sql             ejecutar en Supabase
20260517_004_user_preferences_table.sql          ejecutar en Supabase
20260519_001_rpc_cerrar_venta_atomic.sql         ejecutar en Supabase
20260519_002_rpc_stock_concurrencia.sql          ejecutar en Supabase
20260519_003_rpc_confirmar_cotizacion_atomic.sql ejecutar en Supabase
20260520_001_reset_entrega_limpia.sql            ejecutar en Supabase
```

⚠️ **IMPORTANTE**: Estas migraciones están en el repo pero pueden no estar aplicadas aún en Supabase. Verificar con el SQL Editor antes de asumir que existen las tablas.

---

## 11. FIXES REALIZADOS EN ESTA SESIÓN (16/05/2026)

Todos commiteados y en producción:

| Fix | Commit | Estado |
|-----|--------|--------|
| SQL: columna `estado` en tabla `clientes` | ejecutado en Supabase SQL Editor | ✅ |
| `href="#"` en tarjetas Proveedores y Choferes del hub de Ventas | `app/(dashboard)/ventas/page.tsx` | ✅ |
| Búsqueda global → URL correcta de cliente (`/ventas/clientes/${id}`) | `app/(dashboard)/layout.tsx` | ✅ |
| Merge roto en `createCajaMovimiento` (código de `deleteCliente` mezclado) | `app/actions.ts` | ✅ |
| Merge roto en `repetirGastosMesAnterior` (idem) | `app/actions.ts` | ✅ |
| Null guard en `deleteCliente` para `cliente` posiblemente null | `app/actions.ts` | ✅ |
| Select de estado en gerencial siempre mostraba "Activo" | `components/gerencial/cliente-estado-form.tsx` (nuevo, "use client") | ✅ |
| Eliminar cliente + registros en cascada desde gerencial (owner_admin) | `app/actions.ts` + `app/(dashboard)/gerencial/page.tsx` | ✅ |
| Toggle tema oscuro/claro de vuelta en header | `components/ui/theme-toggle.tsx` (nuevo) + `components/app-shell.tsx` | ✅ |
| Mensaje de éxito/error en gerencial visible siempre (no solo con cliente) | `app/(dashboard)/gerencial/page.tsx` | ✅ |

---

## 12. BUGS PENDIENTES / FLUJOS INCOMPLETOS

### Prioridad alta
- [ ] **Editar movimiento de Caja**: el botón "Editar" del drawer abre modo edición pero no hay formulario real. Solo muestra texto estático.
- [ ] **Mensaje colores gerencial**: el color del toast de confirmación puede no estar perfecto en tema claro (usar variables `--katia-*` en lugar de clases hardcoded amber).

### Prioridad media
- [ ] **Páginas de Proveedores y Choferes**: el hub de ventas ya linkea a `/ventas/proveedores-comparador` y `/ventas/zonas-entrega` pero las páginas son básicas, sin CRUD completo.
- [ ] **Onboarding tour**: implementado pero verificar que se dispara correctamente al primer login.
- [ ] **Migraciones de Supabase pendientes**: las migraciones del refactor de Cursor (ver sección 10) pueden no estar aplicadas en producción. Verificar una por una en el SQL Editor.

### Prioridad baja (Backlog v1.1)
- Mermas, conversión de unidades, kardex completo
- Ventas a crédito, devoluciones
- Órdenes de compra a proveedores
- Email transaccional (Resend)
- Multi-pago en una venta
- Código de barras

---

## 13. CÓMO TRABAJAR SIN CURSOR (modo ahorro de tokens)

La dev trabaja con Cursor pero actualmente sin créditos. El flujo es:

1. **IA analiza** el archivo desde GitHub o archivos subidos al chat
2. **IA genera** el archivo corregido completo
3. **Dev descarga** el archivo y lo reemplaza en local
4. **Dev pushea** con `git add "ruta/archivo.tsx"` + `git commit -m "..."` + `git push`
5. **Vercel despliega** automáticamente desde el repo de la clienta (`katia2807/proyecto-katia1`)

### Comandos frecuentes (PowerShell — Windows)
```powershell
# Agregar archivo con paréntesis en la ruta (SIEMPRE con comillas)
git add "app/(dashboard)/gerencial/page.tsx"

# Push normal
git add .
git commit -m "descripción"
git push
```

⚠️ **En PowerShell los paréntesis rompen el comando** — siempre usar comillas en rutas con `(dashboard)`.

---

## 14. ARQUITECTURA DE INFORMACIÓN (sidebar reorganizado en v1.0)

```
OPERACIÓN DIARIA
  → Centro de Mando  (/  ← dashboard principal)
  → Caja             (/caja)
  → Ventas           (/ventas + subpáginas)
  → Cotizaciones     (/cotizacion)

CATÁLOGO
  → Inventario       (/inventario)
  → Clientes         (/ventas/clientes)

ANÁLISIS
  → Reportes         (/reportes)
  → Bitácora         (/registro)
  → Panel Gerencial  (/gerencial)

CONFIGURACIÓN
  → Configuración    (/configuracion)
  → Admin            (/admin/*)
  → Ayuda            (/ayuda)
```

---

## 15. FUNCIONES SERVER ACTIONS CLAVE (`app/actions.ts`)

```typescript
// Clientes
createCliente(formData)
updateClienteEstado(formData)           // cambia estado activo/inactivo/moroso
deleteCliente(formData)                 // requiere estado !== 'activo' y sin deps
forzarEliminarClienteCompleto(formData) // owner_admin: elimina en cascada

// Cotizaciones
submitCreateCotizacionForm(input)
submitAprobarCotizacionForm(formData)
deleteCotizacionUnificada(formData)
deleteCotizacionMueblePersonalizada(formData)

// Caja
createCajaMovimiento(formData)
repetirGastosMesAnterior(formData)

// Inventario
deleteInventarioProducto(formData)
deleteInventarioMovimiento(formData)

// Personal
createEmpleado(formData)
createAdelanto(formData)
createSueldo(formData)

// Admin
eliminarDatosSistema(formData)
eliminarDatosPorCategoria(formData)
```

---

## 16. CONVENCIONES DEL CÓDIGO

- **Server Components por defecto** — solo `"use client"` cuando se necesita estado o eventos
- **`DEFAULT_ORG_ID`** = `"00000000-0000-0000-0000-000000000001"` — siempre filtrar por org
- **`hasSupabaseEnv()`** — verificar antes de queries; si es false, usar demo-store
- **`getSupabaseServerClient()`** — cliente server para mutaciones
- **`requireMutationAccess(roles[])`** — guard de acceso en cada server action
- **`revalidatePath("/ruta")`** — siempre al final de cada mutación exitosa
- **Tailwind + CSS vars**: nunca hardcodear colores, usar `var(--katia-*)` o clases Tailwind mapeadas

---

## 17. CONTEXTO DE NEGOCIO (para entender el dominio)

La empresa vende y produce:
- **Muebles terminados**: muebles listos para venta directa
- **Muebles personalizados**: a medida con orden de producción
- **Madera cortada**: venta de madera por m³/pies/piezas
- **Servicios de aserradero**: corte, cepillado, servicio a terceros
- **Alquiler de Mixer**: alquiler de mezcladora de concreto con chofer

Términos del negocio:
- **Cotización** = documento interno privado (NO factura fiscal, sin SUNAT)
- **Orden de producción** = pedido de mueble en fabricación
- **Caja** = movimientos de dinero de la empresa (no contabilidad formal)
- **Panel Gerencial** = vista ejecutiva para decisiones del dueño

---

## 18. ESTADO DEL PLAN DE CIERRE (Cursor plan v1.0)

El plan tenía 8 olas (0 a 7). Todas marcadas como **completed** en `.cursor/plans/cierre_katia_suite_9ac334ad.plan.md`.

Lo que Cursor implementó en el último refactor:
- Rebrand a "Katia Suite"
- Sistema de diseño con tokens `--katia-*`
- Centro de Mando con sub-pestañas (Hoy, Pasado, Futuro, Clientes 360, Herramientas)
- Notificación bell en header
- Toggle tema oscuro/claro
- Onboarding tour
- Sentry integrado
- Health check endpoint
- Páginas 404, error, legal
- Audit logs, notifications (tablas + migraciones)
- Códigos de producto automáticos
- Sugerencia de precios por historial
- Excel bidireccional mejorado
- Soft delete global
- RPCs atómicos para venta/cotización/stock

---

## 19. NOTAS IMPORTANTES PARA LA IA QUE LEE ESTO

1. **El repo activo es `katia2807/proyecto-katia1`** — el de Txnit es espejo. Deploy se hace desde el de la clienta.

2. **`app/actions.ts` es un archivo monolítico de ~4000 líneas** — tener cuidado al editar, los str_replace deben ser muy precisos para no romper código adyacente. Ya hubo un merge que mezcló funciones (corregido en esta sesión).

3. **Las migraciones del repo pueden no estar aplicadas en Supabase** — siempre verificar en el SQL Editor de Supabase antes de asumir que una tabla/columna existe.

4. **PowerShell en Windows** — las rutas con paréntesis como `app/(dashboard)/` necesitan comillas en los comandos git.

5. **Sin Cursor disponible** — la dev trabaja subiendo archivos al chat y aplicando cambios manualmente. Generar siempre archivos completos y listos para reemplazar.

6. **Tema visual**: el sistema usa `data-theme="dark"/"light"` en el `<html>`. Los componentes deben usar `var(--katia-*)` o las variables equivalentes definidas en `globals.css`. Nunca colores hardcoded como `bg-amber-50` (no funciona en tema oscuro).

7. **`forzarEliminarClienteCompleto`** es una acción nueva (16/05/2026) que elimina en cascada para `owner_admin`. Requiere escribir "ELIMINAR TODO" en el campo de confirmación.

8. **El `select` de estado en el gerencial** usa un componente cliente (`cliente-estado-form.tsx`) porque en Server Components el `defaultValue` de HTML nativo no funciona para pre-seleccionar opciones.
