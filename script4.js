const fs = require('fs');
let file = fs.readFileSync('lib/demo-store.ts', 'utf8');

file = file.replace(/export function demoDeleteCotizacionMueblePersonalizada\(id: string\): \{ ok: true \} \| \{ ok: false; error: string \} \{/g, 'export function demoDeleteCotizacionMueblePersonalizada(id: string): { ok: true } | { ok: false; error: string } {\n  const row = store.cotizaciones.find(c => c.id === id);\n  if (row) {\n    const cliente = store.clientes.find(c => c.id === row.cliente_id);\n    if (cliente && cliente.estado === "activo") {\n      return { ok: false, error: "El cliente está activo. Cambie su estado manualmente." };\n    }\n  }');

fs.writeFileSync('lib/demo-store.ts', file);
