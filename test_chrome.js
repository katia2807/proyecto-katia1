const http = require('http');
const https = require('https');

async function testPage(path, name) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Cookie': 'katia_local_auth=dev-local-owner-admin'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (err) => {
      resolve({ error: err.message });
    });
    req.end();
  });
}

async function run() {
  console.log("=== SIMULANDO ACCESO A GOOGLE CHROME ===");
  console.log("Iniciando sesión con cookie katia_local_auth=dev-local-owner-admin...\n");

  console.log("1. Navegando a /inventario...");
  const inv = await testPage('/inventario');
  console.log("Status Code:", inv.status);
  console.log("-> ¿Aparece el botón + Nueva Categoría?:", inv.data.includes('+ Nueva'));
  console.log("-> ¿Aparece el datalist de proveedores?:", inv.data.includes('id="compra-proveedores-list"'));
  console.log("-> ¿Aparece la defensa para S/ 0.00?:", inv.data.includes('sin compras con costo'));
  console.log("-> ¿Aparece el campo stock_actual oculto/editable?:", inv.data.includes('name="stock_actual"'));

  console.log("\n2. Navegando a /inventario?tab=catalogo-muebles...");
  const cat = await testPage('/inventario?tab=catalogo-muebles');
  console.log("Status Code:", cat.status);
  console.log("-> ¿Están las tarjetas en formato 16/9?:", cat.data.includes('aspectRatio:"16/9"'));
  console.log("-> ¿Aparece el botón superpuesto de Cambiar foto?:", cat.data.includes('Cambiar foto') || cat.data.includes('Agregar foto'));
  console.log("-> ¿Aparece el botón para desplegar formulario de edición?:", cat.data.includes('Editar datos / foto'));
  console.log("\n¡Simulación completada con éxito!");
}

run();
