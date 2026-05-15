Preparación para commit y pruebas - proyecto-katia

Archivos modificados:
- app/actions.ts
- app/(dashboard)/gerencial/page.tsx

Commit sugerido:
1) Revisa cambios:
   git status
   git add app/actions.ts app/(dashboard)/gerencial/page.tsx
   git commit -m "Fix: deleteCliente redirects when blocked; fix createCajaMovimiento parsing; gerencial shows dependency guidance"
   git push origin main

Probar localmente (modo desarrollo):
1) Instala dependencias:
   npm ci
2) Levanta servidor dev:
   npm run dev
3) Abre: http://localhost:3000/gerencial
   - Selecciona un cliente.
   - Para probar eliminación en modo demo (sin Supabase), asegúrate de que `hasSupabaseEnv()` devuelva false. El proyecto soporta modo demo si no hay credenciales de supabase.
   - Si quieres probar con la base real, exporta las credenciales (consulta `katia.demo.env.sample`) y reinicia el servidor.

Probar build (modo producción):
1) Instala y compila:
   npm ci
   npm run build
2) Si `npm run build` completa sin errores, puedes probar con:
   npm start

Pruebas específicas para `deleteCliente`:
- Escenario demo (sin Supabase):
  - Si no hay credenciales, `deleteCliente` usará funciones de `demo-store`. Prueba eliminar un cliente demo y verifica que la UI se actualice y no falle.
- Escenario Supabase:
  - Asegúrate de exportar las variables usadas por `getServerSupabaseCredentials()` (URL, anonKey, serviceRoleKey).
  - Intenta eliminar un cliente con estado `activo` → debería redirigirte con mensaje indicando que primero lo desactives.
  - Intenta eliminar un cliente con registros relacionados → la acción redirigirá a `/gerencial?cliente=<id>&mensaje=...` y la página mostrará el banner con la explicación.

Comandos útiles:
```bash
# Añadir & commitear cambios
git add app/actions.ts app/(dashboard)/gerencial/page.tsx
git commit -m "Fix: deleteCliente redirects when blocked; fix createCajaMovimiento parsing; gerencial shows dependency guidance"
# Subir
git push origin main

# Build local
npm ci
npm run build

# Dev
npm run dev
```

Notas:
- Si la build falla en Vercel por diferencias de entorno, revisa las variables de Supabase en el panel de Vercel.
- Si quieres, puedo crear un `git` commit aquí (no tengo acceso directo a tu repo remoto). Puedo también ejecutar la build localmente si me das permiso para ejecutar comandos en el entorno (ejecutaré `npm ci && npm run build` y te pasaré el resultado).