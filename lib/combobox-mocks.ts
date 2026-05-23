import type { Database } from "@/lib/supabase/types";

export type ClienteCompleto = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  direccion: string | null;
  ruc: string | null;
};

/** Convierte listas mínimas `{ id, nombre }` del servidor en filas para ClienteCombobox. */
export function liteClientesToCompleto(clientes: { id: string; nombre: string }[]): ClienteCompleto[] {
  return clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    documento: null,
    telefono: null,
    direccion: null,
    ruc: null,
  }));
}

/** Clientes con RUC opcional (contrato alquiler). */
export function contratoClientesToCompleto(
  clientes: { id: string; nombre: string; ruc?: string | null }[],
): ClienteCompleto[] {
  return clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    documento: null,
    telefono: null,
    direccion: null,
    ruc: c.ruc ?? null,
  }));
}

type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type InventarioRow = Database["public"]["Tables"]["inventario_productos"]["Row"];

/** Datos de ejemplo para desarrollo sin Supabase (8–10 ítems por tipo). */
export const MOCK_CLIENTES_COMPLETO: ClienteCompleto[] = [
  {
    id: "mock-cli-01",
    nombre: "Constructora Selva Norte SAC",
    documento: null,
    ruc: "20601234567",
    telefono: "942111222",
    direccion: "Jr. Lima 240, Tarapoto",
  },
  {
    id: "mock-cli-02",
    nombre: "Taller Carpintería Los Cedros",
    documento: null,
    ruc: "20559876543",
    telefono: "954333444",
    direccion: "Mz. H Lt. 12, Morales",
  },
  {
    id: "mock-cli-03",
    nombre: "María Quispe Huamán",
    documento: "41758293",
    ruc: null,
    telefono: "968555666",
    direccion: "Av. Salaverry 1180",
  },
  {
    id: "mock-cli-04",
    nombre: "Ing. Luis Mendoza",
    documento: "07654321",
    ruc: null,
    telefono: "913777888",
    direccion: "Calle Las Palmeras 45",
  },
  {
    id: "mock-cli-05",
    nombre: "Distribuidora Madera Sur EIRL",
    documento: null,
    ruc: "20607890123",
    telefono: "942999000",
    direccion: "Carretera Fernando Belaunde Km 3",
  },
  {
    id: "mock-cli-06",
    nombre: "Juan Pérez Flores",
    documento: "45892103",
    ruc: null,
    telefono: "923444555",
    direccion: "Jr. Comercio 89",
  },
  {
    id: "mock-cli-07",
    nombre: "Consorcio Vivienda San Pablo",
    documento: null,
    ruc: "20604561234",
    telefono: "967222333",
    direccion: "Urbanización El Paraíso Mz. A",
  },
  {
    id: "mock-cli-08",
    nombre: "Restaurante El Buen Sabor",
    documento: null,
    ruc: "20553441222",
    telefono: "956888999",
    direccion: "Malecón Tarapoto 300",
  },
];

export function mockClientesAsRows(orgId: string): ClienteRow[] {
  return MOCK_CLIENTES_COMPLETO.map((c, i) => ({
    id: c.id,
    organization_id: orgId,
    nombre: c.nombre,
    documento: c.documento,
    telefono: c.telefono,
    ruc: c.ruc,
    direccion: c.direccion,
    tipo_persona: c.ruc ? ("empresa" as const) : ("natural" as const),
    created_at: new Date(Date.now() - i * 3600_000).toISOString(),
  }));
}

/** Filas mínimas de inventario para mocks en cotización / alquiler. */
export const MOCK_INVENTARIO_PRODUCTOS: InventarioRow[] = MOCK_CLIENTES_COMPLETO.slice(0, 8).map((_, i) => {
  const especies = ["Cedro", "Mahogany", "Pino radiata", "Roble", "Isorel", "Melamine blanco", "MDF 18mm", "Triplex okume"];
  const unidades = ["PT", "m3", "plancha"] as const;
  const u = unidades[i % 3];
  return {
    id: `mock-inv-${String(i + 1).padStart(2, "0")}`,
    organization_id: "00000000-0000-0000-0000-000000000001",
    codigo: `MAD-${100 + i}`,
    nombre: `Tabla ${especies[i % especies.length]} 2×6×8`,
    categoria: "madera",
    unidad: u,
    stock_actual: 120 + i * 15,
    stock_minimo: 10,
    activo: true,
    created_at: new Date().toISOString(),
    foto_url: null,
    costo_unitario: null,
  };
});

