const puppeteer = require('puppeteer');

async function run() {
  console.log('Iniciando navegador Chrome depurable en puerto 9222...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--remote-debugging-port=9222',
      '--remote-allow-origins=*'
    ],
    defaultViewport: { width: 1366, height: 900 }
  });
  
  const wsEndpoint = browser.wsEndpoint();
  console.log('Navegador iniciado y escuchando en el puerto 9222!');
  console.log('WebSocket Endpoint:', wsEndpoint);
  
  // Keep the process alive
  await new Promise(() => {});
}

run().catch(console.error);
