# Katia Suite v1.0

Sistema de gestión privado para ventas, inventario, caja, cotizaciones y reportes.
Diseñado para negocios de madera, muebles y servicios relacionados.

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy**: Vercel (producción) · Docker (opcional)
- **UI**: Glassmorphism, tema oscuro/claro, Geist font, Recharts

## Requisitos previos

- Node.js 20+
- Cuenta en Supabase
- Cuenta en Vercel (para deploy)

## Configuración local

```bash
# 1. Clonar e instalar
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 3. Aplicar migraciones
supabase login
supabase link
supabase db push

# 4. Desarrollo
npm run dev
```

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ERP_ORG_ID=...
```

## Comandos disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run start      # Iniciar build de producción
npm run lint       # Verificar ESLint
npm run typecheck  # Verificar TypeScript
npm run e2e        # Tests Playwright
npm run db:push    # Aplicar migraciones a Supabase
npm run db:status  # Ver estado de migraciones
```

## Estructura del proyecto

```
app/
  (auth)/          # Login, recuperar contraseña
  (dashboard)/     # Módulos principales (requiere autenticación)
    page.tsx         # Inicio / Resumen operativo
    gerencial/       # Centro de Mando (dueño)
    ventas/          # Ventas y clientes
    inventario/      # Catálogo de productos
    caja/            # Movimientos de caja
    cotizacion/      # Cotizaciones
    reportes/        # Reportes y análisis
    admin/           # Administración
components/          # Componentes React reutilizables
lib/                 # Lógica de negocio, acceso a datos
supabase/
  migrations/        # Migraciones SQL versionadas
docs/                # Documentación del proyecto
```

## Módulos disponibles

| Módulo           | Ruta              | Descripción                           |
|------------------|-------------------|---------------------------------------|
| Inicio           | `/`               | Resumen operativo del día             |
| Caja             | `/caja`           | Movimientos y cierre de caja          |
| Ventas           | `/ventas`         | Todos los tipos de venta              |
| Clientes         | `/ventas/clientes`| Gestión de clientes                   |
| Inventario       | `/inventario`     | Catálogo de productos y stock         |
| Cotizaciones     | `/cotizacion`     | Cotizaciones unificadas               |
| Centro de Mando  | `/gerencial`      | Panel ejecutivo del dueño             |
| Reportes         | `/reportes`       | Reportes y análisis                   |
| Empresa          | `/admin/empresa`  | Configuración de la empresa           |
| Usuarios         | `/admin/usuarios` | Gestión de usuarios y roles           |
| Respaldo         | `/admin/respaldo` | Respaldo y exportación de datos       |

## Checklist de entrega

```bash
npm run lint
npm run typecheck
npm run build
npm run e2e
```

Ver `docs/DEPLOY_24_7.md` para instrucciones de deploy en producción.
