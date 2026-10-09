export function documentoClienteError(tipo: "natural" | "empresa", value: string, obligatorio = true): string | null {
  const documento = value.trim();
  if (!documento) return obligatorio ? "Documento obligatorio." : null;
  const longitud = tipo === "empresa" ? 11 : 8;
  return new RegExp(`^\\d{${longitud}}$`).test(documento)
    ? null : `${tipo === "empresa" ? "RUC" : "DNI"} inválido: debe tener ${longitud} dígitos.`;
}

/** Conserva teléfonos fijos, móviles y prefijos internacionales, sin admitir letras. */
export function telefonoClienteError(value: string): string | null {
  const telefono = value.trim();
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(telefono) || digitos.length < 7 || digitos.length > 15) {
    return "Revisa el teléfono: usa entre 7 y 15 dígitos, con código de país si corresponde.";
  }
  return null;
}