/** Catálogo de muebles terminados (venta). */
export const MOCK_MUEBLES_CATALOGO_VENTA = [
  { id: "mock-mcat-01", codigo: "MT-101", nombre: "Ropero 3 puertas melamine", precio_lista: 2800, stock_disponible: 4 },
  { id: "mock-mcat-02", codigo: "MT-102", nombre: "Escritorio ejecutivo cedro", precio_lista: 1450, stock_disponible: 2 },
  { id: "mock-mcat-03", codigo: "MT-103", nombre: "Repostero 2.40 m", precio_lista: 3200, stock_disponible: 0 },
  { id: "mock-mcat-04", codigo: "MT-104", nombre: "Zapatero 5 niveles", precio_lista: 680, stock_disponible: 12 },
  { id: "mock-mcat-05", codigo: "MT-105", nombre: "Mesa comedor 8 puestos", precio_lista: 2100, stock_disponible: 1 },
  { id: "mock-mcat-06", codigo: "MT-106", nombre: "Vitrina vidrio templado", precio_lista: 1750, stock_disponible: 3 },
  { id: "mock-mcat-07", codigo: "MT-107", nombre: "Cama 2 plazas + veladores", precio_lista: 1950, stock_disponible: 5 },
  { id: "mock-mcat-08", codigo: "MT-108", nombre: "Biblioteca modular", precio_lista: 2400, stock_disponible: 2 },
] as const;

export type MuebleCatalogoMockRow = (typeof MOCK_MUEBLES_CATALOGO_VENTA)[number];

/** Cotizaciones listas para aprobar → orden. */
export const MOCK_COTIZACIONES_APROBACION = [
  { id: "mock-apr-01", label: "COT-2026-0042 · Ropero empotrado · S/ 4 200" },
  { id: "mock-apr-02", label: "COT-2026-0043 · Cocina integral · S/ 8 900" },
  { id: "mock-apr-03", label: "COT-2026-0044 · Puertas interior · S/ 1 350" },
  { id: "mock-apr-04", label: "COT-2026-0045 · Clóset walk-in · S/ 6 100" },
  { id: "mock-apr-05", label: "COT-2026-0046 · Barra desayuno · S/ 2 400" },
  { id: "mock-apr-06", label: "COT-2026-0047 · Mueble TV · S/ 980" },
  { id: "mock-apr-07", label: "COT-2026-0048 · Escalera interior · S/ 3 300" },
  { id: "mock-apr-08", label: "COT-2026-0049 · Panel melamine · S/ 720" },
];

export const MOCK_EMPLEADOS = [
  { id: "mock-emp-01", nombre: "Carlos Mendoza López" },
  { id: "mock-emp-02", nombre: "Rosa Quispe Huamán" },
  { id: "mock-emp-03", nombre: "Pedro Vásquez Ríos" },
  { id: "mock-emp-04", nombre: "Ana María Torres" },
  { id: "mock-emp-05", nombre: "Luis Figueroa Castro" },
  { id: "mock-emp-06", nombre: "Jorge Saldaña Prado" },
  { id: "mock-emp-07", nombre: "Maribel Ortiz Paredes" },
  { id: "mock-emp-08", nombre: "Henry Ruiz Sandoval" },
];

export const MOCK_CATEGORIAS_REGISTRO = [
  { id: "mock-reg-cat-01", nombre: "Operaciones diarias" },
  { id: "mock-reg-cat-02", nombre: "Mantenimiento equipo" },
  { id: "mock-reg-cat-03", nombre: "Compras urgentes" },
  { id: "mock-reg-cat-04", nombre: "Seguridad y EPP" },
  { id: "mock-reg-cat-05", nombre: "Capacitación" },
  { id: "mock-reg-cat-06", nombre: "Visita cliente / obra" },
  { id: "mock-reg-cat-07", nombre: "Logística y fletes" },
  { id: "mock-reg-cat-08", nombre: "Otros gastos" },
];

