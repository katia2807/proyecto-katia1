/**
 * Generación de códigos familiares de producto (client-side preview).
 * Esquema: [CAT 3]-[SUBCAT 3]-[YYMM]-[SEQ 3]
 * Ejemplo: MAD-ROB-2605-001
 *
 * La generación definitiva (con secuencia real) corre en Supabase via
 * la función public.generar_codigo_producto(). Este módulo provee la
 * vista previa en tiempo real sin llamada a la BD.
 */

const DICCIONARIO: Array<{ termino: string; cat: string; subcat: string }> = [
  // Madera
  { termino: "madera roble",         cat: "MAD", subcat: "ROB" },
  { termino: "madera pino",          cat: "MAD", subcat: "PIN" },
  { termino: "madera cedro",         cat: "MAD", subcat: "CED" },
  { termino: "madera caoba",         cat: "MAD", subcat: "CAO" },
  { termino: "madera eucalipto",     cat: "MAD", subcat: "EUC" },
  { termino: "madera mdf",           cat: "MAD", subcat: "MDF" },
  { termino: "madera triplay",       cat: "MAD", subcat: "TRI" },
  { termino: "roble",                cat: "MAD", subcat: "ROB" },
  { termino: "pino",                 cat: "MAD", subcat: "PIN" },
  { termino: "cedro",                cat: "MAD", subcat: "CED" },
  { termino: "caoba",                cat: "MAD", subcat: "CAO" },
  { termino: "eucalipto",            cat: "MAD", subcat: "EUC" },
  { termino: "mdf",                  cat: "MAD", subcat: "MDF" },
  { termino: "triplay",              cat: "MAD", subcat: "TRI" },
  // Tornillería/Ferretería
  { termino: "tornillo autorroscante", cat: "TOR", subcat: "AUT" },
  { termino: "tornillo hexagonal",   cat: "TOR", subcat: "HEX" },
  { termino: "tornillo",             cat: "TOR", subcat: "GEN" },
  { termino: "clavo",                cat: "CLA", subcat: "GEN" },
  { termino: "tuerca",               cat: "TUE", subcat: "GEN" },
  { termino: "arandela",             cat: "ARA", subcat: "GEN" },
  // Barnices y químicos
  { termino: "barniz poliuretanico", cat: "BAR", subcat: "POL" },
  { termino: "barniz nitro",         cat: "BAR", subcat: "NIT" },
  { termino: "barniz",               cat: "BAR", subcat: "GEN" },
  { termino: "pintura latex",        cat: "PIN", subcat: "LAT" },
  { termino: "pintura esmalte",      cat: "PIN", subcat: "ESM" },
  { termino: "pintura",              cat: "PIN", subcat: "GEN" },
  { termino: "pegamento pvc",        cat: "PEG", subcat: "PVC" },
  { termino: "pegamento carpintero", cat: "PEG", subcat: "CAR" },
  { termino: "pegamento",            cat: "PEG", subcat: "GEN" },
  // Muebles
  { termino: "mueble sala",          cat: "MUE", subcat: "SAL" },
  { termino: "mueble dormitorio",    cat: "MUE", subcat: "DOR" },
  { termino: "mueble cocina",        cat: "MUE", subcat: "COC" },
  { termino: "mueble oficina",       cat: "MUE", subcat: "OFI" },
  { termino: "mueble",               cat: "MUE", subcat: "GEN" },
  // Servicios
  { termino: "servicio corte",       cat: "SRV", subcat: "COR" },
  { termino: "servicio lijado",      cat: "SRV", subcat: "LIJ" },
  { termino: "servicio instalacion", cat: "SRV", subcat: "INS" },
  { termino: "servicio pintura",     cat: "SRV", subcat: "PIN" },
  { termino: "servicio",             cat: "SRV", subcat: "GEN" },
  // Accesorios
  { termino: "herramienta",          cat: "HER", subcat: "GEN" },
  { termino: "accesorio",            cat: "ACC", subcat: "GEN" },
];

function extraerConsonantes(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[aeiouáéíóúü\s]/gi, "")
    .replace(/[^a-z]/gi, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");
}

/** Genera preview del código (sin secuencia real, usa SEQ = "XXX"). */
export function previsualizarCodigo(nombre: string): string | null {
  if (!nombre.trim()) return null;

  const nombreLower = nombre.trim().toLowerCase();

  // Buscar en diccionario por longitud descendente (más específico primero)
  const match = DICCIONARIO
    .filter((entry) => nombreLower.includes(entry.termino))
    .sort((a, b) => b.termino.length - a.termino.length)[0];

  const yymm = new Date()
    .toLocaleDateString("es-PE", { year: "2-digit", month: "2-digit" })
    .replace(/\//g, "")
    .slice(-4);

  if (match) {
    return `${match.cat}-${match.subcat}-${yymm}-###`;
  }

  // Fallback: primeras consonantes del nombre
  const consonantes = extraerConsonantes(nombreLower);
  const resto = extraerConsonantes(nombreLower.slice(3));
  return `${consonantes}-${resto}-${yymm}-###`;
}

/** Genera preview completo con info del match */
export function analizarNombre(nombre: string): {
  codigo: string | null;
  cat: string | null;
  subcat: string | null;
  esMatch: boolean;
} {
  if (!nombre.trim()) return { codigo: null, cat: null, subcat: null, esMatch: false };

  const nombreLower = nombre.trim().toLowerCase();
  const match = DICCIONARIO
    .filter((entry) => nombreLower.includes(entry.termino))
    .sort((a, b) => b.termino.length - a.termino.length)[0];

  const yymm = new Date()
    .toLocaleDateString("es-PE", { year: "2-digit", month: "2-digit" })
    .replace(/\//g, "")
    .slice(-4);

  if (match) {
    return {
      codigo: `${match.cat}-${match.subcat}-${yymm}-###`,
      cat: match.cat,
      subcat: match.subcat,
      esMatch: true,
    };
  }

  const cat = extraerConsonantes(nombreLower);
  const subcat = extraerConsonantes(nombreLower.slice(3));
  return {
    codigo: `${cat}-${subcat}-${yymm}-###`,
    cat,
    subcat,
    esMatch: false,
  };
}
