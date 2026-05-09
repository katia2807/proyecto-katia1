# ERP Proyecto Katia

Aplicación ERP privada para operación real:

- Caja chica
- Ventas y aserradero
- Muebles personalizados y servicio de corte
- Alquiler de maquinaria
- Gestión de personal
- Reportes gerenciales con cierre mensual inmutable

## Ejecución rápida

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Modo producción (recomendado para entrega)

1. Copia `.env.example` a `.env.local`.
2. Completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ERP_ORG_ID`
   - `ANTIFRAUD_ACCESS_CODE`
3. Ejecuta migraciones de `supabase/migrations`.
4. Ejecuta `npm run build` y luego `npm run start`.

### Acceso administrador local

El producto incluye un acceso administrador local inicial para operar sin depender
de restablecimientos públicos:

```bash
usuario: katia
contraseña: katia 2026
```

Después de iniciar sesión, entra a `Cuenta admin` para cambiar usuario, nombre
visible y contraseña. No existe restablecimiento público: si no se inicia sesión,
no se puede cambiar la contraseña desde la web.

## Checklist de entrega

Antes de entregar o desplegar:

```bash
npm run ops:checklist
npm run lint
npm run typecheck
npm run build
```

Además, valida que las migraciones nuevas estén aplicadas en Supabase y que
exista un usuario inicial con el rol correcto.

## Despliegue privado 24/7

- Servidor Linux/Windows privado con HTTPS.
- Correr la app con `npm run start` detrás de Nginx/Caddy.
- Restringir acceso a puerto interno, exponer solo dominio con SSL.
- Guardar `.env.local` solo en servidor (no subir claves al repositorio).
- Para Docker o servicio permanente, sigue `docs/DEPLOY_24_7.md`.
- Monitoreo básico disponible en `/api/health`.

## Validación

```bash
npm run lint
npm run typecheck
npm run build
npm run e2e
```