/** Opciones de categoría para eliminar datos (admin respaldo). Misma lista que los `<option>` legacy. */
export const RESPALDO_CATEGORIA_OPTIONS: { value: string; label: string }[] = [
  { value: "caja", label: "Caja" },
  { value: "clientes", label: "Clientes" },
  { value: "proveedores", label: "Proveedores" },
  { value: "ventas", label: "Ventas" },
  { value: "cotizaciones", label: "Cotizaciones" },
  { value: "cotizacionesUnificadas", label: "Cotizaciones unificadas" },
  { value: "comprasMadera", label: "Compras de madera" },
  { value: "inventarioProductos", label: "Inventario productos" },
  { value: "inventarioMovimientos", label: "Inventario movimientos" },
  { value: "alquileres", label: "Alquileres" },
  { value: "empleados", label: "Empleados" },
  { value: "adelantos", label: "Adelantos" },
  { value: "sueldos", label: "Sueldos" },
  { value: "ordenesProduccion", label: "Órdenes de producción" },
  { value: "mueblesCatalogo", label: "Catálogo de muebles" },
  { value: "ventasMuebleTerminado", label: "Ventas de muebles terminados" },
  { value: "serviciosAserradero", label: "Servicios de aserradero" },
  { value: "registrosGenerales", label: "Registros generales" },
  { value: "zonasEntrega", label: "Zonas de entrega" },
];

/** Choferes demo — entrega / logística. */
export const MOCK_CHOFERES = [
  { id: "mock-chof-01", nombre: "Renato Salazar", telefono: "987651234", placa: "T9K-481" },
  { id: "mock-chof-02", nombre: "Elmer Huamán", telefono: "956221009", placa: "A2P-902" },
  { id: "mock-chof-03", nombre: "David Castillo", telefono: "944388112", placa: "C7M-115" },
  { id: "mock-chof-04", nombre: "Julio Prado", telefono: "933701455", placa: "B4R-330" },
  { id: "mock-chof-05", nombre: "Marcos Delgado", telefono: "919882300", placa: "L8N-674" },
  { id: "mock-chof-06", nombre: "Wilson Aguirre", telefono: "902441788", placa: "Q1W-209" },
];

/** Zonas de entrega tipo Lima / Callao — tarifa referencial. */
export const MOCK_ZONAS_ENTREGA = [
  { id: "mock-zona-01", nombre: "Lima Norte — Carabayllo / Puente Piedra", tarifa: 85, distancia_km: 18 },
  { id: "mock-zona-02", nombre: "Lima Este — Ate / Santa Clara / Chaclacayo", tarifa: 95, distancia_km: 22 },
  { id: "mock-zona-03", nombre: "Lima Sur — Villa El Salvador / Lurín", tarifa: 110, distancia_km: 35 },
  { id: "mock-zona-04", nombre: "Callao — aeropuerto / Ventanilla", tarifa: 75, distancia_km: 15 },
  { id: "mock-zona-05", nombre: "Miraflores / Surco / Barranco", tarifa: 55, distancia_km: 8 },
  { id: "mock-zona-06", nombre: "Los Olivos / Independencia / San Martín", tarifa: 65, distancia_km: 12 },
  { id: "mock-zona-07", nombre: "San Juan de Lurigancho — zona alta", tarifa: 90, distancia_km: 25 },
  { id: "mock-zona-08", nombre: "La Molina / Monterrico / Sur oriente", tarifa: 70, distancia_km: 14 },
];

/**
 * Plantillas guardadas demo para cotización unificada (estructura compatible con `MuebleTemplate` en el wizard).
 * El wizard las fusiona con las del localStorage cuando `mockData` está activo.
 */
