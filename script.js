const fs = require('fs');
let file = fs.readFileSync('lib/supabase/types.ts', 'utf8');
file = file.replace(/tipo_persona: "natural" \| "empresa" \| null;/g, 'tipo_persona: "natural" | "empresa" | null;\n            estado?: "activo" | "inactivo" | "moroso" | null;');
file = file.replace(/tipo_persona\?: "natural" \| "empresa" \| null;/g, 'tipo_persona?: "natural" | "empresa" | null;\n            estado?: "activo" | "inactivo" | "moroso" | null;');
fs.writeFileSync('lib/supabase/types.ts', file);
