# Despliegue 24/7 - ERP Proyecto Katia

Esta app debe correr como servicio privado con HTTPS, variables reales y backups
verificados. No expongas el puerto interno de Next.js directamente a internet.

## Requisitos

- Node.js 20+ o Docker.
- Supabase configurado y migraciones aplicadas.
- Dominio con HTTPS detrás de Nginx, Caddy o proxy equivalente.
- `.env.local` solo en el servidor, nunca dentro del repositorio público.

## Variables obligatorias

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ERP_ORG_ID=
ANTIFRAUD_ACCESS_CODE=
LOCAL_AUTH_ENABLED=true
```

Si `LOCAL_LOGIN_EMAIL` y `LOCAL_LOGIN_PASSWORD` quedan vacíos, el primer acceso
se inicializa como `katia` / `katia 2026`. Cambia esa contraseña desde
`Cuenta admin` antes de entregar el servidor.

## Opcion A: Docker

```bash
docker build -t erp-katia:latest .
docker run -d \
  --name erp-katia \
  --restart unless-stopped \
  --env-file .env.local \
  -p 3000:3000 \
  erp-katia:latest
```

Verifica salud:

```bash
curl http://127.0.0.1:3000/api/health
```

## Opcion B: Node directo

```bash
npm ci
npm run build
npm run start
```

En Linux, ejecuta el proceso con `systemd`, PM2 o el supervisor del proveedor.
El proxy publico debe apuntar a `http://127.0.0.1:3000`.

## Checklist antes de entregar

```bash
npm run ops:checklist
npm run lint
npm run typecheck
npm run build
npm run e2e
```

Luego valida:

- Migraciones de `supabase/migrations` aplicadas.
- Usuario owner/gerencia creado en Supabase Auth y tabla `perfiles`.
- Backups diarios de Supabase habilitados.
- Restauracion de prueba documentada.
- Acceso al servidor limitado a HTTPS.
- Endpoint `/api/health` monitoreado por el servidor o proveedor.
- Contraseña inicial cambiada desde `Cuenta admin`.
