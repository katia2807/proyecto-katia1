# PROYECTO.md — Guía del ERP Katia

Documento de referencia para administrar, mantener y desplegar este sistema. Útil para humanos y para asistentes de IA que trabajen en el repositorio.

---

## 1. Stack y arquitectura

### Tecnologías principales

| Tecnología | Uso en este proyecto |
|------------|----------------------|
| **Next.js 16** (App Router, `output: "standalone"`) | Frontend y backend en un solo repo: páginas React Server Components, Route Handlers (`app/api`), Server Actions (`app/actions.ts`). |
| **React 19** | UI interactiva (client components donde haga falta `"use client"`). |
| **TypeScript** | Tipado estricto; tipos de BD parciales en `lib/supabase/types.ts`. |
| **Tailwind CSS 4** | Estilos utility-first (`@tailwindcss/postcss`). |
| **Supabase** | Postgres (datos), Auth (usuarios/sesión), Storage (archivos: comprobantes, fotos, logos de empresa). |
| **Zod** | Validación de payloads (cotizaciones unificadas, formularios críticos). |
| **Supabase JS + `@supabase/ssr`** | Cliente servidor con cookies para sesión; service role solo en servidor para operaciones privilegiadas. |
| **ExcelJS** | Exportación Excel en APIs de reportes. |
| **Playwright** | Pruebas E2E opcionales (`npm run e2e`). |

### Cómo encajan Vercel, Supabase y GitHub

