# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ventas.spec.ts >> ventas — madera, aserradero, mixer (demo DB) >> aserradero: servicio básico aparece en listado
- Location: tests\e2e\ventas.spec.ts:25:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Resumen operativo' })
Expected: visible
Timeout: 25000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 25000ms
  - waiting for getByRole('heading', { name: 'Resumen operativo' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - status [ref=e2]:
    - paragraph [ref=e3]: Modo demo forzado (KATIA_USE_DEMO_DB)
    - paragraph [ref=e4]: "Esta instancia ignora Supabase para operaciones de datos: se usa el almacén demo en el servidor (JSON / memoria), no tu base Postgres. No hay migración automática a la base real: quitá la variable KATIA_USE_DEMO_DB, configurá SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY, y redeploy."
    - paragraph [ref=e5]:
      - text: "Diagnóstico JSON:"
      - link "/api/health" [ref=e6] [cursor=pointer]:
        - /url: /api/health
      - text: (campos
      - code [ref=e7]: demoMode
      - text: ","
      - code [ref=e8]: supabaseConfigured
      - text: ","
      - code [ref=e9]: supabaseServerDataReady
      - text: ).
  - generic [ref=e12]:
    - button "Cerrar tour" [ref=e21]:
      - img [ref=e22]
    - paragraph [ref=e25]: Paso 1 de 6
    - heading "Bienvenido a Katia Suite" [level=2] [ref=e26]
    - paragraph [ref=e27]: Este es tu sistema de gestión privado. Te guiaré en 6 pasos para que conozcas las funciones principales.
    - generic [ref=e28]:
      - button "Saltar tour" [ref=e29]
      - button "Siguiente" [ref=e31]:
        - text: Siguiente
        - img [ref=e32]
  - generic [ref=e35]:
    - complementary [ref=e36]:
      - generic [ref=e37]:
        - generic [ref=e38]:
          - generic [ref=e39]: K
          - paragraph [ref=e40]: Katia Suite
        - button "Contraer menú" [ref=e41]:
          - img [ref=e42]
      - navigation [ref=e44]:
        - generic [ref=e45]:
          - paragraph [ref=e46]: Operación diaria
          - link "Inicio" [ref=e47] [cursor=pointer]:
            - /url: /
            - img [ref=e48]
            - generic [ref=e53]: Inicio
          - link "Caja" [ref=e54] [cursor=pointer]:
            - /url: /caja
            - img [ref=e55]
            - generic [ref=e58]: Caja
          - link "Ventas" [ref=e59] [cursor=pointer]:
            - /url: /ventas
            - img [ref=e60]
            - generic [ref=e64]: Ventas
          - link "Cotizaciones" [ref=e65] [cursor=pointer]:
            - /url: /cotizacion
            - img [ref=e66]
            - generic [ref=e68]: Cotizaciones
        - generic [ref=e69]:
          - paragraph [ref=e70]: Catálogo
          - link "Inventario 2" [ref=e71] [cursor=pointer]:
            - /url: /inventario
            - img [ref=e72]
            - generic [ref=e81]: Inventario
            - generic [ref=e82]: "2"
          - link "Clientes" [ref=e83] [cursor=pointer]:
            - /url: /ventas/clientes
            - img [ref=e84]
            - generic [ref=e91]: Clientes
        - generic [ref=e92]:
          - paragraph [ref=e93]: Gestión
          - link "Centro de Mando 2" [ref=e94] [cursor=pointer]:
            - /url: /gerencial
            - img [ref=e95]
            - generic [ref=e97]: Centro de Mando
            - generic [ref=e98]: "2"
          - link "Reportes" [ref=e99] [cursor=pointer]:
            - /url: /reportes
            - img [ref=e100]
            - generic [ref=e104]: Reportes
          - link "Registro" [ref=e105] [cursor=pointer]:
            - /url: /registro
            - img [ref=e106]
            - generic [ref=e108]: Registro
        - generic [ref=e109]:
          - paragraph [ref=e110]: Configuración
          - link "Configuración" [ref=e111] [cursor=pointer]:
            - /url: /configuracion
            - img [ref=e112]
            - generic [ref=e115]: Configuración
          - link "Respaldo" [ref=e116] [cursor=pointer]:
            - /url: /admin/respaldo
            - img [ref=e117]
            - generic [ref=e120]: Respaldo
          - link "Usuarios" [ref=e121] [cursor=pointer]:
            - /url: /admin/usuarios
            - img [ref=e122]
            - generic [ref=e127]: Usuarios
          - link "Equipo" [ref=e128] [cursor=pointer]:
            - /url: /personal
            - img [ref=e129]
            - generic [ref=e134]: Equipo
          - link "Ayuda" [ref=e135] [cursor=pointer]:
            - /url: /ayuda
            - img [ref=e136]
            - generic [ref=e139]: Ayuda
      - generic [ref=e140]:
        - generic [ref=e141]:
          - generic [ref=e142]: U
          - generic [ref=e143]:
            - paragraph [ref=e144]: Usuario de prueba (local)
            - paragraph [ref=e145]: Dueña / owner_admin
        - button "Cerrar sesión" [ref=e147]
    - main [ref=e148]:
      - generic [ref=e149]:
        - heading "Inicio" [level=1] [ref=e151]
        - generic [ref=e152]:
          - img
          - textbox "Búsqueda global" [ref=e153]:
            - /placeholder: Buscar…
        - generic [ref=e154]:
          - button "0 notificaciones sin leer" [ref=e156]:
            - img [ref=e157]
          - button "Cambiar a modo claro" [ref=e160]:
            - img [ref=e161]
          - generic [ref=e164]: U
      - generic [ref=e166]:
        - generic [ref=e168]:
          - generic [ref=e169]:
            - heading "Inicio" [level=2] [ref=e170]
            - paragraph [ref=e171]: Hay elementos que requieren tu atención.
          - link "Panel ejecutivo →" [ref=e172] [cursor=pointer]:
            - /url: /gerencial
        - generic [ref=e173]:
          - link "Stock por reponer 2 producto(s) por debajo del mínimo 2 Ver alertas de stock →" [ref=e174] [cursor=pointer]:
            - /url: /inventario?tab=alertas#alertas-stock
            - generic [ref=e175]:
              - generic [ref=e176]:
                - generic [ref=e177]:
                  - paragraph [ref=e178]: Stock por reponer
                  - paragraph [ref=e179]: 2 producto(s) por debajo del mínimo
                - generic [ref=e180]: "2"
              - paragraph [ref=e181]: Ver alertas de stock →
          - link "Alertas críticas 2 alerta(s) de prioridad alta 2 Abrir Centro de Mando →" [ref=e182] [cursor=pointer]:
            - /url: /gerencial
            - generic [ref=e183]:
              - generic [ref=e184]:
                - generic [ref=e185]:
                  - paragraph [ref=e186]: Alertas críticas
                  - paragraph [ref=e187]: 2 alerta(s) de prioridad alta
                - generic [ref=e188]: "2"
              - paragraph [ref=e189]: Abrir Centro de Mando →
          - link "Ventas sin confirmar 1 venta(s) aún en borrador 1 Ir a ventas →" [ref=e190] [cursor=pointer]:
            - /url: /ventas
            - generic [ref=e191]:
              - generic [ref=e192]:
                - generic [ref=e193]:
                  - paragraph [ref=e194]: Ventas sin confirmar
                  - paragraph [ref=e195]: 1 venta(s) aún en borrador
                - generic [ref=e196]: "1"
              - paragraph [ref=e197]: Ir a ventas →
          - link "Penalidades activas 1 contrato(s) con penalidad 1 Revisar contratos →" [ref=e198] [cursor=pointer]:
            - /url: /ventas/alquiler-mixer
            - generic [ref=e199]:
              - generic [ref=e200]:
                - generic [ref=e201]:
                  - paragraph [ref=e202]: Penalidades activas
                  - paragraph [ref=e203]: 1 contrato(s) con penalidad
                - generic [ref=e204]: "1"
              - paragraph [ref=e205]: Revisar contratos →
          - link "Adelantos pendientes 1 adelanto(s) por regularizar 1 Ir a personal →" [ref=e206] [cursor=pointer]:
            - /url: /personal
            - generic [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]:
                  - paragraph [ref=e210]: Adelantos pendientes
                  - paragraph [ref=e211]: 1 adelanto(s) por regularizar
                - generic [ref=e212]: "1"
              - paragraph [ref=e213]: Ir a personal →
        - generic [ref=e214]:
          - paragraph [ref=e215]: Este período
          - generic [ref=e216]:
            - generic [ref=e217]:
              - paragraph [ref=e218]: Ingresos del mes
              - paragraph [ref=e219]: S/ 1,855.00
            - generic [ref=e220]:
              - paragraph [ref=e221]: Egresos del mes
              - paragraph [ref=e222]: S/ 0.00
            - generic [ref=e223]:
              - paragraph [ref=e224]: Utilidad estimada
              - paragraph [ref=e225]: S/ 1,855.00
            - generic [ref=e226]:
              - paragraph [ref=e227]: Empleados activos
              - paragraph [ref=e228]: "3"
          - paragraph [ref=e229]:
            - link "Ver análisis detallado en Centro de Mando →" [ref=e230] [cursor=pointer]:
              - /url: /gerencial?tab=pasado
        - generic [ref=e231]:
          - generic [ref=e232]:
            - generic [ref=e233]:
              - heading "Caja reciente" [level=3] [ref=e234]
              - link "Ver todos →" [ref=e235] [cursor=pointer]:
                - /url: /caja
            - paragraph [ref=e236]: Últimos movimientos registrados.
            - table [ref=e238]:
              - rowgroup [ref=e239]:
                - row "Fecha Tipo Categoría Monto" [ref=e240]:
                  - columnheader "Fecha" [ref=e241]
                  - columnheader "Tipo" [ref=e242]
                  - columnheader "Categoría" [ref=e243]
                  - columnheader "Monto" [ref=e244]
              - rowgroup [ref=e245]:
                - row "07/05/2026 ingreso adelanto_mueble_personalizado S/ 300.00" [ref=e246]:
                  - cell "07/05/2026" [ref=e247]
                  - cell "ingreso" [ref=e248]
                  - cell "adelanto_mueble_personalizado" [ref=e249]
                  - cell "S/ 300.00" [ref=e250]
                - row "06/05/2026 ingreso servicio_corte_mueble S/ 55.00" [ref=e251]:
                  - cell "06/05/2026" [ref=e252]
                  - cell "ingreso" [ref=e253]
                  - cell "servicio_corte_mueble" [ref=e254]
                  - cell "S/ 55.00" [ref=e255]
                - row "30/04/2026 ingreso servicio_corte_mueble S/ 100.00" [ref=e256]:
                  - cell "30/04/2026" [ref=e257]
                  - cell "ingreso" [ref=e258]
                  - cell "servicio_corte_mueble" [ref=e259]
                  - cell "S/ 100.00" [ref=e260]
                - row "30/04/2026 ingreso prueba_e2e_caja S/ 150.00" [ref=e261]:
                  - cell "30/04/2026" [ref=e262]
                  - cell "ingreso" [ref=e263]
                  - cell "prueba_e2e_caja" [ref=e264]
                  - cell "S/ 150.00" [ref=e265]
          - generic [ref=e266]:
            - generic [ref=e267]:
              - heading "Ventas recientes" [level=3] [ref=e268]
              - link "Ver todas →" [ref=e269] [cursor=pointer]:
                - /url: /ventas
            - paragraph [ref=e270]: 3 venta(s) de madera registradas.
            - table [ref=e272]:
              - rowgroup [ref=e273]:
                - row "Fecha Estado Total Ir" [ref=e274]:
                  - columnheader "Fecha" [ref=e275]
                  - columnheader "Estado" [ref=e276]
                  - columnheader "Total" [ref=e277]
                  - columnheader "Ir" [ref=e278]
              - rowgroup [ref=e279]:
                - row "29/04/2026 confirmada S/ 900.00 Abrir" [ref=e280]:
                  - cell "29/04/2026" [ref=e281]
                  - cell "confirmada" [ref=e282]
                  - cell "S/ 900.00" [ref=e283]
                  - cell "Abrir" [ref=e284]:
                    - link "Abrir" [ref=e285] [cursor=pointer]:
                      - /url: /ventas/madera-cortada
                - row "28/04/2026 confirmada S/ 1,200.00 Abrir" [ref=e286]:
                  - cell "28/04/2026" [ref=e287]
                  - cell "confirmada" [ref=e288]
                  - cell "S/ 1,200.00" [ref=e289]
                  - cell "Abrir" [ref=e290]:
                    - link "Abrir" [ref=e291] [cursor=pointer]:
                      - /url: /ventas/madera-cortada
                - row "25/04/2026 borrador S/ 540.00 Abrir" [ref=e292]:
                  - cell "25/04/2026" [ref=e293]
                  - cell "borrador" [ref=e294]
                  - cell "S/ 540.00" [ref=e295]
                  - cell "Abrir" [ref=e296]:
                    - link "Abrir" [ref=e297] [cursor=pointer]:
                      - /url: /ventas/madera-cortada
        - generic [ref=e298]:
          - paragraph [ref=e299]: Accesos rápidos
          - generic [ref=e300]:
            - link "Nueva cotización" [ref=e301] [cursor=pointer]:
              - /url: /cotizacion
              - button "Nueva cotización" [ref=e302]
            - link "Ver clientes" [ref=e303] [cursor=pointer]:
              - /url: /ventas/clientes
              - button "Ver clientes" [ref=e304]
            - link "Catálogo" [ref=e305] [cursor=pointer]:
              - /url: /inventario?tab=productos
              - button "Catálogo" [ref=e306]
            - link "Exportar reportes" [ref=e307] [cursor=pointer]:
              - /url: /reportes
              - button "Exportar reportes" [ref=e308]
            - link "Centro de Mando" [ref=e309] [cursor=pointer]:
              - /url: /gerencial
              - button "Centro de Mando" [ref=e310]
      - generic [ref=e311]:
        - paragraph [ref=e312]: KATIA LIZZET MENESES TAYPE · Katia Suite
        - generic [ref=e313]:
          - paragraph [ref=e314]: v1.0.0 · Mayo 2026
          - link "Términos" [ref=e315] [cursor=pointer]:
            - /url: /legal/terminos
          - link "Privacidad" [ref=e316] [cursor=pointer]:
            - /url: /legal/privacidad
    - button "Abrir ayuda contextual" [ref=e318]:
      - img [ref=e319]
  - alert [ref=e322]
  - generic [ref=e324]:
    - paragraph [ref=e325]:
      - text: Este sistema usa cookies técnicas esenciales para el funcionamiento de la sesión. No se usan cookies de rastreo o publicidad.
      - link "Política de privacidad" [ref=e326] [cursor=pointer]:
        - /url: /legal/privacidad
    - button "Entendido" [ref=e327]
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test";
  2  | 
  3  | export const DEMO_EMAIL = "test@test.com";
  4  | export const DEMO_PASSWORD = "test1234";
  5  | 
  6  | export async function loginDemo(page: Page) {
  7  |   await page.goto("/login");
  8  |   await page.getByLabel(/correo/i).fill(DEMO_EMAIL);
  9  |   await page.getByLabel(/^Contraseña$/i).fill(DEMO_PASSWORD);
  10 |   await page.getByRole("button", { name: "Ingresar al panel" }).click();
> 11 |   await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible({
     |                                                                          ^ Error: expect(locator).toBeVisible() failed
  12 |     timeout: 25_000,
  13 |   });
  14 | }
  15 | 
```