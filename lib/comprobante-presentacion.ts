type ClienteComprobanteSource = { nombre?: string | null; documento?: string | null; ruc?: string | null };
const text = (value?: string | null) => value?.trim() || null;
const documentoVisible = (value?: string | null) => {
  const clean = text(value);
  return clean && !/^PEND-/i.test(clean) ? clean : null;
};

/** Presentación solamente: conserva los datos reales y no imprime identificadores provisionales. */
export function clienteParaComprobante(cliente?: ClienteComprobanteSource | null, nombreFallback = "—") {
  const ruc = documentoVisible(cliente?.ruc);
  const documento = ruc ?? documentoVisible(cliente?.documento);
  const tipoDocumento: "RUC" | "DNI" | "Documento" | null = ruc ? "RUC" : documento?.length === 8 ? "DNI" : documento ? "Documento" : null;
  return { nombre: text(cliente?.nombre) ?? nombreFallback, documento, tipoDocumento };
}

export function entregaParaComprobante(value?: string | null) {
  const clean = text(value);
  if (!clean || clean === "—") return "—";
  const separator = clean.indexOf(" — ");
  const tipo = separator >= 0 ? clean.slice(0, separator) : clean;
  const suffix = separator >= 0 ? clean.slice(separator) : "";
  const labels: Record<string, string> = {
    entrega_local: "Entrega en local", entrega_en_local: "Entrega en local",
    puesto_en_obra: "Puesto en obra", envio: "Envío", envío: "Envío", recojo: "Recojo",
  };
  const key = tipo.toLocaleLowerCase("es-PE").replace(/\s+/g, "_");
  return (labels[key] ?? tipo) + suffix;
}