export const MOCK_WIZARD_MUEBLE_PLANTILLAS = [
  {
    id: "mock-wtpl-ropero",
    name: "Ropero 2P — estándar taller",
    tipoMuebleVista: "mock-mcat-01",
    unidadEspesorUI: "cm" as const,
    unidadAnchoUI: "cm" as const,
    unidadLargoUI: "cm" as const,
    medidaEspesorUI: "2",
    medidaAnchoUI: "180",
    medidaLargoUI: "220",
    tipoMaderaUI: "mock-inv-01",
    precioVentaPtUI: "22",
    acabadoUI: "laca",
    acabadoOtroUI: "",
    costoAcabadoSolesUI: "180",
    pagoMetodoUI: "transferencia" as const,
    pagoModalidadUI: "adelanto" as const,
    plazoDiasUI: "30",
    plazoUnidadUI: "dias" as const,
  },
  {
    id: "mock-wtpl-cocina",
    name: "Módulo cocina 3 m — demo",
    tipoMuebleVista: "mock-mcat-03",
    unidadEspesorUI: "cm" as const,
    unidadAnchoUI: "cm" as const,
    unidadLargoUI: "cm" as const,
    medidaEspesorUI: "1.8",
    medidaAnchoUI: "300",
    medidaLargoUI: "90",
    tipoMaderaUI: "mock-inv-02",
    precioVentaPtUI: "25",
    acabadoUI: "colores",
    acabadoOtroUI: "",
    costoAcabadoSolesUI: "420",
    pagoMetodoUI: "efectivo" as const,
    pagoModalidadUI: "contado" as const,
    plazoDiasUI: "15",
    plazoUnidadUI: "dias" as const,
  },
  {
    id: "mock-wtpl-escritorio",
    name: "Escritorio ejecutivo — demo",
    tipoMuebleVista: "mock-mcat-02",
    unidadEspesorUI: "cm" as const,
    unidadAnchoUI: "cm" as const,
    unidadLargoUI: "cm" as const,
    medidaEspesorUI: "3",
    medidaAnchoUI: "140",
    medidaLargoUI: "75",
    tipoMaderaUI: "mock-inv-03",
    precioVentaPtUI: "28",
    acabadoUI: "barniz",
    acabadoOtroUI: "",
    costoAcabadoSolesUI: "95",
    pagoMetodoUI: "yape" as const,
    pagoModalidadUI: "credito" as const,
    plazoDiasUI: "45",
    plazoUnidadUI: "dias" as const,
  },
  {
    id: "mock-wtpl-minimal",
    name: "Plantilla mínima (medidas en blanco)",
    tipoMuebleVista: "",
    unidadEspesorUI: "cm" as const,
    unidadAnchoUI: "cm" as const,
    unidadLargoUI: "cm" as const,
    medidaEspesorUI: "",
    medidaAnchoUI: "",
    medidaLargoUI: "",
    tipoMaderaUI: "",
    precioVentaPtUI: "0",
    acabadoUI: "",
    acabadoOtroUI: "",
    costoAcabadoSolesUI: "0",
    pagoMetodoUI: "efectivo" as const,
    pagoModalidadUI: "" as const,
    plazoDiasUI: "15",
    plazoUnidadUI: "dias" as const,
  },
];

/** Plantillas técnicas demo para `QuoteDualFlow` (localStorage + mock). */
export const MOCK_QUOTE_TEMPLATES = [
  {
    id: "mock-qtpl-1",
    name: "Módulo melamine — 2 tableros",
    rows: [
      { especie: "Melamine blanco", espesorIn: "0.75", anchoIn: "48", largoFt: "8", cantidad: "2" },
    ],
  },
  {
    id: "mock-qtpl-2",
    name: "Cortes cedro — paquete estándar",
    rows: [
      { especie: "Cedro nacional", espesorIn: "1", anchoIn: "8", largoFt: "12", cantidad: "4" },
      { especie: "Cedro nacional", espesorIn: "1", anchoIn: "6", largoFt: "10", cantidad: "6" },
    ],
  },
  {
    id: "mock-qtpl-3",
    name: "Listones pino — refuerzos",
    rows: [{ especie: "Pino radiata", espesorIn: "0.5", anchoIn: "4", largoFt: "10", cantidad: "12" }],
  },
];
