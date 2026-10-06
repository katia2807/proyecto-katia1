export const CLIENTE_ESTADOS = { activo: "Activo", inactivo: "Inactivo", moroso: "Moroso", vip: "VIP" } as const;
export type ClienteEstado = keyof typeof CLIENTE_ESTADOS;

export function etiquetaEstadoCliente(estado?: string | null) {
  return CLIENTE_ESTADOS[estado as ClienteEstado] ?? "Sin estado";
}

export function etiquetaTipoCliente(tipo?: string | null) {
  return tipo === "empresa" ? "Empresa" : tipo === "natural" ? "Persona natural" : "Sin especificar";
}

export function documentoCliente(cliente: { documento?: string | null; ruc?: string | null }) {
  return cliente.documento?.trim() || cliente.ruc?.trim() || "Sin documento";
}

export type ClienteFiltros = { tab: "compradores" | "base_datos"; q: string; tipo: string; estado: string };
type Param = string | string[] | undefined;
export function filtrosClientes(params?: { tab?: Param; q?: Param; tipo?: Param; estado?: Param }): ClienteFiltros {
  const first = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const tipo = first(params?.tipo);
  const estado = first(params?.estado);
  return {
    tab: first(params?.tab) === "base_datos" ? "base_datos" : "compradores",
    q: first(params?.q),
    tipo: ["natural", "empresa"].includes(tipo) ? tipo : "",
    estado: Object.hasOwn(CLIENTE_ESTADOS, estado) ? estado : "",
  };
}

export function clientesHref(filtros: ClienteFiltros) {
  const params = new URLSearchParams();
  if (filtros.tab !== "compradores") params.set("tab", filtros.tab);
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (filtros.estado) params.set("estado", filtros.estado);
  return `/ventas/clientes${params.size ? `?${params}` : ""}`;
}

export function safeClientesReturn(raw?: Param) {
  try {
    const url = new URL((Array.isArray(raw) ? raw[0] : raw) ?? "", "https://katia.local");
    if (url.origin === "https://katia.local" && url.pathname === "/ventas/clientes") {
      return clientesHref(filtrosClientes(Object.fromEntries(url.searchParams)));
    }
  } catch { /* Un regreso inválido conserva el listado local como destino. */ }
  return "/ventas/clientes";
}

export function coincideCliente(cliente: { nombre: string; documento?: string | null; ruc?: string | null; telefono?: string | null; tipo_persona?: string | null; estado?: string | null }, filtros: ClienteFiltros) {
  const q = filtros.q.toLocaleLowerCase("es");
  return (!q || [cliente.nombre, cliente.documento, cliente.ruc, cliente.telefono].some(v => v?.toLocaleLowerCase("es").includes(q))) &&
    (!filtros.tipo || cliente.tipo_persona === filtros.tipo) && (!filtros.estado || cliente.estado === filtros.estado);
}

export function importeCliente(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
