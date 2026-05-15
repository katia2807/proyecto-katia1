const fs = require('fs');
let file = fs.readFileSync('lib/demo-store.ts', 'utf8');

file = file.replace(/tipo_persona: "natural",\n        created_at/g, 'tipo_persona: "natural",\n        estado: "activo",\n        created_at');
file = file.replace(/tipo_persona: null,\n        created_at/g, 'tipo_persona: null,\n        estado: "activo",\n        created_at');
file = file.replace(/tipo_persona: "empresa",\n        created_at/g, 'tipo_persona: "empresa",\n        estado: "activo",\n        created_at');

file = file.replace(/tipo_persona: input.tipo_persona \?\? null,\n    }\);/g, 'tipo_persona: input.tipo_persona ?? null,\n      estado: "activo",\n    });');

file = file.replace(/tipo_persona: r.tipo_persona === "natural" \|\| r.tipo_persona === "empresa" \? r.tipo_persona : null,/g, 'tipo_persona: r.tipo_persona === "natural" || r.tipo_persona === "empresa" ? r.tipo_persona : null,\n      estado: r.estado === "activo" || r.estado === "inactivo" || r.estado === "moroso" ? r.estado : "activo",');

fs.writeFileSync('lib/demo-store.ts', file);
