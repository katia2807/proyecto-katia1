# Proyecto Katia — Notas internas (técnico-empresarial)

Documento para el equipo de desarrollo y socios que coordinan alcance comercial. No sustituye contratos con el cliente.

---

## Resumen del negocio y cliente objetivo

El producto es un **ERP web** orientado a un negocio maderero y de servicios relacionados: venta de **madera cortada** (pie tablar), **servicios de aserradero**, **alquiler de mixer**, **muebles terminados** y **cotizaciones** unificadas, más **caja**, **inventario**, **clientes** y **personal** operativo. El cliente objetivo es la operación diaria de la empresa (dueña, gerencia, ventas, caja, operaciones), con roles que limitan qué pantallas y acciones ve cada perfil.

---

## Stack tecnológico (proyecto real)

| Área | Tecnología |
|------|------------|
| Framework | **Next.js** 16 (App Router) |
| UI | **React** 19, **TypeScript** |
| Estilos | **Tailwind CSS** 4 (`@tailwindcss/postcss`) |
| Datos / auth | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — en varios flujos aún coexisten **mocks** o almacenamiento demo |
| Validación | **Zod** |
| Fechas | **date-fns** |
| Exportes Excel | **Exceljs** |
| Iconos | **lucide-react** |
| Calidad | **ESLint** (config Next), **Playwright** (`npm run e2e`) |

Scripts relevantes: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run e2e`. Despliegue tipo **standalone** vía `postbuild` (`scripts/prepare-standalone.mjs`).

---

## Módulos activos en V1 y cómo están implementados

La **navegación lateral** se arma desde `lib/constants.ts` (`navItems`) y se filtra por rol en `lib/permissions.ts` (`buildNavHrefAllowlist`). El layout del dashboard envuelve las páginas en `components/app-shell.tsx`.

| Módulo (negocio) | Rutas / piezas principales |
|------------------|----------------------------|
| Login | `app/(auth)/login`, acciones en `app/(auth)/actions` |
| Dashboard / inicio | `app/(dashboard)/page.tsx` |
| Caja | `app/(dashboard)/caja/page.tsx` |
| Ventas (hub + submódulos) | `app/(dashboard)/ventas/page.tsx`; clientes `ventas/clientes`, madera cortada `ventas/madera-cortada`, aserradero `ventas/aserradero-servicios`, mixer `ventas/alquiler-mixer`, muebles terminados `ventas/muebles-terminados`, personalizados `ventas/muebles-personalizados` |
| Inventario | `app/(dashboard)/inventario/page.tsx` |
| Cotización (incl. unificada) | `app/(dashboard)/cotizacion/page.tsx`; wizard en `components/cotizacion-unificada-wizard.tsx`; PDF unificada `cotizacion/unificada/[id]/pdf` |
| Registro (operación / notas) | `app/(dashboard)/registro/page.tsx` |
| Personal (“Equipo” en menú) | `app/(dashboard)/personal/page.tsx` |
| Reportes | `app/(dashboard)/reportes/page.tsx` (incluye UI de cierre de mes según permisos) |
| Admin (usuarios, empresa, etc.) | `admin/usuarios`, `admin/empresa`, etc. |

La **lógica de negocio** y lecturas agregadas suelen vivir en `lib/data.ts`, `app/actions.ts` (server actions) y APIs bajo `app/api/`.

---

## Módulos “ocultos” o fuera del alcance comercial V1

**Estado actual:** no existe aún `lib/features.ts`. La visibilidad es **por lista de `navItems` + allowlist por rol** (`buildNavHrefAllowlist`). Algunas pantallas (importar, respaldo, antifraude, Kanban) **ya existen en código** pero el documento comercial V1 puede tratarlas como **no incluidas**; para alinear menú y contrato habrá que introducir **flags de producto**.

**Plan recomendado:** crear `lib/features.ts` con constantes booleanas (o lectura de env) por módulo premium, y hacer que el menú y enlaces internos respeten esos flags además del rol.

**Precios orientativos de activación** (referencia comercial interna; ajustar según acuerdo):

| Paquete / módulo | Precio sugerido (PEN) |
|------------------|----------------------:|
| Muebles personalizados Kanban | 300 |
| Cierre de mes + antifraude | 200 |
| Nómina completa | 200 |
| Importación + respaldo | 150 |

---

## Sistema de autocompletado (Combobox y mocks)

### `components/ui/Combobox.tsx`

Componente cliente (**“combobox”**): combina campo de texto con lista desplegable. El usuario **escribe para filtrar** opciones (`label` / `sublabel`); al elegir una fila se confirma el `value` y se notifica vía `onChange`. Incluye accesibilidad básica (`inputAriaLabel`) y opción de `hiddenInputName` para envío clásico de formularios.

### `mockData` y `lib/combobox-mocks.ts`

Muchos formularios reciben la prop **`mockData`**. Si es `true`, las listas (clientes, productos, choferes, categorías, etc.) se alimentan desde **`lib/combobox-mocks.ts`** en lugar de los datos que vendrían del servidor/Supabase. Sirve para **desarrollo y demos** sin base de datos completa.

### Variable `NEXT_PUBLIC_COMBOBOX_MOCK`

En varias páginas del dashboard se calcula algo equivalente a:

`process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true"`

