const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  console.log('Iniciando navegador Chrome...');
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  console.log('Inyectando cookie de sesión...');
  await page.setCookie({
    name: 'auth-legacy-token',
    value: 'dev-local-owner-admin',
    domain: 'localhost',
    path: '/'
  });

  console.log('Navegando a catálogo de muebles...');
  await page.goto('http://localhost:3000/inventario?tab=catalogo-muebles', { waitUntil: 'networkidle0' });
  
  console.log('Tomando captura de pantalla...');
  const artifactDir = 'C:\\Users\\cuent\\.gemini\\antigravity-ide\\brain\\bbdb662a-17fb-48f8-9557-47e512cdd28d';
  if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
  }
  await page.screenshot({ path: artifactDir + '\\captura_catalogo.png', fullPage: true });
  
  await browser.close();
  console.log('Captura guardada en: ' + artifactDir + '\\captura_catalogo.png');
}

run().catch(console.error);
