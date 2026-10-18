import { combinarCuentasCliente, cuentasCompatiblesCliente, esMismaReferenciaCuenta, type CuentaCliente } from "@/lib/cliente-contacto";

export type CampoPdfCliente = "nombre" | "tipo_persona" | "ruc" | "documento" | "telefono" | "direccion" | "email";
export type PaginaPdfCliente = { pagina: number; texto: string; origen: "texto" | "ocr"; confianza?: number };
export type CandidatoPdf = { valor: string; pagina: number; evidencia: string; origen: "texto" | "ocr" };
export type CuentaPdf = { cuenta: CuentaCliente; pagina: number; evidencia: string; origen: "texto" | "ocr" };
export type ResultadoPdfCliente = {
  campos: Record<CampoPdfCliente, CandidatoPdf[]>;
  cuentas: CuentaPdf[];
  advertencias: string[];
  paginas: number;
};
export const PDF_CLIENTE_LABELS: Record<CampoPdfCliente, string> = {
  nombre: "Nombre / Razón social", tipo_persona: "Tipo", ruc: "RUC", documento: "DNI / Documento",
  telefono: "Teléfono", direccion: "Dirección", email: "Correo electrónico",
};
const normal = (s: string) => s.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/[ \t]+/g, " ").trim();
const bank = /\b(BCP|Banco de Cr[eé]dito(?: del Per[uú])?|Interbank|BBVA(?: Per[uú])?|Scotiabank|Banco de la Naci[oó]n|BanBif|Pichincha|Banco Falabella|Banco Ripley)\b/i;
const labels = /(?:r\.?\s*u\.?\s*c\.?|raz[oó]n social|nombres? y apellidos|apellidos y nombres|tel[eé]fono|celular|correo|e-?mail|domicilio fiscal|direcci[oó]n|banco|moneda|titular|\bcci\b|n[uú]mero de cuenta)\s*[:|]/i;
const cleanValue = (s: string) => normal(s.split(labels)[0]).replace(/^[\s:|#–—-]+|[\s|;]+$/g, "");
const noData = (s: string) => !s || /^(?:-|no (?:registra|indica|tiene)|sin (?:datos|informaci[oó]n)|n\/?a)$/i.test(s);
function labeledValue(lines: string[], index: number, expression: RegExp) {
  const match = expression.exec(lines[index]);
  if (!match) return "";
  const value = cleanValue(lines[index].slice(match.index + match[0].length));
  if (value) return value;
  const next = lines[index + 1] ?? "";
  return labels.test(next) ? "" : cleanValue(next);
}
const digits = (s: string) => s.replace(/[\s-]/g, "");
const accountPattern = /(?:n[úu]m(?:ero|\.)?\s*(?:de\s*)?(?:la\s*)?cuenta|n(?:ro\.?|[°ºo.])\s*(?:de\s*)?cuenta|cuenta|cta\.?)(?!\s*(?:interbancaria|cci))\s*(?:corriente|de\s*ahorros?|bancaria)?\s*(?:en\s+)?(?:soles|PEN|USD|d[oó]lares|US\$)?\s*(?:n(?:ro\.?|[°ºo.]*))?\s*[:#|.-]?\s*((?:\d[ -]?){6,30})(?!\d)/i;
const cciPattern = /(?:\bcci\b|c[oó]digo\s+(?:de\s+)?cuenta\s+interbancari[ao]|cuenta\s+interbancaria)\s*(?:n[°ºo.]*)?\s*[:#|.-]?\s*((?:\d[ -]?){20})(?!\d)/i;
export function parsePdfCliente(pages: PaginaPdfCliente[]): ResultadoPdfCliente {
  const result: ResultadoPdfCliente = { campos: { nombre: [], tipo_persona: [], ruc: [], documento: [], telefono: [], direccion: [], email: [] }, cuentas: [], advertencias: [], paginas: new Set(pages.map(p => p.pagina)).size };
  const add = (key: CampoPdfCliente, raw: string, page: PaginaPdfCliente, evidence: string) => {
    const valor = cleanValue(raw);
    if (noData(valor) || valor.length > (key === "direccion" ? 500 : 254)) return;
    const previous = result.campos[key].find(c => c.valor.toLocaleLowerCase("es") === valor.toLocaleLowerCase("es"));
    if (previous || result.campos[key].length >= 10) return;
    result.campos[key].push({ valor, pagina: page.pagina, evidencia: evidence.slice(0, 350), origen: page.origen });
  };
  for (const page of pages) {
    const lines = page.texto.slice(0, 180000).split(/\r?\n/).map(normal).filter(Boolean).slice(0, 1800);
    let current: CuentaCliente = { banco: "", moneda: "", numero: "", cci: "", titular: "" };
    let evidence: string[] = [];
    const finishAccount = () => {
      if ((current.numero || current.cci) && result.cuentas.length < 15) {
        const duplicate = result.cuentas.find(c => cuentasCompatiblesCliente(c.cuenta, current));
        if (duplicate) {
          const merged = combinarCuentasCliente([duplicate.cuenta], [current])[0];
          if (JSON.stringify(merged) !== JSON.stringify(duplicate.cuenta)) {
            duplicate.cuenta = merged; duplicate.evidencia = (duplicate.evidencia + " · " + evidence.join(" · ")).slice(0, 500);
            if (page.origen === "ocr") duplicate.origen = "ocr";
          }
        } else result.cuentas.push({ cuenta: { ...current }, pagina: page.pagina, evidencia: evidence.join(" · ").slice(0, 500), origen: page.origen });
      }
      current = { banco: current.banco, moneda: "", numero: "", cci: "", titular: current.titular };
      evidence = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], next = lines[i + 1] ?? "";
      const ruc = /\bR\.?\s*U\.?\s*C\.?\s*(?:n[°ºo.]*)?\s*[:#|.-]?\s*(\d[\d -]{9,18}\d)(?!\d)/i.exec(line);
      if (ruc) { const value = digits(ruc[1]); if (/^\d{11}$/.test(value)) add("ruc", value, page, line); }
      const dni = /\b(?:D\.?N\.?I\.?|documento(?: de identidad)?)\s*(?:n[°ºo.]*)?\s*[:#|.-]?\s*(\d{8})(?!\d)/i.exec(line);
      if (dni) add("documento", dni[1], page, line);
      const name = labeledValue(lines, i, /(?:raz[oó]n\s+social(?:\s+o\s+denominaci[oó]n)?|denominaci[oó]n(?:\s+o\s+raz[oó]n social)?|nombres?\s+y\s+apellidos|apellidos\s+y\s+nombres|nombre(?:s)?(?:\s+(?:del?\s+cliente|de\s+la\s+empresa|comercial))?)\s*[:|]\s*/i);
      if (name && /[a-záéíóúñ]/i.test(name)) add("nombre", name, page, line + (line.endsWith(":") ? " " + next : ""));
      // Ficha RUC: «Número de RUC: 20... - RAZÓN SOCIAL».
      if (ruc && /n[uú]mero de ruc/i.test(line)) {
        const after = line.slice((ruc.index ?? 0) + ruc[0].length).replace(/^\s*[-–—]\s*/, "");
        if (/[a-záéíóúñ]/i.test(after) && after.length > 3) add("nombre", after, page, line);
      }
      const phone = labeledValue(lines, i, /(?:tel[eé]fono(?:\s+fijo)?|celular|m[oó]vil|whatsapp)\s*[:|]\s*/i);
      if (phone) { const match = /^\+?[\d ()-]{7,22}/.exec(phone); if (match && match[0].replace(/\D/g, "").length >= 7) add("telefono", match[0], page, line); }
      const email = labeledValue(lines, i, /(?:correo(?:\s+electr[oó]nico)?|e-?mail)\s*[:|]\s*/i);
      const emailMatch = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(email);
      if (emailMatch) add("email", emailMatch[0], page, line);
      const address = labeledValue(lines, i, /(?:domicilio\s+fiscal|direcci[oó]n(?:\s+fiscal)?)\s*[:|]\s*/i);
      if (address) add("direccion", address, page, line + (line.endsWith(":") ? " " + next : ""));
      if (/\b(?:persona jur[ií]dica|sociedad an[oó]nima|empresa individual)\b/i.test(line)) add("tipo_persona", "empresa", page, line);
      if (/\bpersona natural\b/i.test(line)) add("tipo_persona", "natural", page, line);
      if (name && /\b(?:S\.?\s*A\.?\s*C\.?|E\.?\s*I\.?\s*R\.?\s*L\.?|S\.?\s*R\.?\s*L\.?)\b/i.test(name)) add("tipo_persona", "empresa", page, line);

      const bankLabel = labeledValue(lines, i, /(?:banco|entidad\s+financiera)\s*[:|]\s*/i);
      const knownBank = bank.exec(line);
      const bankName = bankLabel || (knownBank && line.length < 150 ? knownBank[1] : "");
      if (bankName && bankName.toLocaleLowerCase("es") !== current.banco.toLocaleLowerCase("es")) {
        finishAccount(); current = { banco: bankName, moneda: "", numero: "", cci: "", titular: "" }; evidence.push(line);
      }
      const currency: "" | "PEN" | "USD" = /(?:\b(?:USD|d[oó]lares(?: americanos)?)\b|US\$)/i.test(line) ? "USD" : /\b(?:PEN|soles|moneda nacional)\b/i.test(line) ? "PEN" : "";
      if (currency && (/moneda|cuenta|banco/i.test(line) || line.length < 50)) {
        if (current.moneda && current.moneda !== currency && (current.numero || current.cci)) finishAccount();
        current.moneda = currency; evidence.push(line);
      }
      const owner = labeledValue(lines, i, /titular(?:\s+(?:de\s+la\s+cuenta|de\s+cuenta))?\s*[:|]\s*/i);
      if (owner) { current.titular = owner; evidence.push(line); }
      const accountMatch = accountPattern.exec(line) ?? (/(?:cuenta|cci)/i.test(line) && line.endsWith(":") ? accountPattern.exec(line + " " + next) : null);
      if (accountMatch) {
        const number = digits(accountMatch[1]);
        if (/^\d{6,30}$/.test(number)) {
          if (current.numero && current.numero !== number) finishAccount();
          current.numero = number; evidence.push(line);
        }
      }
      const cci = cciPattern.exec(line) ?? (/(?:cci|interbancaria)/i.test(line) && line.endsWith(":") ? cciPattern.exec(line + " " + next) : null);
      if (cci) {
        const value = digits(cci[1]);
        if (current.cci && current.cci !== value) finishAccount();
        current.cci = value; evidence.push(line);
      }
    }
    finishAccount();
  }
  for (const key of Object.keys(result.campos) as CampoPdfCliente[]) {
    if (result.campos[key].length > 1) result.advertencias.push("Hay varios valores de " + PDF_CLIENTE_LABELS[key].toLocaleLowerCase("es") + "; elige el que corresponde.");
  }
  if (result.cuentas.some((entry, i) => result.cuentas.slice(0, i).some(other => esMismaReferenciaCuenta(entry.cuenta, other.cuenta)))) result.advertencias.push("Hay versiones distintas de una misma cuenta. Selecciona solo la que corresponde.");
  if (pages.some(p => p.origen === "ocr")) result.advertencias.push("Se leyó un escaneo. Revisa especialmente RUC, cuentas y CCI antes de guardar.");
  if (!Object.values(result.campos).some(c => c.length) && !result.cuentas.length) result.advertencias.push("No se identificaron datos de cliente. Puedes completar la ficha manualmente.");
  return result;
}

/** Reconstruye renglones por coordenadas; evita pegar columnas y números. */
export function pdfItemsToText(items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>): string {
  const rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];
  for (const item of items) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const x = item.transform?.[4] ?? 0, y = item.transform?.[5] ?? 0;
    let row = rows.find(r => Math.abs(r.y - y) <= 2);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, text: item.str });
  }
  return rows.sort((a, b) => b.y - a.y).map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.text).join(" ")).join("\n");
}