y se pasa como `mockData` a los paneles o formularios. Con eso se activa el modo demo **sin tocar código**. Valores útiles: `1`, `true`, o ausente / otro valor para usar datos reales cuando el backend esté listo.

---

## Pendientes antes de entregar (checklist interno)

1. **Conectar Supabase** de forma consistente (reemplazar o reducir dependencia de mocks / demo store donde corresponda).
2. **Corregir hydration mismatch** en cotización unificada (`components/cotizacion-unificada-wizard.tsx` y datos que difieren servidor vs cliente).
3. **Crear `lib/features.ts`** para ocultar módulos no contratados en V1 y documentar variables de entorno asociadas.
4. **Tests E2E** de flujos críticos (`npm run e2e`; ej. `tests/e2e/critical-flow.spec.ts` y ampliar cobertura).

---

## Flujo de actualización para el socio no técnico

En la carpeta del proyecto, con Node.js instalado:

1. `git pull` — traer últimos cambios del repositorio.  
2. `npm install` — actualizar librerías si cambió `package.json`.  
3. `npm run dev` — levantar el servidor de desarrollo y probar en el navegador.

Para un entorno ya desplegado en servidor, el proveedor técnico debe ejecutar el flujo de build (`npm run build`) y el comando de arranque acordado (p. ej. `npm run start` / standalone), no solo `dev`.

---

## Glosario (términos de negocio en código)

| Término | Uso en el proyecto |
|---------|-------------------|
| **Cubicaje** | Volumen de madera en pies cúbicos; usado en servicios de aserradero y costeo (`piesCubicos`, `costoCubicaje`, etc.). |
| **Correlativo** | Número o código legible consecutivo por tipo de documento (cotización, venta madera, orden de producción, servicio aserradero…). Lógica en `lib/numeracion.ts`; en producción puede apoyarse en RPC Supabase `next_correlativo_valor`. |
| **Kardex** | Movimiento de inventario en el tiempo (entradas/salidas); en `lib/data.ts` se construye una vista tipo kardex a partir de movimientos. |
| **Pie tablar / PT** | Unidad de volumen de madera dimensionada (cálculo habitual: dimensiones en pulgadas relacionadas con 144). Aparece en madera cortada y cotizadores. |
| **Despiece** | Desglose por piezas/medidas para calcular PT o costos de madera. |
| **Tabla / listón / cuartón / poste** | Tipos de corte o pieza en esquemas de venta y conversión (`tipoPieza`, `tipoCorte` en validaciones). |
| **Orden de producción** | Orden generada a partir de cotización aprobada (muebles personalizados / flujo productivo). |
| **Org / `DEFAULT_ORG_ID`** | Identificador de organización por defecto en demo y datos multi-tenant (`lib/constants.ts`). |
| **`mockData` / combobox mocks** | Datos de relleno para UI y pruebas sin BD completa (`lib/combobox-mocks.ts`). |

---

*Última revisión alineada al repositorio local; actualizar este archivo cuando cambie el stack o el alcance comercial.*
