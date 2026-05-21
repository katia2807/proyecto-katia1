const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const artifactDir = 'C:\\Users\\cuent\\.gemini\\antigravity-ide\\brain\\0d95af8d-1715-4cfc-8952-60219b46b007';

if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('Iniciando Puppeteer para la Guía de Pruebas...');
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1366, height: 900 }
  });
  const page = await browser.newPage();

  // Inyectar cookie de autenticación para local
  console.log('Inyectando cookie de sesión...');
  await page.setCookie({
    name: 'katia_local_auth',
    value: 'dev-local-owner-admin',
    domain: 'localhost',
    path: '/'
  });

  // ==========================================
  // PRUEBA 1 & 4: Productos y Defensa S/ 0.00
  // ==========================================
  console.log('\n--- PRUEBA 1 & 4: Cargando /inventario y revisando valorizaciones ---');
  await page.goto('http://localhost:3000/inventario?tab=productos', { waitUntil: 'networkidle0' });
  await delay(1000);

  // Tomar captura de la tabla de productos para ver el estado general y la defensa S/ 0.00
  const screenshot1Path = path.join(artifactDir, 'screenshot_1_productos_list.png');
  await page.screenshot({ path: screenshot1Path });
  console.log(`1. Captura de la tabla guardada: ${screenshot1Path}`);

  // Buscar un producto para hacerle click y ver el detalle
  console.log('Haciendo clic en el primer producto de la lista para ver detalle y sugerencia en cursiva...');
  const firstProductSelector = '[id^="producto-"]';
  await page.waitForSelector(firstProductSelector);
  
  // Hacer click en el primer producto
  await page.click(firstProductSelector);
  await delay(800); // esperar a que se abra el DetailDrawer

  const screenshot2Path = path.join(artifactDir, 'screenshot_2_producto_detalle_cero.png');
  await page.screenshot({ path: screenshot2Path });
  console.log(`2. Captura del detalle del producto con advertencia S/ 0.00 guardada: ${screenshot2Path}`);

  // Cerrar el drawer haciendo click afuera o en el botón de cerrar
  console.log('Cerrando cajón de detalles...');
  await page.keyboard.press('Escape');
  await delay(500);

  // ==========================================
  // PRUEBA 2: Botón + Nueva categoría
  // ==========================================
  console.log('\n--- PRUEBA 2: Abriendo "+ Agregar producto" y creando nueva categoría ---');
  await page.goto('http://localhost:3000/inventario?quick=producto', { waitUntil: 'networkidle0' });
  await delay(1000);

  // Tomar captura del panel lateral para agregar producto
  console.log('Haciendo clic en "+ Nueva" al lado de la categoría...');
  const nuevaCatBtnSelector = 'button[title="Agregar nueva categoría"]';
  await page.waitForSelector(nuevaCatBtnSelector);
  await page.click(nuevaCatBtnSelector);
  await delay(500);

  // Escribir "MDF Especial"
  console.log('Escribiendo la categoría "MDF Especial" y agregándola...');
  const inputCatSelector = 'input[placeholder="Nombre de la categoría"]';
  await page.waitForSelector(inputCatSelector);
  await page.type(inputCatSelector, 'MDF Especial');
  await delay(300);

  // Click en el botón verde "Agregar"
  const addBtnSelector = 'button::-p-text(Agregar)';
  // Si el selector con pseudo-text no funciona, usamos el botón que está al lado del input
  await page.click('button[type="button"].border-emerald-500\\/40');
  await delay(800);

  const screenshot3Path = path.join(artifactDir, 'screenshot_3_nueva_categoria_autoseleccionada.png');
  await page.screenshot({ path: screenshot3Path });
  console.log(`3. Captura con categoría MDF Especial autoseleccionada guardada: ${screenshot3Path}`);

  // Cerrar el drawer
  await page.keyboard.press('Escape');
  await delay(500);

  // ==========================================
  // PRUEBA 3: Ajustar el stock desde la edición rápida
  // ==========================================
  console.log('\n--- PRUEBA 3: Abriendo edición rápida para ajustar stock ---');
  await page.goto('http://localhost:3000/inventario?tab=productos', { waitUntil: 'networkidle0' });
  await delay(1000);

  // Click en el botón "Editar" del primer producto de la lista
  console.log('Abriendo modal de edición rápida...');
  const editBtnSelector = 'button::-p-text(Editar)';
  // Buscar botones de editar
  const editButtons = await page.$$('button');
  let clickExitoso = false;
  for (const btn of editButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Editar')) {
      await btn.click();
      clickExitoso = true;
      break;
    }
  }
  
  if (!clickExitoso) {
    // Intentar directamente vía selector general si el loop no lo pescó
    await page.click('[id^="producto-"] button');
  }
  await delay(800); // Esperar que cargue el drawer de edición

  const screenshot4Path = path.join(artifactDir, 'screenshot_4_edicion_rapida_stock.png');
  await page.screenshot({ path: screenshot4Path });
  console.log(`4. Captura de edición de stock con advertencia ámbar guardada: ${screenshot4Path}`);

  // Cerrar drawer de edición
  await page.keyboard.press('Escape');
  await delay(500);

  // ==========================================
  // PRUEBA 5: Proveedor libre en "Registrar Compra"
  // ==========================================
  console.log('\n--- PRUEBA 5: Registrando compra con proveedor de texto libre ---');
  await page.goto('http://localhost:3000/inventario?quick=compra', { waitUntil: 'networkidle0' });
  await delay(1000);

  console.log('Escribiendo nombre de proveedor nuevo que no existe...');
  const proveedorInputSelector = 'input[name="proveedor"]';
  await page.waitForSelector(proveedorInputSelector);
  await page.click(proveedorInputSelector);
  await page.type(proveedorInputSelector, 'Ferretería El Tornillo Feliz');
  await delay(500);

  const screenshot5Path = path.join(artifactDir, 'screenshot_5_proveedor_libre.png');
  await page.screenshot({ path: screenshot5Path });
  console.log(`5. Captura de proveedor en texto libre guardada: ${screenshot5Path}`);

  // Cerrar drawer
  await page.keyboard.press('Escape');
  await delay(500);

  // ==========================================
  // PRUEBA 6: Rediseño del Catálogo de Muebles
  // ==========================================
  console.log('\n--- PRUEBA 6: Revisando catálogo de muebles rediseñado ---');
  // Scroll down para ver la sección de catálogo
  await page.goto('http://localhost:3000/inventario?tab=productos', { waitUntil: 'networkidle0' });
  await delay(1000);

  console.log('Haciendo scroll hacia la sección del catálogo de muebles...');
  await page.evaluate(() => {
    const el = document.getElementById('catalogo-muebles-inventario');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  await delay(1000);

  const screenshot6Path = path.join(artifactDir, 'screenshot_6_catalogo_muebles_16_9.png');
  await page.screenshot({ path: screenshot6Path });
  console.log(`6. Captura del catálogo de muebles rediseñado 16:9 guardada: ${screenshot6Path}`);

  console.log('\nCerrando navegador...');
  await browser.close();
  console.log('¡Todas las pruebas automatizadas se completaron y los screenshots fueron capturados!');
}

runTest().catch(console.error);