1. **GitHub** aloja el código; cada push a la rama conectada dispara un deploy en **Vercel** (u otro host compatible con Next.js).
2. **Vercel** ejecuta `npm run build`; el proyecto está configurado con **`output: "standalone"`** para servir con Node (`npm run start` → `node .next/standalone/server.js`).
3. **Supabase** es independiente: la base Postgres, Auth y Storage viven en el proyecto Supabase. La app solo necesita las **variables de entorno** correctas (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`).
4. Las **migraciones SQL** viven en `supabase/migrations/` y se aplican contra el proyecto Supabase (CLI o SQL Editor), no contra Vercel directamente.

**Flujo mental:** código en GitHub → build en Vercel → app en runtime llama a Supabase por HTTPS usando las keys configuradas.

---

## 2. Estructura del proyecto

```
proyecto-katia/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login, acciones de sesión
│   ├── (dashboard)/              # UI principal autenticada (caja, ventas, cotización, admin…)
│   ├── api/                      # Route Handlers (health, export Excel, uploads, respaldo)
│   ├── actions.ts                # Server Actions centralizadas (mutaciones de negocio)
│   └── layout.tsx / globals.css  # Raíz de la app
├── components/                   # Componentes React reutilizables
│   ├── admin/, sales/, ui/       # Por dominio
│   └── context-action-panel.tsx  # Paneles modales/drawer (cliente)
├── lib/                          # Lógica compartida sin UI
│   ├── auth.ts                   # Sesión, roles, requireAuthContext
│   ├── permissions.ts            # Reglas de quién puede qué (caja, ventas, RRHH…)
│   ├── data.ts                   # Lecturas Supabase / fallback demo local
│   ├── company-config.ts         # Datos de empresa (PDFs, cotizaciones)
│   ├── numeracion.ts             # Correlativos (cotización, órdenes…)
│   ├── demo-store.ts             # Store en archivo cuando no hay Supabase (desarrollo)
│   ├── constants.ts              # navItems, DEFAULT_ORG_ID
│   └── supabase/                 # Clientes server, tipos, credenciales
├── supabase/migrations/          # Historial de cambios de esquema (orden cronológico)
├── scripts/                      # Utilidades (standalone post-build, bootstrap usuario, checklist ops)
├── tests/e2e/                    # Playwright
├── public/                       # Estáticos
├── next.config.ts                # standalone, allowedDevOrigins
├── package.json
├── .env.example                  # Plantilla de variables
└── AGENTS.md / CLAUDE.md         # Reglas para agentes (Next “no canónico”: ver docs en node_modules)
```

### Dónde está la lógica de negocio principal

| Área | Ubicación típica |
|------|------------------|
| Mutaciones (crear venta, movimiento caja, cotización…) | `app/actions.ts` (Server Actions) |
| Lecturas listados / agregados | `lib/data.ts` + funciones en `lib/*.ts` |
| Permisos por rol | `lib/permissions.ts` + comprobaciones en acciones con `requireAuthContext` / roles |
| Correlativos y numeración | `lib/numeracion.ts`, tabla `correlativos` |
| Config PDF / empresa | `lib/company-config.ts`, tabla `configuracion_empresa` |
| UI compleja por módulo | `components/cotizacion-unificada-wizard.tsx`, `ventas/*`, etc. |

**Importante:** Si no hay variables Supabase completas, parte del sistema usa **`lib/demo-store.ts`** (persistencia local en disco para desarrollo). En producción debe usarse Supabase.

---

## 3. Comandos importantes

### Desarrollo local

```bash
npm install
# Copiar .env.example → .env.local y completar (ver sección 5)
npm run dev
```

La app suele estar en `http://localhost:3000`. Si el puerto está ocupado, liberar el proceso o usar el puerto alternativo que indique Next.

**Credenciales opcionales en desarrollo:** existe cookie de login local para `NODE_ENV=development` (ver `lib/auth.ts`). No usar en producción.

Otros comandos útiles:

```bash
npm run typecheck    # TypeScript sin emitir
npm run lint         # ESLint
npm run build        # Build producción (+ postbuild standalone)
npm run start        # Tras build: servidor standalone
```

### Deploy (ej. Vercel)

1. Repositorio conectado a Vercel (o push a rama de producción).
2. **Variables de entorno** configuradas en el panel del proyecto (ver sección 5).
3. Comando de build por defecto: `npm run build` (el `postbuild` prepara `standalone`).
4. Tras deploy: comprobar URL, login, una ruta crítica (caja o cotización).

Si usas otro host con Docker/Node, sirve el artefacto **standalone** según la documentación de Next.js.

### Migraciones de base de datos

Las migraciones están en `supabase/migrations/*.sql` con prefijo de fecha.

```bash
# CLI Supabase (requiere login y proyecto enlazado)
npm run db:login
npm run db:link    # una vez por máquina/proyecto
npm run db:push    # aplica migraciones pendientes al proyecto enlazado
npm run db:status  # lista estado de migraciones
```

También puedes ejecutar el SQL manualmente en **Supabase Dashboard → SQL Editor** (útil para revisiones), pero el equipo debe mantener los archivos en `migrations/` como fuente de verdad.

### Crear usuario nuevo

1. **Supabase Auth:** crear usuario en Authentication (o invitación por email según configuración del proyecto).
2. **Tabla `perfiles`:** debe existir una fila con `user_id`, `organization_id`, `role` (enum de app) y opcionalmente `ui_role` (owner_admin / operaciones / readonly).
3. Script de ayuda (requiere `temp/supabase.temp.txt` o env con service role):  
   `npm run bootstrap:login-user` — crea usuario admin temporal y escribe credenciales en un archivo bajo `temp/` (revisar salida del script).

Para usuarios de producción, el flujo típico es: crear en Auth + insertar/actualizar `perfiles` con el rol correcto.

---

## 4. Base de datos

### Tablas principales (público)

Resumen por dominio; nombres exactos en migraciones.

| Tabla | Propósito |
|-------|-----------|
| **organizations** | Organización / tenant (multi-tenant preparado; uso típico un org). |
| **perfiles** | Vincula `auth.users` con `organization_id`, `role` (AppRole), `ui_role`, nombre. |
| **audit_log** | Registro de auditoría. |
| **clientes** | Clientes del taller. |
| **proveedores** | Proveedores de madera/insumos. |
| **productos_madera** | Catálogo legacy madera (contexto ventas madera). |
| **ventas_madera** / **ventas_madera_lineas** | Ventas de madera (flujo clásico). |
| **cotizaciones_mueble** | Cotizaciones mueble personalizado (legacy). |
| **cotizacion_cortes** | Cortes asociados a cotización. |
| **cotizaciones_unificadas** | Cotización unificada (asistente actual): cliente, total, detalle JSON, flujo producción/cobro. |
| **ordenes_produccion** | Órdenes de producción ligadas a cotizaciones. |
| **alquileres** | Contratos alquiler Bomba Mixer. |
| **movimientos_caja** | Ingresos/egresos caja (incl. personales `es_personal`). |
| **empleados** / **adelantos** / **sueldos** / **periodos_nomina** | RRHH y nómina. |
| **alertas_operativas** | Alertas operativas. |
| **cierres_mensuales** | Cierres contables mensuales (inmutable tras confirmación). |
| **compras_madera** | Compras a proveedores. |
| **inventario_productos** / **inventario_movimientos** | Stock y kardex. |
| **registro_categorias** / **registros_generales** | Registro general por categoría. |
| **correlativos** | Numeración por tipo y año. |
| **muebles_catalogo** / **ventas_mueble_terminado** | Catálogo terminados y ventas. |
| **servicios_aserradero** | Servicios aserradero (cubicaje, líneas JSON). |
| **ventas_madera_cortada** | Ventas por pie tablar. |
| **choferes** / **zonas_entrega** | Logística de entrega. |
| **configuracion_empresa** | Nombre, RUC, datos legales PDF; **logo_url** (Storage). |

Además: **Storage** (bucket `empresa-logos`, etc.) para archivos; políticas en `storage.objects`.

### Cómo agregar una migración nueva

1. Crear archivo `supabase/migrations/YYYYMMDDHHMMSS_nombre_descriptivo.sql`.
2. Usar `IF NOT EXISTS` / `IF EXISTS` cuando sea posible para idempotencia en replays.
3. Si añades tabla con datos sensibles: **activar RLS** y políticas al estilo `organization_id = app.current_org_id()` (ver migraciones existentes).
4. Probar en un proyecto Supabase de staging o local antes de producción.
5. Hacer commit del archivo y aplicar con `db:push` o pipeline acordado.

### Qué es RLS y por qué no desactivarlo

**RLS (Row Level Security)** en Postgres hace que cada fila solo sea visible/modificable según políticas. Este proyecto asume que los datos están **filtrados por organización** (y a menudo por rol vía funciones auxiliares como `app.current_org_id()`).

- **Desactivar RLS** en tablas de negocio expondría datos entre clientes u organizaciones si alguna vez hubo más de un tenant o si hay errores de consulta.
- Si “algo no carga”, la solución correcta es **ajustar políticas o el contexto de sesión**, no desactivar RLS en producción.

---

## 5. Variables de entorno

### Lista (referencia `.env.example`)

| Variable | Uso |
|----------|-----|
| **NEXT_PUBLIC_SUPABASE_URL** | URL del proyecto Supabase (público al cliente). |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Key anónima para cliente/server con sesión de usuario. |
| **SUPABASE_SERVICE_ROLE_KEY** | Key con privilegios; **solo servidor** (Server Actions, APIs que la usen). No exponer al navegador. |
| **ERP_ORG_ID** | UUID de organización por defecto (coincide con seed/migraciones si no se cambia). |
| **ANTIFRAUD_ACCESS_CODE** | Código extra para rutas sensibles de antifraude (si aplica en tu despliegue). |
| **E2E_*** | Solo tests Playwright (modo staging, URLs, credenciales de prueba). |

**Fallback local:** si faltan env, el código puede leer `temp/supabase.temp.txt` con el mismo formato KEY=VALUE (`lib/supabase/temp-credentials.ts`). Útil en dev; en producción usar siempre variables del hosting.

### Dónde configurarlas en Vercel

**Project → Settings → Environment Variables:** añadir cada clave para *Production* / *Preview* / *Development* según necesidad. Tras cambiar variables, **redeploy** para que tomen efecto.

### Si falta alguna variable

| Síntoma probable | Causa frecuente |
|------------------|----------------|
| Error al iniciar o “Falta configurar Supabase” | Sin URL/keys o sin service role en servidor. |
| Lecturas vacías / modo demo | `hasSupabaseEnv()` falso → uso de `demo-store` local. |
| Subidas o PDF con logo rotos | Bucket Storage no creado o `logo_url` incorrecta; políticas Storage. |
| Auth no persiste | Keys anon incorrectas o dominio del sitio no permitido en Supabase Auth. |

---

## 6. Roles y permisos

### Roles de base de datos (`perfiles.role`) — tipo `AppRole`

Incluyen: **`owner_admin`**, **`gerencia`**, **`operaciones_caja`**, **`ventas`**, **`rrhh`**, **`partner_readonly`**.

### Rol de UI (`perfiles.ui_role`)

Simplifica la experiencia: **`owner_admin`**, **`operaciones`**, **`readonly`**. Se mapea a roles legacy cuando hace falta (`lib/permissions.ts` → `mapUiRoleToDbRole`).

### Qué puede hacer cada uno (resumen)

- **owner_admin (UI):** acceso amplio; administración (`/admin/*`, cuenta, empresa, usuarios según implementación), cierre de mes, antifraude, seguridad.
- **operaciones (UI):** operación diaria (caja, ventas, inventario, RRHH según flags); se ocultan rutas muy sensibles (p. ej. antifraude, importar/respaldo, algunos admin).
- **readonly (UI):** lectura; sin mutación en caja/ventas según tablas de permisos.
- **Roles legacy** (`gerencia`, `ventas`, etc.): siguen siendo evaluados cuando `ui_role` es null.

Funciones clave en `lib/permissions.ts`: `canMutateVentas`, `canMutateCaja`, `canMutateRRHH`, `canMutateInventario`, `canCloseMonth`, `canAccessAntifraude`, `buildNavHrefAllowlist`.

### Cómo agregar un permiso nuevo

1. Definir la regla en **`lib/permissions.ts`** (idealmente una función `canXxx(role, uiRole)`).
2. Usarla en **Server Actions** (`app/actions.ts`) o en páginas servidor antes de mutar.
3. Opcional: filtrar navegación en **`buildNavHrefAllowlist`** o en la página concreta.
4. No confiar solo en ocultar botones en UI: **siempre validar en servidor**.

---

## 7. Módulos del negocio

### Visión por rutas principales

| Módulo | Ruta(s) típicas | Función |
|--------|-----------------|--------|
| Inicio | `/` | Resumen, accesos rápidos. |
| Caja | `/caja` | Movimientos, personales vs empresa. |
| Inventario | `/inventario` | Productos, movimientos, kardex, conteos. |
| Ventas (hub) | `/ventas` | Acceso a submódulos. |
| Muebles terminados | `/ventas/muebles-terminados` | Catálogo y ventas con entrega/pago. |
| Muebles personalizados | `/ventas/muebles-personalizados` | Cotizaciones clásicas + Kanban órdenes. |
| Madera cortada | `/ventas/madera-cortada` | PT, inventario opcional. |
| Aserradero | `/ventas/aserradero-servicios` | Cubicaje/servicios. |
| Alquiler mixer | `/ventas/alquiler-mixer` | Contratos y cierres. |
| Cotización unificada | `/cotizacion` | Asistente único (unificado). |
| Registro | `/registro` | Hechos categorizados. |
| Personal | `/personal` | Adelantos, sueldos, empleados. |
| Reportes | `/reportes`, `/reportes/antifraude` | Utilidad, exportaciones, cierre mensual. |
| Admin | `/admin/*` | Empresa, usuarios, importar, respaldo. |

### Cómo se conectan

- **Clientes** son referenciados por casi todos los módulos de venta y caja.
- **Cotización unificada** puede alimentar **órdenes de producción** y líneas que terminan en **caja** al cobrar.
- **Inventario** descuenta en ventas que declaran producto.
- **Correlativos** dan numeración visible (cotización, contratos, etc.).
- **configuracion_empresa** alimenta PDFs y textos legales.

### Flujo ejemplo: cotización → producción → cobro

1. Usuario arma **cotización unificada** (`/cotizacion`) → guardado en **`cotizaciones_unificadas`**.
2. Aprobación / paso a producción → **`ordenes_produccion`** (estados en Kanban en muebles personalizados u otros flujos).
3. Entrega o hitos → puede registrarse venta o movimiento según módulo.
4. **Cobro** → **`movimientos_caja`** (ingreso), modalidad contado/crédito/adelanto según pantalla.

Los detalle dependen del tipo de línea (mueble, aserradero, alquiler); revisar `app/actions.ts` y componentes del wizard.

---

## 8. Reglas para no romper nada

### Qué NO hacer

- **No pasar funciones de Server Components a Client Components como `children`** si esas funciones son Server Actions incrustadas en JSX que el cliente debe serializar. Solución: importar la acción en un archivo **`"use client"`** que envuelva el formulario (patrón usado en `*-context-panels.tsx`).
- **No exponer `SUPABASE_SERVICE_ROLE_KEY`** al cliente ni en repos públicos.
- **No desactivar RLS** en tablas de negocio para “arreglar rápido”.
- **No editar datos productivos** sin migración versionada cuando el cambio es de esquema.
- **No asumir la versión “clásica” de Next.js** sin revisar `node_modules/next/dist/docs/` (proyecto usa Next 16 con convenciones propias).

### Cómo agregar una función nueva correctamente

1. Si es mutación: preferir **Server Action** en `app/actions.ts` con validación y `requireAuthContext` / roles.
2. Si es lectura: función en **`lib/data.ts`** (o módulo dedicado) usando cliente Supabase con RLS o service role según política del proyecto.
3. Ejecutar **`npm run typecheck`** antes de commit.

### Cómo agregar una página nueva correctamente

1. Crear ruta bajo **`app/(dashboard)/.../page.tsx`** (o grupo que corresponda).
2. Proteger con **`requireAuthContext`** o layout que ya valide sesión.
3. Añadir entrada en **`lib/constants.ts`** (`navItems`) si debe aparecer en menú.
4. Añadir icono en **`components/app-shell.tsx`** si aplica.
5. Restringir por rol con **`buildNavHrefAllowlist`** / permisos si la ruta es sensible.

---

## 9. Errores comunes y soluciones

| Problema | Qué hacer |
|----------|-----------|
| **“Functions cannot be passed directly to Client Components”** | Formularios con `action={serverAction}` dentro de `ContextActionPanel` deben vivir en componente cliente que **importe** la acción desde `@/app/actions`. |
| **Typecheck falla por `.next/types/validator`** | Borrar carpeta **`.next`** y volver a `npm run build` o `npm run dev`. |
| **Turbopack / ENOENT en `.next/dev`** | Cerrar todos los `next dev`, borrar `.next`, reiniciar. Evitar borrar `.next` con el servidor en marcha en Windows. |
| **Build OK pero datos vacíos** | Revisar env Supabase; sin ellos puede activarse **demo-store**. |
| **Error de política RLS** | Revisar que el usuario tenga `perfiles` con `organization_id` correcto y políticas SQL. |
| **Puerto 3000 ocupado** | `netstat -ano \| findstr :3000` → `taskkill /PID … /F` (Windows). |

### Si el deploy falla

1. Ver log de build en Vercel (errores TypeScript, ESLint, dependencias).
2. Confirmar **variables de entorno** en el entorno que falla (Preview vs Production).
3. Reproducir localmente: `npm run build`.

### Si la base de datos da error

1. **Supabase Dashboard → Logs / Postgres** para el mensaje exacto.
2. Verificar migraciones aplicadas vs repo (`db:status`).
3. No desactivar RLS; revisar función `app.current_org_id()` y sesión.

---

## 10. Checklist de deploy

1. [ ] `npm run typecheck` y `npm run lint` sin errores bloqueantes.
2. [ ] `npm run build` local exitoso (opcional pero recomendado).
3. [ ] Migraciones nuevas aplicadas en Supabase de **staging** y luego **producción**.
4. [ ] Variables de entorno actualizadas en Vercel (o host).
5. [ ] Merge/push a la rama que dispara deploy.
6. [ ] Esperar build verde en el panel del hosting.
7. [ ] Verificación manual: login, **una lectura** (inicio/reportes) y **una mutación** (caja o cotización).
8. [ ] Probar export o PDF si el cambio los tocaba.

### Cómo verificar que el deploy fue exitoso

- Estado **Ready** en el dashboard del deploy.
- Respuesta **200** en `/` y `/login`.
- Sin errores en **runtime logs** del hosting en los primeros minutos.

---

## Referencias rápidas para IAs

- Reglas Next específicas: **`AGENTS.md`** + documentación en `node_modules/next/dist/docs/`.
- Tipos de BD (parcial): **`lib/supabase/types.ts`**.
- Navegación y org por defecto: **`lib/constants.ts`**.
- Acciones masivas: **`app/actions.ts`** (archivo grande; buscar por nombre de dominio).

*Última orientación: ante cambios de esquema, el archivo SQL en `supabase/migrations/` es la fuente de verdad junto con las políticas RLS.*
