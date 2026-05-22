const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const artifactDir = 'C:\\Users\\cuent\\.gemini\\antigravity-cli\\brain\\719ac995-456e-4af5-a602-a43cc4e001fe';
const scratchDir = path.join(artifactDir, 'scratch');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

async function runTest() {
  console.log('Iniciando Playwright para pruebas simuladas del usuario...');
  const browser = await chromium.launch({ headless: true });
  
  // Crear contexto e inyectar la cookie de bypass local
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });
  
  console.log('Estableciendo cookie de sesión de administrador...');
  await context.addCookies([{
    name: 'katia_local_auth',
    value: 'dev-local-owner-admin',
    domain: 'localhost',
    path: '/'
  }]);

  const page = await context.newPage();

  // Escuchar logs de consola para detectar errores
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLA ERROR]: ${msg.text()}`);
    }
  });

  // 1. CARGAR INVENTARIO Y FORZAR TEMA CLARO
  console.log('\n--- PASO 1: Cargando inventario en MODO CLARO ---');
  await page.goto('http://localhost:3000/inventario', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('theme_override', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(1000);

  const screen1 = path.join(scratchDir, 'user_flow_1_light_mode_resumen.png');
  await page.screenshot({ path: screen1 });
  console.log(`✓ Captura de resumen en Modo Claro guardada: ${screen1}`);

  // 2. PROBAR "AGREGAR PRODUCTO" Y "NUEVA CATEGORÍA" EN MODO CLARO
  console.log('\n--- PASO 2: Abriendo panel de "Agregar producto" y creando categoría ---');
  await page.goto('http://localhost:3000/inventario?quick=producto', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('theme_override', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(1200);

  // Click en "+ Nueva" categoría
  const nuevaCatBtnSelector = 'button[title="Agregar nueva categoría"]';
  await page.waitForSelector(nuevaCatBtnSelector);
  await page.click(nuevaCatBtnSelector);
  await page.waitForTimeout(600);

  // Escribir categoría
  const inputCatSelector = 'input[placeholder="Nombre de la categoría"]';
  await page.waitForSelector(inputCatSelector);
  await page.fill(inputCatSelector, 'MDF Premium');
  await page.waitForTimeout(400);

  // Click en "Agregar"
  console.log('Registrando nueva categoría...');
  await page.click('input[placeholder="Nombre de la categoría"] + button', { force: true });
  await page.waitForTimeout(1000);

  const screen2 = path.join(scratchDir, 'user_flow_2_light_mode_nueva_categoria.png');
  await page.screenshot({ path: screen2 });
  console.log(`✓ Captura con categoría MDF Premium autoseleccionada guardada: ${screen2}`);

  // 3. PROBAR "REGISTRAR COMPRA" EN MODO CLARO (PROVEEDOR LIBRE)
  console.log('\n--- PASO 3: Abriendo panel de "Registrar compra" en MODO CLARO ---');
  await page.goto('http://localhost:3000/inventario?quick=compra', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('theme_override', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(1200);

  console.log('Escribiendo proveedor libre en el formulario de compra...');
  const proveedorInputSelector = 'input[name="proveedor"]';
  await page.waitForSelector(proveedorInputSelector);
  await page.click(proveedorInputSelector);
  await page.fill(proveedorInputSelector, 'Distribuidora Central de Maderas');
  await page.waitForTimeout(500);

  const screen3 = path.join(scratchDir, 'user_flow_3_light_mode_registrar_compra.png');
  await page.screenshot({ path: screen3 });
  console.log(`✓ Captura de Registrar Compra en Modo Claro guardada: ${screen3}`);

  // 4. PROBAR "REGISTRAR MOVIMIENTO" EN MODO CLARO
  console.log('\n--- PASO 4: Abriendo panel de "Registrar movimiento" en MODO CLARO ---');
  await page.goto('http://localhost:3000/inventario?quick=movimiento', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.setItem('theme_override', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.waitForTimeout(1200);

  const screen4 = path.join(scratchDir, 'user_flow_4_light_mode_registrar_movimiento.png');
  await page.screenshot({ path: screen4 });
  console.log(`✓ Captura de Registrar Movimiento en Modo Claro guardada: ${screen4}`);

  // 5. CAMBIAR A MODO OSCURO PARA COMPARACIÓN
  console.log('\n--- PASO 5: Cambiando a MODO OSCURO para comparación de legibilidad ---');
  await page.evaluate(() => {
    window.localStorage.setItem('theme_override', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(1000);

  const screen5 = path.join(scratchDir, 'user_flow_5_dark_mode_registrar_movimiento.png');
  await page.screenshot({ path: screen5 });
  console.log(`✓ Captura de Registrar Movimiento en Modo Oscuro guardada: ${screen5}`);

  console.log('\nCerrando navegador Playwright...');
  await browser.close();
  console.log('¡Prueba interactiva del usuario completada exitosamente!');
}

runTest().catch(console.error);
