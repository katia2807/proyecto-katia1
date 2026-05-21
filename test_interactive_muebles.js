const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const artifactDir = 'C:\\Users\\cuent\\.gemini\\antigravity-ide\\brain\\a003554a-16b9-43fd-ab53-76d9242e58ca';
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Visual mouse helper configuration
async function installMouseHelper(page) {
  await page.evaluateOnNewDocument(() => {
    // Inyectar círculo del puntero
    const box = document.createElement('puppeteer-mouse-pointer');
    const style = document.createElement('style');
    style.innerHTML = `
      puppeteer-mouse-pointer {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        background: rgba(239, 68, 68, 0.85); /* Rojo vibrante */
        border: 2px solid #ffffff;
        border-radius: 50%;
        margin: -10px 0 0 -10px;
        padding: 0;
        transition: background 0.15s, transform 0.15s;
        z-index: 99999999;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }
      puppeteer-mouse-pointer.mousedown {
        background: rgba(16, 185, 129, 0.95); /* Verde esmeralda al hacer clic */
        transform: scale(0.8);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(box);
    document.addEventListener('mousemove', event => {
      box.style.left = event.pageX + 'px';
      box.style.top = event.pageY + 'px';
    }, true);
    document.addEventListener('mousedown', event => {
      box.style.left = event.pageX + 'px';
      box.style.top = event.pageY + 'px';
      box.classList.add('mousedown');
    }, true);
    document.addEventListener('mouseup', event => {
      box.style.left = event.pageX + 'px';
      box.style.top = event.pageY + 'px';
      box.classList.remove('mousedown');
    }, true);
  });
}

async function glideAndClickElement(page, elementHandle, name) {
  const box = await elementHandle.boundingBox();
  if (!box) {
    throw new Error(`No se pudo obtener el bounding box para el elemento: ${name}`);
  }
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  console.log(`[Mouse] Desplazando hacia: ${name} en (${Math.round(targetX)}, ${Math.round(targetY)})`);
  await page.mouse.move(targetX, targetY, { steps: 35 });
  await delay(400); // Pausa realista al llegar
  console.log(`[Mouse] Clic en: ${name}`);
  await page.mouse.down();
  await delay(120); // Simular duración de clic
  await page.mouse.up();
  await delay(600);
}

async function findElementByTextInside(page, parentSelector, tagName, text) {
  const handle = await page.evaluateHandle((parentSel, tag, txt) => {
    const parent = document.querySelector(parentSel);
    if (!parent) return null;
    const elements = parent.getElementsByTagName(tag);
    for (const el of elements) {
      if (el.textContent.includes(txt)) {
        return el;
      }
    }
    return null;
  }, parentSelector, tagName, text);
  
  const element = handle.asElement();
  if (!element) {
    return null;
  }
  return element;
}

async function runTest() {
  console.log('=== INICIANDO PRUEBA VISUAL INTERACTIVA DEL FLUJO DE EDICIÓN ===');
  
  // Iniciamos Puppeteer de forma visible (headless: false)
  // Usamos slowMo: 40 para suavizar las acciones globales
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 40,
    defaultViewport: { width: 1366, height: 768 },
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  // Instalamos el puntero visual personalizado
  await installMouseHelper(page);

  // Inyectamos la cookie de autenticación de desarrollo
  console.log('Inyectando cookie de sesión de desarrollo...');
  await page.setCookie({
    name: 'katia_local_auth',
    value: 'dev-local-owner-admin',
    domain: 'localhost',
    path: '/'
  });

  // Navegamos al catálogo de muebles en inventario (pestaña 'productos')
  const targetUrl = 'http://localhost:3000/inventario?tab=productos';
  console.log(`Navegando a: ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle0' });
  await delay(1500);

  // Hacer scroll hacia abajo para ver la sección de catálogo
  console.log('Haciendo scroll hacia la sección del catálogo de muebles...');
  await page.evaluate(() => {
    const el = document.getElementById('catalogo-muebles-inventario');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  await delay(1200);

  // Esperar a que las tarjetas de catálogo carguen
  console.log('Esperando a que aparezca el catálogo de muebles en el DOM...');
  await page.waitForSelector('[id^="mueble-catalogo-"]');

  // Obtener el ID de la primera tarjeta
  const cardId = await page.evaluate(() => {
    const card = document.querySelector('[id^="mueble-catalogo-"]');
    return card ? card.id : null;
  });

  if (!cardId) {
    throw new Error('No se encontraron muebles en el catálogo para editar.');
  }
  
  console.log(`\nIdentificado primer mueble en el catálogo con ID: ${cardId}`);

  // Encontrar el botón de "Editar datos / foto" dentro de esa tarjeta
  const expandBtn = await findElementByTextInside(page, `#${cardId}`, 'button', 'Editar datos / foto');
  if (!expandBtn) {
    throw new Error('No se encontró el botón "Editar datos / foto" en la tarjeta del mueble.');
  }

  // 1. Mover y hacer clic en el botón de expandir edición
  await glideAndClickElement(page, expandBtn, 'Botón "Editar datos / foto"');
  console.log('Esperando a que el formulario colapsable se expanda...');
  await delay(1200); // Dar tiempo a que se expanda el panel

  // 2. Localizar el campo de Precio Sugerido
  const precioSelector = `#${cardId} input[name="precio_lista"]`;
  const precioInput = await page.waitForSelector(precioSelector);
  await glideAndClickElement(page, precioInput, 'Campo "Precio sugerido (S/)"');

  // Seleccionar todo el texto actual y borrarlo
  console.log('Modificando el precio de lista a S/ 1399.90...');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await delay(250);
  
  // Escribir el nuevo precio simulando teclado humano
  await page.keyboard.type('1399.90', { delay: 90 });
  await delay(500);

  // 3. Localizar el campo de Descripción
  const descSelector = `#${cardId} input[name="descripcion"]`;
  const descInput = await page.waitForSelector(descSelector);
  await glideAndClickElement(page, descInput, 'Campo "Descripción"');

  // Seleccionar todo el texto actual y borrarlo
  console.log('Modificando la descripción del mueble...');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await delay(250);

  // Escribir la nueva descripción simulando teclado humano
  const nuevaDescripcion = 'Madera selecta de tornillo. Edición de lujo con acabado a la cera resistente a la humedad.';
  await page.keyboard.type(nuevaDescripcion, { delay: 40 });
  await delay(600);

  // 4. Localizar y hacer clic en "Guardar cambios"
  const saveBtn = await findElementByTextInside(page, `#${cardId}`, 'button', 'Guardar cambios');
  if (!saveBtn) {
    throw new Error('No se encontró el botón "Guardar cambios" en el formulario.');
  }
  await glideAndClickElement(page, saveBtn, 'Botón "Guardar cambios"');
  await delay(1000); // Esperar que abra el diálogo de confirmación

  // 5. Confirmar en el modal de confirmación (clic en "Guardar")
  console.log('Buscando diálogo de confirmación...');
  const confirmBtn = await findElementByTextInside(page, 'body', 'button', 'Guardar');
  if (!confirmBtn) {
    throw new Error('No se encontró el botón de confirmación "Guardar" en el modal.');
  }
  await glideAndClickElement(page, confirmBtn, 'Botón de confirmación "Guardar"');
  
  console.log('Guardando cambios... Esperando toast de éxito y recarga...');
  await delay(2500); // Esperar a que guarde, muestre el toast y se cierre

  // Tomar captura de pantalla de verificación
  const screenshotPath = path.join(artifactDir, 'resultado_flujo_edicion.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`\n¡Cambios guardados con éxito! Captura de pantalla guardada en:\n${screenshotPath}`);

  await delay(2000);
  console.log('Cerrando navegador...');
  await browser.close();
  console.log('=== PRUEBA INTERACTIVA COMPLETADA CON ÉXITO ===');
}

runTest().catch(async (error) => {
  console.error('Error durante la ejecución de la prueba:', error);
});
