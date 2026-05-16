# Deploy Checklist — Katia Suite v1.0.0

## Pre-deploy (staging)

### Variables de entorno (Vercel)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] `ERP_ORG_ID` configurada (UUID de la organización)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` configurada (opcional pero recomendado)
- [ ] `ANTIFRAUD_ACCESS_CODE` configurada

### Base de datos (Supabase)
- [ ] Ejecutar todas las migraciones en orden (`supabase db push`)
- [ ] Verificar que no hay errores en migración
- [ ] Confirmar que RLS está activado en todas las tablas críticas
- [ ] Crear usuario owner_admin en Supabase Auth + insertar en `perfiles`
- [ ] Verificar que `health` endpoint responde con `supabaseConfigured: true`

### Migraciones (en orden)
```bash
supabase db push
```
Archivos críticos (verificar que se aplicaron):
- `20260516_001_fix_estado_columna.sql` (o equivalente)
- `20260516_002_add_deleted_at_global.sql`
- `20260516_003_add_indices_criticos.sql`
- `20260516_004_add_constraints_integridad.sql`
- `20260516_005_codigos_familiares_productos.sql`
- `20260516_006_feature_flags_table.sql`
- `20260517_001_audit_logs_table.sql`
- `20260517_002_notifications_table.sql`
- `20260517_003_rls_policies_review.sql`
- `20260517_004_user_preferences_table.sql`
- `20260519_001_rpc_cerrar_venta_atomic.sql`
- `20260519_002_rpc_stock_concurrencia.sql`
- `20260519_003_rpc_confirmar_cotizacion_atomic.sql`
- `20260520_001_reset_entrega_limpia.sql`

## Deploy a staging

```bash
# Vercel deploy preview (automático con push a branch)
git push origin main
# O manual:
vercel --env .env.local
```

## Smoke test en staging

- [ ] `/api/health` retorna `ok: true`
- [ ] Login con owner_admin funciona
- [ ] Centro de Mando carga sin error
- [ ] Crear un cliente desde `/ventas/clientes`
- [ ] Agregar un producto desde `/inventario`
- [ ] Crear una cotización desde `/cotizacion`
- [ ] Registrar un movimiento de caja desde `/caja`
- [ ] Exportar Excel desde `/reportes`
- [ ] Cambiar tema claro/oscuro
- [ ] Tour de bienvenida aparece (limpiar localStorage primero)
- [ ] Notificaciones cargan
- [ ] Búsqueda global funciona

## Deploy a producción

```bash
# Promote staging a producción en Vercel dashboard
# O:
vercel --prod
```

## Smoke test en producción

- [ ] Repetir los mismos pasos de smoke test
- [ ] Verificar que Sentry captura errores (lanzar uno a propósito)
- [ ] Verificar que el health check en Vercel/UptimeRobot funciona

## Entrega al cliente

- [ ] Ejecutar "Reset datos para entrega limpia" desde `/admin/respaldo` (via RPC `reset_datos_operativos`)
- [ ] Cargar datos seed de bienvenida via RPC `seed_datos_bienvenida`
- [ ] Verificar que el tour de bienvenida aparece en el primer login del cliente
- [ ] Entregar credenciales al cliente (email + contraseña temporal)
- [ ] Entregar `CHANGELOG_v1.0.md` al cliente
- [ ] Agendar sesión de capacitación de 30-45 min

---

## Plan de rollback

Si algo sale mal en producción:

### Opción 1: Revertir deploy en Vercel
1. Ir a Vercel Dashboard → Deployments
2. Click en el último deployment estable
3. Click "Promote to Production"

### Opción 2: Revertir migraciones de BD
```sql
-- Ejecutar los archivos down.sql correspondientes en Supabase SQL Editor
-- (revisar cada migración para su reverso)
```

### Opción 3: Rollback de código
```bash
git log --oneline -10  # Ver los últimos commits
git revert HEAD        # Revertir el último commit
git push origin main   # Push para triggear nuevo deploy
```

### Contacto de emergencia
- Supabase Dashboard: https://app.supabase.com
- Vercel Dashboard: https://vercel.com/dashboard
- Sentry: revisar errores en tiempo real

---

*Documento preparado para entrega del 26 de mayo 2026*
