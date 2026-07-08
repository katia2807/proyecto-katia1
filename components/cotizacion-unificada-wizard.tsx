"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createClienteCotizacionRapida,
  deleteCotizacionUnificada,
  marcarListaProduccionCotizacion,
  pasarCotizacionAProduccion,
  registrarCobroCotizacionUnificada,
  saveCotizacionUnificada,
  cambiarEstadoCotizacionUnificada,
} from "@/app/actions";
import {
  computeEconomiaInterna,
  computeResumenMargen,
  computeTotalesDetalle,
  economiaLineaMueble,
  round2,
  totalPtLinea,
  totalGeneralDetalle,
} from "@/lib/cotizacion-calculos";
import {
  defaultCotizacionDetalleV1,
  parseCotizacionDetalle,
  type CotizacionDetalleV1,
  type MuebleLineaMadera,
  type MuebleLineaPieza,
} from "@/lib/cotizacion-unificada-payload";
import { CotizacionResumenFormal } from "@/components/sales/cotizacion-resumen-formal";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Combobox } from "@/components/ui/Combobox";
import { buildLineasResumen } from "@/lib/cotizacion-unificada-lineas";
import type { ClienteCompleto } from "@/lib/combobox-mocks";
import {
  MOCK_INVENTARIO_PRODUCTOS,
  MOCK_MUEBLES_CATALOGO_VENTA,
  MOCK_WIZARD_MUEBLE_PLANTILLAS,
  mockClientesAsRows,
} from "@/lib/combobox-mocks";
import type { EmpresaConfig } from "@/lib/company-config";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { formatPen, parseDecimal } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type InventarioProductoRow = Database["public"]["Tables"]["inventario_productos"]["Row"];
type MuebleCatalogoRow = Database["public"]["Tables"]["muebles_catalogo"]["Row"];
type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type CotizacionUnificadaRow = Database["public"]["Tables"]["cotizaciones_unificadas"]["Row"];

type CotizacionUnificadaWizardProps = {
  canSave: boolean;
  /** Siguiente N° de cotización (solo lectura; se calcula en el servidor). */
  correlativoPreview: string;
  productos: InventarioProductoRow[];
  mueblesCatalogo: MuebleCatalogoRow[];
  clientes: ClienteRow[];
  cotizacionesGuardadas: CotizacionUnificadaRow[];
  empresa: EmpresaConfig;
  /** Usa datos mock locales para combobox / inventario (desarrollo sin Supabase). */
  mockData?: boolean;
};

function clienteRowToCompleto(r: ClienteRow): ClienteCompleto {
  return {
    id: r.id,
    nombre: r.nombre,
    documento: r.documento,
    telefono: r.telefono,
    direccion: r.direccion,
    ruc: r.ruc,
  };
}

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]/60 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";
const panelClass =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5";
const pillClass =
  "rounded-full border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-5 py-2 text-sm font-semibold text-[var(--color-text-primary)]";
const navBtnClass =
  "h-10 min-w-28 rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:brightness-110";
const navBtnSecondaryClass =
  "h-10 min-w-28 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-soft)] hover:brightness-105";
const MUEBLE_TEMPLATES_KEY = "cotizacion_muebles_templates_v1";
const COTIZACION_DRAFT_KEY = "cotizacion_unificada_draft_v1";
const WIZARD_TEMPLATES_EVENT = "katia:cotizacion-templates-changed";
const WIZARD_DRAFT_EVENT = "katia:cotizacion-draft-changed";

function subscribeWizardTemplates(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => { };
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(WIZARD_TEMPLATES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(WIZARD_TEMPLATES_EVENT, handler);
  };
}

function emitWizardTemplatesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WIZARD_TEMPLATES_EVENT));
}

function subscribeWizardDraft(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => { };
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(WIZARD_DRAFT_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(WIZARD_DRAFT_EVENT, handler);
  };
}

function emitWizardDraftChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WIZARD_DRAFT_EVENT));
}

type MuebleTemplate = {
  id: string;
  name: string;
  tipoMuebleVista: string;
  unidadEspesorUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  unidadAnchoUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  unidadLargoUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  medidaEspesorUI: string;
  medidaAnchoUI: string;
  medidaLargoUI: string;
  tipoMaderaUI: string;
  precioVentaPtUI: string;
  acabadoUI: string;
  acabadoOtroUI: string;
  costoAcabadoSolesUI: string;
  costoManoObraUI?: string;
  pagoMetodoUI: "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro";
  pagoModalidadUI: "" | "contado" | "adelanto" | "adelanto_saldo" | "credito";
  plazoDiasUI: string;
  plazoUnidadUI: "dias" | "meses";
};

type CotizacionDraft = {
  savedAt: string;
  tipoCliente: "natural" | "empresa";
  nombreCliente: string;
  documento: string;
  telefono: string;
  direccion: string;
  fecha: string;
  tipoCotizacionPreset: "muebles" | "aserradero" | "alquiler" | "general";
  unidadEspesorUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  unidadAnchoUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  unidadLargoUI: "" | "mm" | "cm" | "m" | "in" | "ft";
  medidaEspesorUI: string;
  medidaAnchoUI: string;
  medidaLargoUI: string;
  tipoMuebleVista: string;
  tipoMaderaUI: string;
  precioVentaPtUI: string;
  acabadoUI: string;
  acabadoOtroUI: string;
  costoAcabadoSolesUI: string;
  costoManoObraUI?: string;
  pagoMetodoUI: "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro";
  pagoModalidadUI: "" | "contado" | "adelanto" | "adelanto_saldo" | "credito";
  plazoDiasUI: string;
  plazoUnidadUI: "dias" | "meses";
};

function newId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyPieza(): MuebleLineaPieza {
  return {
    id: newId(),
    cantidad: 1,
    espesor: 0,
    ancho: 0,
    largo: 0,
    descripcion: "Pieza",
  };
}

function emptyLineaMadera(): MuebleLineaMadera {
  return {
    id: newId(),
    inventario_producto_id: null,
    especie_label: "",
    piezas: [emptyPieza()],
    precioPorPt: 0,
  };
}

function toInches(value: number, unit: "" | "mm" | "cm" | "m" | "in" | "ft") {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === "mm") return value / 25.4;
  if (unit === "cm") return value / 2.54;
  if (unit === "m") return value * 39.37007874;
  if (unit === "ft") return value * 12;
  return value;
}

function parseDecimalInput(value: string) {
  return parseDecimal(value);
}

function ptUnitarioPieza(pieza: Pick<MuebleLineaPieza, "espesor" | "ancho" | "largo">) {
  return (pieza.espesor * pieza.ancho * pieza.largo) / 12;
}

function ptTotalPieza(pieza: Pick<MuebleLineaPieza, "cantidad" | "espesor" | "ancho" | "largo">) {
  return ptUnitarioPieza(pieza) * pieza.cantidad;
}

function toFeet(value: number, unit: "" | "mm" | "cm" | "m" | "in" | "ft") {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === "mm") return value / 304.8;
  if (unit === "cm") return value / 30.48;
  if (unit === "m") return value * 3.280839895;
  if (unit === "in") return value / 12;
  return value;
}

/** Convierte pulgadas (valor almacenado) a la unidad de UI elegida */
function inchesToUI(valueIn: number, unit: "" | "mm" | "cm" | "m" | "in" | "ft") {
  if (!Number.isFinite(valueIn) || valueIn <= 0) return "";
  if (unit === "mm") return String(round2(valueIn * 25.4));
  if (unit === "cm") return String(round2(valueIn * 2.54));
  if (unit === "m") return String(round2(valueIn / 39.37007874));
  if (unit === "ft") return String(round2(valueIn / 12));
  return String(round2(valueIn));
}

/** Convierte pies (valor almacenado) a la unidad de UI elegida */
function feetToUI(valueFt: number, unit: "" | "mm" | "cm" | "m" | "in" | "ft") {
  if (!Number.isFinite(valueFt) || valueFt <= 0) return "";
  if (unit === "mm") return String(round2(valueFt * 304.8));
  if (unit === "cm") return String(round2(valueFt * 30.48));
  if (unit === "m") return String(round2(valueFt / 3.280839895));
  if (unit === "in") return String(round2(valueFt * 12));
  return String(round2(valueFt));
}

function isWoodCategory(categoria: string | null | undefined) {
  const c = (categoria ?? "").trim().toLowerCase();
  return c === "madera" || c.includes("madera");
}

function isMuebleCategory(categoria: string | null | undefined) {
  const c = (categoria ?? "").trim().toLowerCase();
  return c === "mueble" || c.includes("mueble");
}

function stripDimensionesMadera(nombre: string | null | undefined) {
  const base = (nombre ?? "").trim();
  if (!base) return "Material";
  // Quita segmentos tipo "2x5x240", "2 x 5 x 240", etc. para mostrar solo el material.
  return base.replace(/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function formatoPiesDisponibles(stock: number, unidad: string | null | undefined) {
  const u = (unidad ?? "").toLowerCase();
  if (u.includes("pt") || u.includes("pie")) return `${stock} ${unidad}`;
  return `${stock} PT`;
}

function safeMoney(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function isEmpresaClienteRow(cliente: ClienteRow) {
  if (cliente.tipo_persona === "empresa") return true;
  if (cliente.tipo_persona === "natural") return false;
  const doc = (cliente.documento ?? "").replace(/\D/g, "");
  if (doc.length === 11) return true; // RUC usual
  if (doc.length === 8) return false; // DNI usual
  const name = (cliente.nombre ?? "").toLowerCase();
  return (
    name.includes("sac") ||
    name.includes("s.a.c") ||
    name.includes("srl") ||
    name.includes("eirl") ||
    name.includes("consorcio") ||
    name.includes("empresa")
  );
}

function normalizeDoc(value: string) {
  return value.replace(/\D/g, "");
}

function validateDocumentoByTipo(tipo: "natural" | "empresa", rawDocumento: string) {
  const doc = normalizeDoc(rawDocumento);
  if (!doc) return "Documento obligatorio.";
  if (tipo === "natural") {
    if (doc.length !== 8) return "DNI inválido: debe tener 8 dígitos.";
    return "";
  }
  if (doc.length !== 11) return "RUC inválido: debe tener 11 dígitos.";
  return "";
}

function getDefaultGerenciaTemplate(): MuebleTemplate {
  return {
    id: "gerencia-demo-template",
    name: "Plantilla Gerencia (prueba)",
    tipoMuebleVista: "ejemplo-ropero",
    unidadEspesorUI: "cm",
    unidadAnchoUI: "cm",
    unidadLargoUI: "cm",
    medidaEspesorUI: "2",
    medidaAnchoUI: "60",
    medidaLargoUI: "200",
    tipoMaderaUI: "",
    precioVentaPtUI: "18",
    acabadoUI: "barniz",
    acabadoOtroUI: "",
    costoAcabadoSolesUI: "0",
    pagoMetodoUI: "efectivo",
    pagoModalidadUI: "contado",
    plazoDiasUI: "15",
    plazoUnidadUI: "dias",
  };
}

function loadMuebleTemplatesFromStorage(): MuebleTemplate[] {
  if (typeof window === "undefined") return [getDefaultGerenciaTemplate()];
  try {
    const raw = localStorage.getItem(MUEBLE_TEMPLATES_KEY);
    if (!raw) return [getDefaultGerenciaTemplate()];
    const parsed = JSON.parse(raw) as MuebleTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [getDefaultGerenciaTemplate()];
    return parsed;
  } catch {
    return [getDefaultGerenciaTemplate()];
  }
}

function loadDraftFromStorage(): CotizacionDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COTIZACION_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CotizacionDraft;
  } catch {
    return null;
  }
}

// ─── Componente auxiliar: nuevo cliente rápido dentro del wizard ─────────────
function NuevoClienteRapidoInline({
  onCreated,
}: {
  onCreated: (nombre: string, documento: string, telefono: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)]"
      >
        + Nuevo cliente rápido
      </button>
    );
  }

  async function handleSave() {
    if (!nombre.trim()) { setErr("El nombre es obligatorio."); return; }
    setLoading(true);
    setErr("");
    try {
      const res = await createClienteCotizacionRapida({
        nombre: nombre.trim(),
        documento: documento.trim(),
        telefono: telefono.trim(),
        direccion: "",
        tipoPersona: "natural",
      });
      if (!res.ok) { setErr(res.error); return; }
      onCreated(nombre.trim(), documento.trim(), telefono.trim());
      setNombre(""); setDocumento(""); setTelefono("");
      setOpen(false);
    } catch {
      setErr("Error al crear el cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-primary-soft)]/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Agregar nuevo cliente</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setErr(""); }}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Cancelar
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 sm:col-span-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Nombre *</span>
          <input
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: María Quispe"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">DNI / Documento</span>
          <input
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="DNI"
            inputMode="numeric"
            maxLength={11}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Teléfono</span>
          <input
            className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="999 999 999"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="h-10 w-full rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-[var(--color-danger)]">{err}</p> : null}
      <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">El cliente se registra en la base de datos. Puedes completar más datos luego en la sección Clientes.</p>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function CotizacionUnificadaWizard({
  canSave,
  correlativoPreview,
  productos,
  mueblesCatalogo,
  clientes,
  cotizacionesGuardadas,
  empresa,
  mockData = false,
}: CotizacionUnificadaWizardProps) {
  const effectiveClientes = useMemo(
    () => ((mockData && clientes.length === 0) ? mockClientesAsRows(DEFAULT_ORG_ID) : clientes),
    [mockData, clientes],
  );
  const effectiveProductos = useMemo(
    () => ((mockData && productos.length === 0) ? MOCK_INVENTARIO_PRODUCTOS : productos),
    [mockData, productos],
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const editarId = searchParams.get("editar");
  const [tipoCliente, setTipoCliente] = useState<"natural" | "empresa">("natural");
  const [nombreCliente, setNombreCliente] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [detalle, setDetalle] = useState<CotizacionDetalleV1>(() => {
    const d = defaultCotizacionDetalleV1();
    d.rubros.muebles = true;
    d.muebles_lineas = [emptyLineaMadera()];
    return d;
  });
  const [guardadaId, setGuardadaId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tipoCotizacionPreset, setTipoCotizacionPreset] = useState<
    "muebles" | "aserradero" | "alquiler" | "general"
  >("muebles");
  const [unidadEspesorUI, setUnidadEspesorUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [unidadAnchoUI, setUnidadAnchoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [unidadLargoUI, setUnidadLargoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [medidaEspesorUI, setMedidaEspesorUI] = useState("");
  const [medidaAnchoUI, setMedidaAnchoUI] = useState("");
  const [medidaLargoUI, setMedidaLargoUI] = useState("");
  const [selectedPiezaIndexUI, setSelectedPiezaIndexUI] = useState(0);
  const [tipoMuebleVista, setTipoMuebleVista] = useState("");
  const [tipoMaderaUI, setTipoMaderaUI] = useState("");
  const [precioVentaPtUI, setPrecioVentaPtUI] = useState("");
  const [acabadoUI, setAcabadoUI] = useState("");
  const [acabadoOtroUI, setAcabadoOtroUI] = useState("");
  const [costoAcabadoSolesUI, setCostoAcabadoSolesUI] = useState("0");
  const [costoManoObraUI, setCostoManoObraUI] = useState("0");
  const [pagoMetodoUI, setPagoMetodoUI] = useState<
    "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro"
  >("efectivo");
  const [pagoModalidadUI, setPagoModalidadUI] = useState<"" | "contado" | "adelanto" | "adelanto_saldo" | "credito">("");
  const [plazoDiasUI, setPlazoDiasUI] = useState("15");
  const [plazoUnidadUI, setPlazoUnidadUI] = useState<"dias" | "meses">("dias");
  const [montoAdelantoUI, setMontoAdelantoUI] = useState("");
  const [asrUnidadEspesorUI, setAsrUnidadEspesorUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrUnidadAnchoUI, setAsrUnidadAnchoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrUnidadLargoUI, setAsrUnidadLargoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrMedidaEspesorUI, setAsrMedidaEspesorUI] = useState("");
  const [asrMedidaAnchoUI, setAsrMedidaAnchoUI] = useState("");
  const [asrMedidaLargoUI, setAsrMedidaLargoUI] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterEstado, setFilterEstado] = useState<
    | "todos"
    | "pendiente"
    | "lista_produccion"
    | "produccion"
    | "terminado"
    | "entregado"
    | "cobrada"
    | "inactivo"
    | "deudor"
  >("todos");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  /** Misma lista en servidor y primer paint cliente; luego se sincroniza con localStorage en useEffect. */
  const [muebleTemplates, setMuebleTemplates] = useState<MuebleTemplate[]>(() => [getDefaultGerenciaTemplate()]);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [descripcionManual, setDescripcionManual] = useState<string>("");
  const [isDescriptionInitialized, setIsDescriptionInitialized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  useEffect(() => {
    setIsClient(true);
    setMuebleTemplates(loadMuebleTemplatesFromStorage());
    setDraftSavedAt(loadDraftFromStorage()?.savedAt ?? null);
    const unsubTemplates = subscribeWizardTemplates(() => {
      setMuebleTemplates(loadMuebleTemplatesFromStorage());
    });
    const unsubDraft = subscribeWizardDraft(() => {
      setDraftSavedAt(loadDraftFromStorage()?.savedAt ?? null);
    });
    return () => {
      unsubTemplates();
      unsubDraft();
    };
  }, []);
  const [selectedMuebleTemplateId, setSelectedMuebleTemplateId] = useState("");

  const docLabel = tipoCliente === "empresa" ? "RUC" : "DNI";
  const docErrorLive = useMemo(() => {
    if (!documento.trim()) return "";
    return validateDocumentoByTipo(tipoCliente, documento);
  }, [documento, tipoCliente]);
  const canSaveCurrentAsTemplate = useMemo(
    () =>
      Boolean(
        tipoMuebleVista ||
        medidaEspesorUI ||
        medidaAnchoUI ||
        medidaLargoUI ||
        tipoMaderaUI ||
        precioVentaPtUI ||
        acabadoUI ||
        costoAcabadoSolesUI !== "0" ||
        costoManoObraUI !== "0" ||
        pagoModalidadUI,
      ),
    [
      acabadoUI,
      costoAcabadoSolesUI,
      costoManoObraUI,
      medidaAnchoUI,
      medidaEspesorUI,
      medidaLargoUI,
      pagoModalidadUI,
      precioVentaPtUI,
      tipoMaderaUI,
      tipoMuebleVista,
    ],
  );

  const applyCotizacionPreset = useCallback(
    (preset: "muebles" | "aserradero" | "alquiler" | "general") => {
      setTipoCotizacionPreset(preset);
      setDetalle((d) => {
        const rubros =
          preset === "general"
            ? { muebles: true, aserradero: true, alquiler: true }
            : {
              muebles: preset === "muebles",
              aserradero: preset === "aserradero",
              alquiler: preset === "alquiler",
            };
        return {
          ...d,
          rubros,
          muebles_lineas: rubros.muebles && d.muebles_lineas.length === 0 ? [emptyLineaMadera()] : d.muebles_lineas,
          aserradero: rubros.aserradero ? (d.aserradero ?? defaultCotizacionDetalleV1().aserradero) : d.aserradero,
          alquiler: rubros.alquiler ? (d.alquiler ?? defaultCotizacionDetalleV1().alquiler) : d.alquiler,
        };
      });
    },
    [],
  );

  const steps = useMemo(() => {
    const base: string[] = ["cliente", "rubros"];
    if (detalle.rubros.muebles) base.push("muebles");
    if (detalle.rubros.aserradero) base.push("aserradero");
    if (detalle.rubros.alquiler) base.push("alquiler");
    base.push("resumen");
    return base;
  }, [detalle.rubros]);

  const effectiveStepIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStepId = steps[effectiveStepIndex] ?? "cliente";

  const margenGananciaPct = empresa.margen_ganancia_default_pct;
  const totales = useMemo(() => computeTotalesDetalle(detalle), [detalle]);
  const resumenMargen = useMemo(
    () => computeResumenMargen(detalle, margenGananciaPct),
    [detalle, margenGananciaPct],
  );
  const totalGral = resumenMargen.precioSugerido;
  const totalGralSafe = Number.isFinite(totalGral) ? totalGral : 0;
  const economiaInterna = useMemo(() => computeEconomiaInterna(detalle), [detalle]);
  const conversionMedidasUI = useMemo(() => {
    const esp = parseDecimalInput(medidaEspesorUI);
    const anc = parseDecimalInput(medidaAnchoUI);
    const lar = parseDecimalInput(medidaLargoUI);
    const espIn = toInches(esp, unidadEspesorUI);
    const ancIn = toInches(anc, unidadAnchoUI);
    const larFt = toFeet(lar, unidadLargoUI);
    const pt = round2((espIn * ancIn * larFt) / 12);
    return { espIn, ancIn, larFt, pt };
  }, [medidaAnchoUI, medidaEspesorUI, medidaLargoUI, unidadAnchoUI, unidadEspesorUI, unidadLargoUI]);
  const totalPtMueblesActual = useMemo(
    () => totalPtLinea(detalle.muebles_lineas[0]?.piezas ?? []),
    [detalle.muebles_lineas],
  );
  const totalMaderaProyectado = useMemo(() => {
    const precioPt = parseDecimalInput(precioVentaPtUI);
    return round2(totalPtMueblesActual * precioPt);
  }, [precioVentaPtUI, totalPtMueblesActual]);
  const conversionAserraderoUI = useMemo(() => {
    const esp = parseDecimalInput(asrMedidaEspesorUI);
    const anc = parseDecimalInput(asrMedidaAnchoUI);
    const lar = parseDecimalInput(asrMedidaLargoUI);
    const espIn = toInches(esp, asrUnidadEspesorUI);
    const ancIn = toInches(anc, asrUnidadAnchoUI);
    const larFt = toFeet(lar, asrUnidadLargoUI);
    const ptUnit = round2((espIn * ancIn * larFt) / 12);
    return { espIn, ancIn, larFt, ptUnit };
  }, [asrMedidaAnchoUI, asrMedidaEspesorUI, asrMedidaLargoUI, asrUnidadAnchoUI, asrUnidadEspesorUI, asrUnidadLargoUI]);
  const asrCantidad = Math.max(0, Number(detalle.aserradero?.horas ?? 0));
  const asrPtTotal = round2(conversionAserraderoUI.ptUnit * asrCantidad);
  const asrPrecioUnit = Math.max(0, Number(detalle.aserradero?.precioHora ?? 0));
  const asrTotalEstimado = round2(asrPtTotal * asrPrecioUnit);
  const piezasMuebleActual = useMemo(
    () => detalle.muebles_lineas[0]?.piezas ?? [],
    [detalle.muebles_lineas],
  );
  const selectedPiezaIndexSafe = useMemo(() => {
    if (piezasMuebleActual.length <= 0) return 0;
    return Math.min(Math.max(0, selectedPiezaIndexUI), piezasMuebleActual.length - 1);
  }, [piezasMuebleActual.length, selectedPiezaIndexUI]);
  const muebleOptions = useMemo(() => {
    if (mockData && mueblesCatalogo.length === 0) {
      return MOCK_MUEBLES_CATALOGO_VENTA.map((m) => ({
        id: m.id,
        nombre: `${m.codigo} — ${m.nombre}`,
        origen: "catalogo" as const,
      }));
    }
    const catalogoActivo = mueblesCatalogo.filter((m) => m.activo !== false);
    if (catalogoActivo.length > 0) {
      return catalogoActivo.map((m) => ({
        id: m.id,
        nombre: `${m.codigo} — ${m.nombre}`,
        origen: "catalogo" as const,
      }));
    }
    const activos = effectiveProductos.filter((p) => p.activo !== false);
    const soloMueble = activos.filter((p) => isMuebleCategory(p.categoria));
    if (soloMueble.length > 0) {
      return soloMueble.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        origen: "inventario" as const,
      }));
    }
    return [
      { id: "ejemplo-ropero", nombre: "Ropero 2 puertas", origen: "ejemplo" as const },
      { id: "ejemplo-escritorio", nombre: "Escritorio ejecutivo", origen: "ejemplo" as const },
      { id: "ejemplo-repostero", nombre: "Repostero de cocina", origen: "ejemplo" as const },
    ];
  }, [mockData, mueblesCatalogo, effectiveProductos]);

  const effectiveMuebleTemplates = useMemo((): MuebleTemplate[] => {
    if (!mockData) return muebleTemplates;
    const injected = MOCK_WIZARD_MUEBLE_PLANTILLAS as unknown as MuebleTemplate[];
    return [...injected, ...muebleTemplates];
  }, [mockData, muebleTemplates]);

  const plantillaComboboxOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar plantilla..." },
      ...effectiveMuebleTemplates.map((t) => ({
        value: t.id,
        label: (t.name ?? "").trim() || "Plantilla sin nombre",
      })),
    ],
    [effectiveMuebleTemplates],
  );

  const maderaComboboxOptions = useMemo(() => {
    const opts = effectiveProductos
      .filter((p) => (p.stock_actual ?? 0) > 0 && isWoodCategory(p.categoria))
      .map((p) => ({
        value: p.id,
        label: `[${p.categoria}] ${stripDimensionesMadera(p.nombre)}`,
        sublabel: `Pies: ${formatoPiesDisponibles(p.stock_actual, p.unidad)} · Stock ${p.stock_actual} ${p.unidad}`,
      }));
    return [{ value: "", label: "Desplegable madera (según inventario)" }, ...opts];
  }, [effectiveProductos]);

  const alquilerProductoComboboxOptions = useMemo(
    () => [
      { value: "", label: "— Escribir manual —" },
      ...effectiveProductos.map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
    ],
    [effectiveProductos],
  );

  const muebleTipoComboboxOptions = useMemo(
    () => [{ value: "", label: "Desplegable de tipo" }, ...muebleOptions.map((p) => ({ value: p.id, label: p.nombre }))],
    [muebleOptions],
  );
  const selectedTipoMuebleLabel = useMemo(
    () => muebleOptions.find((x) => x.id === tipoMuebleVista)?.nombre ?? "Mueble",
    [muebleOptions, tipoMuebleVista],
  );
  const clientesFiltrados = useMemo(
    () =>
      effectiveClientes.filter((c) =>
        tipoCliente === "empresa" ? isEmpresaClienteRow(c) : !isEmpresaClienteRow(c),
      ),
    [effectiveClientes, tipoCliente],
  );

  const clientesParaCombo = useMemo(
    () => clientesFiltrados.map(clienteRowToCompleto),
    [clientesFiltrados],
  );

  useEffect(() => {
    if (!clienteId) return;
    const found = clientesFiltrados.some((c) => c.id === clienteId);
    if (!found) {
      setClienteId(null);
    }
  }, [clienteId, clientesFiltrados]);

  /**
   * Carga los valores de una pieza (almacenados en in/ft) a los campos UI
   * respetando la unidad de UI actual. Se llama al seleccionar una pieza existente.
   */
  const loadPiezaToUI = useCallback(
    (pieza: MuebleLineaPieza) => {
      setMedidaEspesorUI(inchesToUI(pieza.espesor, unidadEspesorUI));
      setMedidaAnchoUI(inchesToUI(pieza.ancho, unidadAnchoUI));
      setMedidaLargoUI(feetToUI(pieza.largo, unidadLargoUI));
    },
    [unidadAnchoUI, unidadEspesorUI, unidadLargoUI],
  );

  /**
   * Actualiza solo la pieza actualmente seleccionada en detalle con
   * los valores convertidos de los campos UI. Se llama inline en onChange
   * de cada campo de medida.
   */
  const syncCurrentPiezaToDetalle = useCallback(
    (updates: Partial<{ cantidad: number; espesor: number; ancho: number; largo: number }>) => {
      setDetalle((d) => {
        if (!(d.rubros.muebles)) return d;
        const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
        const first = lineas[0];
        const piezas = first.piezas.length > 0 ? [...first.piezas] : [emptyPieza()];
        const idx = Math.min(Math.max(0, selectedPiezaIndexUI), Math.max(0, piezas.length - 1));
        const piezaBase = piezas[idx] ?? emptyPieza();
        piezas[idx] = {
          ...piezaBase,
          ...updates,
        };
        lineas[0] = { ...first, piezas };
        return { ...d, muebles_lineas: lineas };
      });
    },
    [selectedPiezaIndexUI],
  );

  const addPiezaDesdeDimensiones = useCallback(() => {
    const insertAt = piezasMuebleActual.length === 0 ? 0 : Math.min(Math.max(0, selectedPiezaIndexSafe), piezasMuebleActual.length - 1) + 1;

    setDetalle((d) => {
      const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
      const first = lineas[0];
      const piezas = first.piezas.length > 0 ? [...first.piezas] : [emptyPieza()];
      const nueva = {
        ...emptyPieza(),
        descripcion: selectedTipoMuebleLabel !== "Mueble" ? selectedTipoMuebleLabel : "Pieza",
      };
      piezas.splice(insertAt, 0, nueva);
      lineas[0] = { ...first, piezas };
      return { ...d, muebles_lineas: lineas };
    });
    // Limpiar campos UI para que la nueva pieza inicie desde cero
    setMedidaEspesorUI("");
    setMedidaAnchoUI("");
    setMedidaLargoUI("");
    setSelectedPiezaIndexUI(insertAt);
  }, [piezasMuebleActual.length, selectedPiezaIndexSafe, selectedTipoMuebleLabel]);

  const removeSelectedPieza = useCallback(() => {
    // Calcular sincrónicamente desde el estado actual (acción de usuario, no concurrente)
    const currentPiezas = detalle.muebles_lineas[0]?.piezas ?? [];
    const idx = Math.min(Math.max(0, selectedPiezaIndexSafe), Math.max(0, currentPiezas.length - 1));

    if (currentPiezas.length <= 1) {
      // Solo queda una pieza → limpiar campos y resetear
      const empty = emptyPieza();
      setDetalle((d) => {
        const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
        const first = lineas[0];
        lineas[0] = { ...first, piezas: [empty] };
        return { ...d, muebles_lineas: lineas };
      });
      setSelectedPiezaIndexUI(0);
      setMedidaEspesorUI("");
      setMedidaAnchoUI("");
      setMedidaLargoUI("");
      return;
    }

    const nextSelected = Math.max(0, idx - 1);
    const piezasSinEliminada = currentPiezas.filter((_, i) => i !== idx);
    const nextPieza = piezasSinEliminada[nextSelected] ?? null;

    setDetalle((d) => {
      const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
      const first = lineas[0];
      const piezas = [...(first.piezas.length > 0 ? first.piezas : [emptyPieza()])];
      piezas.splice(idx, 1);
      lineas[0] = { ...first, piezas };
      return { ...d, muebles_lineas: lineas };
    });

    setSelectedPiezaIndexUI(nextSelected);
    // Cargar dimensiones de la pieza que queda seleccionada
    if (nextPieza) {
      setMedidaEspesorUI(inchesToUI(nextPieza.espesor, unidadEspesorUI));
      setMedidaAnchoUI(inchesToUI(nextPieza.ancho, unidadAnchoUI));
      setMedidaLargoUI(feetToUI(nextPieza.largo, unidadLargoUI));
    }
  }, [detalle.muebles_lineas, selectedPiezaIndexSafe, unidadAnchoUI, unidadEspesorUI, unidadLargoUI]);

  const removePiezaAtIndex = useCallback((idx: number) => {
    const currentPiezas = detalle.muebles_lineas[0]?.piezas ?? [];
    if (currentPiezas.length <= 1) {
      const empty = emptyPieza();
      setDetalle((d) => {
        const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
        const first = lineas[0];
        lineas[0] = { ...first, piezas: [empty] };
        return { ...d, muebles_lineas: lineas };
      });
      setSelectedPiezaIndexUI(0);
      setMedidaEspesorUI("");
      setMedidaAnchoUI("");
      setMedidaLargoUI("");
      return;
    }

    const nextSelected = Math.max(0, idx - 1);
    const piezasSinEliminada = currentPiezas.filter((_, i) => i !== idx);
    const nextPieza = piezasSinEliminada[nextSelected] ?? null;

    setDetalle((d) => {
      const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
      const first = lineas[0];
      const piezas = [...(first.piezas.length > 0 ? first.piezas : [emptyPieza()])];
      piezas.splice(idx, 1);
      lineas[0] = { ...first, piezas };
      return { ...d, muebles_lineas: lineas };
    });

    setSelectedPiezaIndexUI(nextSelected);
    if (nextPieza) {
      setMedidaEspesorUI(inchesToUI(nextPieza.espesor, unidadEspesorUI));
      setMedidaAnchoUI(inchesToUI(nextPieza.ancho, unidadAnchoUI));
      setMedidaLargoUI(feetToUI(nextPieza.largo, unidadLargoUI));
    }
  }, [detalle.muebles_lineas, unidadAnchoUI, unidadEspesorUI, unidadLargoUI]);

  const applyMuebleTemplate = useCallback(
    (templateId: string) => {
      setSelectedMuebleTemplateId(templateId);
      if (!templateId) return;
      const selected = effectiveMuebleTemplates.find((t) => t.id === templateId);
      if (!selected) return;
      setTipoMuebleVista(selected.tipoMuebleVista);
      setUnidadEspesorUI(selected.unidadEspesorUI || "cm");
      setUnidadAnchoUI(selected.unidadAnchoUI || "cm");
      setUnidadLargoUI(selected.unidadLargoUI || "cm");
      setMedidaEspesorUI(selected.medidaEspesorUI);
      setMedidaAnchoUI(selected.medidaAnchoUI);
      setMedidaLargoUI(selected.medidaLargoUI);
      setTipoMaderaUI(selected.tipoMaderaUI);
      setPrecioVentaPtUI(selected.precioVentaPtUI);
      setAcabadoUI(selected.acabadoUI);
      setAcabadoOtroUI(selected.acabadoOtroUI);
      setCostoAcabadoSolesUI(selected.costoAcabadoSolesUI ?? "0");
      setCostoManoObraUI(selected.costoManoObraUI ?? "0");
      setDetalle((d) => ({
        ...d,
        costoAcabadoSoles: parseDecimalInput(selected.costoAcabadoSolesUI),
        costoManoObra: parseDecimalInput(selected.costoManoObraUI ?? "0"),
      }));
      setPagoMetodoUI(selected.pagoMetodoUI);
      setPagoModalidadUI(selected.pagoModalidadUI);
      setPlazoDiasUI(selected.plazoDiasUI);
      setPlazoUnidadUI(selected.plazoUnidadUI);
      setError("");
    },
    [effectiveMuebleTemplates],
  );

  const saveCurrentMuebleTemplate = useCallback(() => {
    const name = window.prompt("Nombre de la plantilla de mueble:");
    if (!name || !name.trim()) return;
    const next: MuebleTemplate = {
      id: newId(),
      name: name.trim(),
      tipoMuebleVista,
      unidadEspesorUI,
      unidadAnchoUI,
      unidadLargoUI,
      medidaEspesorUI,
      medidaAnchoUI,
      medidaLargoUI,
      tipoMaderaUI,
      precioVentaPtUI,
      acabadoUI,
      acabadoOtroUI,
      costoAcabadoSolesUI,
      costoManoObraUI,
      pagoMetodoUI,
      pagoModalidadUI,
      plazoDiasUI,
      plazoUnidadUI,
    };
    const merged = [
      ...loadMuebleTemplatesFromStorage().filter((t) => t.name.toLowerCase() !== next.name.toLowerCase()),
      next,
    ];
    try {
      localStorage.setItem(MUEBLE_TEMPLATES_KEY, JSON.stringify(merged));
    } catch {
      // ignore local storage errors
    }
    emitWizardTemplatesChanged();
    setSelectedMuebleTemplateId(next.id);
  }, [
    acabadoOtroUI,
    acabadoUI,
    costoAcabadoSolesUI,
    costoManoObraUI,
    medidaAnchoUI,
    medidaEspesorUI,
    medidaLargoUI,
    pagoMetodoUI,
    pagoModalidadUI,
    plazoDiasUI,
    plazoUnidadUI,
    precioVentaPtUI,
    tipoMaderaUI,
    tipoMuebleVista,
    unidadAnchoUI,
    unidadEspesorUI,
    unidadLargoUI,
  ]);

  const saveDraft = useCallback(() => {
    const draft: CotizacionDraft = {
      savedAt: new Date().toISOString(),
      tipoCliente,
      nombreCliente,
      documento,
      telefono,
      direccion,
      fecha,
      tipoCotizacionPreset,
      unidadEspesorUI,
      unidadAnchoUI,
      unidadLargoUI,
      medidaEspesorUI,
      medidaAnchoUI,
      medidaLargoUI,
      tipoMuebleVista,
      tipoMaderaUI,
      precioVentaPtUI,
      acabadoUI,
      acabadoOtroUI,
      costoAcabadoSolesUI,
      costoManoObraUI,
      pagoMetodoUI,
      pagoModalidadUI,
      plazoDiasUI,
      plazoUnidadUI,
    };
    try {
      localStorage.setItem(COTIZACION_DRAFT_KEY, JSON.stringify(draft));
      emitWizardDraftChanged();
    } catch {
      // Ignore localStorage errors.
    }
  }, [
    acabadoOtroUI,
    acabadoUI,
    costoAcabadoSolesUI,
    costoManoObraUI,
    direccion,
    documento,
    fecha,
    medidaAnchoUI,
    medidaEspesorUI,
    medidaLargoUI,
    nombreCliente,
    pagoMetodoUI,
    pagoModalidadUI,
    plazoDiasUI,
    plazoUnidadUI,
    precioVentaPtUI,
    telefono,
    tipoCliente,
    tipoCotizacionPreset,
    tipoMaderaUI,
    tipoMuebleVista,
    unidadAnchoUI,
    unidadEspesorUI,
    unidadLargoUI,
  ]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(COTIZACION_DRAFT_KEY);
    } catch {
      // ignore
    }
    emitWizardDraftChanged();
  }, []);

  const restoreDraft = useCallback(() => {
    const draft = loadDraftFromStorage();
    if (!draft) {
      setError("No hay borrador guardado para recuperar.");
      return;
    }
    setTipoCliente(draft.tipoCliente);
    setNombreCliente(draft.nombreCliente);
    setDocumento(draft.documento);
    setTelefono(draft.telefono);
    setDireccion(draft.direccion);
    setFecha(draft.fecha);
    applyCotizacionPreset(draft.tipoCotizacionPreset);
    setUnidadEspesorUI(draft.unidadEspesorUI || "cm");
    setUnidadAnchoUI(draft.unidadAnchoUI || "cm");
    setUnidadLargoUI(draft.unidadLargoUI || "cm");
    setMedidaEspesorUI(draft.medidaEspesorUI);
    setMedidaAnchoUI(draft.medidaAnchoUI);
    setMedidaLargoUI(draft.medidaLargoUI);
    setTipoMuebleVista(draft.tipoMuebleVista);
    setTipoMaderaUI(draft.tipoMaderaUI);
    setPrecioVentaPtUI(draft.precioVentaPtUI);
    setAcabadoUI(draft.acabadoUI);
    setAcabadoOtroUI(draft.acabadoOtroUI);
    setCostoAcabadoSolesUI(draft.costoAcabadoSolesUI ?? "0");
    setCostoManoObraUI(draft.costoManoObraUI ?? "0");
    setDetalle((d) => ({
      ...d,
      costoAcabadoSoles: parseDecimalInput(draft.costoAcabadoSolesUI),
      costoManoObra: parseDecimalInput(draft.costoManoObraUI ?? "0"),
    }));
    setPagoMetodoUI(draft.pagoMetodoUI);
    setPagoModalidadUI(draft.pagoModalidadUI);
    setPlazoDiasUI(draft.plazoDiasUI);
    setPlazoUnidadUI(draft.plazoUnidadUI);
    setDescripcionManual("");
    setIsDescriptionInitialized(false);
    setError("Borrador recuperado.");
  }, [applyCotizacionPreset]);

  const resetWizardFast = useCallback(() => {
    setClienteId(null);
    setNombreCliente("");
    setDocumento("");
    setTelefono("");
    setDireccion("");
    setTipoCliente("natural");
    setTipoCotizacionPreset("muebles");
    setDetalle(() => {
      const d = defaultCotizacionDetalleV1();
      d.rubros.muebles = true;
      d.muebles_lineas = [emptyLineaMadera()];
      return d;
    });
    setUnidadEspesorUI("cm");
    setUnidadAnchoUI("cm");
    setUnidadLargoUI("cm");
    setMedidaEspesorUI("");
    setMedidaAnchoUI("");
    setMedidaLargoUI("");
    setTipoMuebleVista("");
    setTipoMaderaUI("");
    setPrecioVentaPtUI("");
    setAcabadoUI("");
    setCostoAcabadoSolesUI("0");
    setCostoManoObraUI("0");
    setAcabadoOtroUI("");
    setPagoMetodoUI("efectivo");
    setPagoModalidadUI("");
    setPlazoDiasUI("15");
    setPlazoUnidadUI("dias");
    setDescripcionManual("");
    setIsDescriptionInitialized(false);
    setStepIndex(0);
    setMaxStep(0);
    clearDraft();
    setError("");
  }, [clearDraft]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraft();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [saveDraft]);

  useEffect(() => {
    const isDesktopLike =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer:fine)").matches &&
      window.matchMedia?.("(min-width: 1024px)").matches;
    if (!isDesktopLike) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDraft();
        setError("Borrador guardado.");
        return;
      }
      if (typing) return;
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        resetWizardFast();
        return;
      }
      if (event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        restoreDraft();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetWizardFast, restoreDraft, saveDraft]);

  const detalleParaLineas = useMemo(() => {
    let d = { ...detalle };
    if (!d.rubros.muebles) {
      d = { ...d, muebles_lineas: [] };
    }
    if (!d.rubros.aserradero) {
      d = { ...d, aserradero: null };
    }
    if (!d.rubros.alquiler) {
      d = { ...d, alquiler: null };
    }
    return d;
  }, [detalle]);

  const lineasFormal = useMemo(
    () => buildLineasResumen(detalleParaLineas, margenGananciaPct),
    [detalleParaLineas, margenGananciaPct],
  );
  const lineasFormalSafe = useMemo(
    () =>
      lineasFormal.map((linea) => ({
        ...linea,
        precioUnit: safeMoney(linea.precioUnit),
        precioTotal: safeMoney(linea.precioTotal),
      })),
    [lineasFormal],
  );
  const descripcionComercialSugerida = useMemo(() => {
    const parts = lineasFormalSafe.flatMap((linea) => [
      linea.titulo,
      ...linea.bullets,
    ]);
    return parts
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part, index, arr) => arr.indexOf(part) === index)
      .join("\n");
  }, [lineasFormalSafe]);

  useEffect(() => {
    if (!isDescriptionInitialized && descripcionComercialSugerida) {
      setDescripcionManual(descripcionComercialSugerida);
      setIsDescriptionInitialized(true);
    }
  }, [descripcionComercialSugerida, isDescriptionInitialized]);

  const correlativoMostrar = useMemo(() => {
    if (guardadaId) {
      const row = cotizacionesGuardadas.find((c) => c.id === guardadaId);
      if (row?.correlativo) {
        return row.correlativo;
      }
    }
    return correlativoPreview;
  }, [correlativoPreview, cotizacionesGuardadas, guardadaId]);

  const counts = useMemo(() => {
    let pend = 0;
    let aceptadas = 0;
    for (const c of cotizacionesGuardadas) {
      if (c.estado_flujo === "pendiente") pend += 1;
      else aceptadas += 1;
    }
    return { pend, aceptadas };
  }, [cotizacionesGuardadas]);

  const guardadaRow = useMemo(
    () => (guardadaId ? cotizacionesGuardadas.find((c) => c.id === guardadaId) ?? null : null),
    [guardadaId, cotizacionesGuardadas],
  );
  const puedeRegistrarCobro = Boolean(
    guardadaRow &&
    guardadaRow.estado_flujo !== "pendiente",
  );
  const stepLabels: Record<string, string> = useMemo(
    () => ({
      cliente: "Cliente",
      rubros: "Alcance y rubros",
      muebles: "Costeo muebles",
      aserradero: "Costeo aserradero",
      alquiler: "Costeo alquiler",
      resumen: "Resumen y guardado",
    }),
    [],
  );
  const clientesById = useMemo(() => {
    const map = new Map<string, ClienteRow>();
    for (const c of effectiveClientes) map.set(c.id, c);
    return map;
  }, [effectiveClientes]);
  const cotizacionesFiltradas = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return cotizacionesGuardadas.filter((c) => {
      if (filterEstado !== "todos") {
        if (filterEstado === "pendiente" && c.estado_flujo !== "pendiente") return false;
        if (filterEstado === "lista_produccion" && c.estado_flujo === "pendiente") return false;
      }
      if (filterFechaDesde) {
        const fecha = String(c.fecha ?? "");
        if (!fecha || fecha < filterFechaDesde) return false;
      }
      if (filterFechaHasta) {
        const fecha = String(c.fecha ?? "");
        if (!fecha || fecha > filterFechaHasta) return false;
      }
      if (!q) return true;
      const cliente = clientesById.get(c.cliente_id);
      const clienteNombre = (cliente?.nombre ?? "").toLowerCase();
      const correlativo = (c.correlativo ?? "").toLowerCase();
      const estado = String(c.estado_flujo ?? "").toLowerCase();
      const detalle = parseCotizacionDetalle(c.detalle as unknown);
      const descripcion = `${detalle.descripcion_cliente ?? ""} ${detalle.notas_generales ?? ""}`.toLowerCase();
      const fechaStr = String(c.fecha ?? "");
      const idStr = String(c.id ?? "");
      return (
        correlativo.includes(q) ||
        fechaStr.includes(q) ||
        estado.includes(q) ||
        descripcion.includes(q) ||
        clienteNombre.includes(q) ||
        idStr.toLowerCase().includes(q)
      );
    });
  }, [clientesById, cotizacionesGuardadas, filterEstado, filterFechaDesde, filterFechaHasta, filterText]);
  const pendientesClave = useMemo(() => {
    const pendientes: string[] = [];
    if (!nombreCliente.trim()) pendientes.push("Nombre de cliente");
    if (validateDocumentoByTipo(tipoCliente, documento)) pendientes.push(docLabel);
    if (
      (tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general") &&
      (!unidadEspesorUI || !unidadAnchoUI || !unidadLargoUI)
    ) {
      pendientes.push("Unidades de medida");
    }
    return pendientes;
  }, [docLabel, documento, nombreCliente, tipoCliente, tipoCotizacionPreset, unidadAnchoUI, unidadEspesorUI, unidadLargoUI]);

  const goStep = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < steps.length && idx <= maxStep) {
        setStepIndex(idx);
        setError("");
      }
    },
    [maxStep, steps.length],
  );

  const next = useCallback(() => {
    setError("");
    const idxNow = Math.min(stepIndex, Math.max(0, steps.length - 1));
    const id = steps[idxNow];
    if (id === "cliente") {
      if (!nombreCliente.trim()) {
        setError("Indica el nombre o razón social.");
        return;
      }
      const docValidationError = validateDocumentoByTipo(tipoCliente, documento);
      if (docValidationError) {
        setError(docValidationError);
        return;
      }
      setMaxStep((m) => Math.max(m, idxNow + 1));
      setStepIndex(idxNow + 1);
      return;
    }
    if (id === "rubros") {
      const r = detalle.rubros;
      const hasRubros = r.muebles || r.aserradero || r.alquiler;
      if (!hasRubros) {
        applyCotizacionPreset(tipoCotizacionPreset);
      }
      setMaxStep((m) => Math.max(m, idxNow + 1));
      setStepIndex(idxNow + 1);
      return;
    }
    if (id === "muebles") {
      if (detalle.muebles_lineas.length === 0) {
        setError("Agrega al menos una línea de madera o desactiva el rubro muebles.");
        return;
      }
      setMaxStep((m) => Math.max(m, idxNow + 1));
      setStepIndex(idxNow + 1);
      return;
    }
    if (id === "aserradero" || id === "alquiler") {
      setMaxStep((m) => Math.max(m, idxNow + 1));
      setStepIndex(idxNow + 1);
      return;
    }
    if (id === "resumen") return;
    setMaxStep((m) => Math.max(m, idxNow + 1));
    setStepIndex(idxNow + 1);
  }, [
    applyCotizacionPreset,
    detalle,
    documento,
    nombreCliente,
    stepIndex,
    steps,
    tipoCliente,
    tipoCotizacionPreset,
  ]);

  const back = useCallback(() => {
    setError("");
    setStepIndex((i) => {
      const idxNow = Math.min(i, Math.max(0, steps.length - 1));
      return Math.max(0, idxNow - 1);
    });
  }, [steps.length]);

  const ensureCliente = useCallback(async () => {
    if (clienteId) return { ok: true as const, id: clienteId };
    setBusy(true);
    const res = await createClienteCotizacionRapida({
      nombre: nombreCliente,
      documento,
      telefono,
      direccion,
      tipoPersona: tipoCliente,
    });
    setBusy(false);
    if (!res.ok) {
      return { ok: false as const, error: res.error };
    }
    setClienteId(res.id);
    return { ok: true as const, id: res.id };
  }, [clienteId, direccion, documento, nombreCliente, telefono, tipoCliente]);

  const handleGuardar = useCallback(
    async (estadoFlujo: "pendiente" | "lista_produccion" = "pendiente", imprimir?: boolean) => {
      if (!canSave) {
        setError("Tu rol no puede guardar cotizaciones.");
        return;
      }
      setError("");
      setBusy(true);
      const cli = await ensureCliente();
      if (!cli.ok) {
        setBusy(false);
        setError(cli.error);
        return;
      }

      let det = { ...detalle, descripcion_cliente: descripcionManual };
      if (!det.rubros.muebles) {
        det = { ...det, muebles_lineas: [] };
      }
      if (!det.rubros.aserradero) {
        det = { ...det, aserradero: null };
      }
      if (!det.rubros.alquiler) {
        det = { ...det, alquiler: null };
      }

      setDetalle(det);

      const res = await saveCotizacionUnificada({
        id: guardadaId ?? undefined,
        clienteId: cli.id,
        tipoCliente,
        fecha,
        detalle: det,
        total: totalGral,
        estadoFlujo,
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGuardadaId(res.id);
      clearDraft();
      router.refresh();
      if (imprimir) {
        window.open(`/cotizacion/unificada/${res.id}/pdf`, "_blank");
      }
    },
    [canSave, clearDraft, detalle, ensureCliente, fecha, guardadaId, router, tipoCliente, totalGral, descripcionManual],
  );

  const loadCotizacion = useCallback((row: CotizacionUnificadaRow) => {
    const d = parseCotizacionDetalle(row.detalle as unknown);
    setGuardadaId(row.id);
    setTipoCliente(row.tipo_cliente);
    setFecha(row.fecha);
    setDetalle(d);
    if (d.descripcion_cliente !== undefined && d.descripcion_cliente !== null) {
      setDescripcionManual(d.descripcion_cliente);
      setIsDescriptionInitialized(true);
    } else {
      setDescripcionManual("");
      setIsDescriptionInitialized(false);
    }
    setClienteId(row.cliente_id);
    const cl = effectiveClientes.find((c) => c.id === row.cliente_id);
    setNombreCliente(cl?.nombre ?? "");
    setDocumento(
      row.tipo_cliente === "empresa" ? (cl?.ruc ?? cl?.documento ?? "") : (cl?.documento ?? ""),
    );
    setTelefono(cl?.telefono ?? "");
    setDireccion(cl?.direccion ?? "");
    if (d.rubros.muebles && d.rubros.aserradero && d.rubros.alquiler) setTipoCotizacionPreset("general");
    else if (d.rubros.aserradero) setTipoCotizacionPreset("aserradero");
    else if (d.rubros.alquiler) setTipoCotizacionPreset("alquiler");
    else setTipoCotizacionPreset("muebles");
    // Restaurar campos UI de dimensiones desde la primera pieza guardada
    if (d.rubros.muebles && d.muebles_lineas.length > 0) {
      const primeraLinea = d.muebles_lineas[0];
      const primeraPieza = primeraLinea.piezas[0];
      if (primeraPieza) {
        // Usamos cm como unidad por defecto al cargar (los valores están en in/ft)
        setUnidadEspesorUI("cm");
        setUnidadAnchoUI("cm");
        setUnidadLargoUI("cm");
        setMedidaEspesorUI(inchesToUI(primeraPieza.espesor, "cm"));
        setMedidaAnchoUI(inchesToUI(primeraPieza.ancho, "cm"));
        setMedidaLargoUI(feetToUI(primeraPieza.largo, "cm"));
      }
      if (primeraLinea.precioPorPt > 0) {
        setPrecioVentaPtUI(String(primeraLinea.precioPorPt));
      }
      if (primeraLinea.inventario_producto_id) {
        setTipoMaderaUI(primeraLinea.inventario_producto_id);
      }
    }
    setCostoManoObraUI(String(d.costoManoObra ?? 0));
    setSelectedPiezaIndexUI(0);
    const baseSteps: string[] = ["cliente", "rubros"];
    if (d.rubros.muebles) baseSteps.push("muebles");
    if (d.rubros.aserradero) baseSteps.push("aserradero");
    if (d.rubros.alquiler) baseSteps.push("alquiler");
    baseSteps.push("resumen");
    const targetIdx = baseSteps.length - 1;
    setStepIndex(targetIdx);
    setMaxStep(targetIdx);
    setError("");
  }, [effectiveClientes]);

  const handleGuardarDescripcion = async () => {
    setDetalle((d) => ({ ...d, descripcion_cliente: descripcionManual }));

    if (guardadaId) {
      setBusy(true);
      setError("");
      try {
        let det = { ...detalle, descripcion_cliente: descripcionManual };
        if (!det.rubros.muebles) {
          det = { ...det, muebles_lineas: [] };
        }
        if (!det.rubros.aserradero) {
          det = { ...det, aserradero: null };
        }
        if (!det.rubros.alquiler) {
          det = { ...det, alquiler: null };
        }

        const res = await saveCotizacionUnificada({
          id: guardadaId,
          clienteId: clienteId || "",
          tipoCliente,
          fecha,
          detalle: det,
          total: totalGral,
          estadoFlujo: guardadaRow?.estado_flujo === "lista_produccion" ? "lista_produccion" : "pendiente",
        });

        if (!res.ok) {
          setError(res.error);
          setBusy(false);
          return;
        }
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Error al persistir la descripción");
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setToastMessage("¡Descripción guardada correctamente!");
  };

  const handleRestablecerDescripcion = () => {
    const hasUnsavedChanges = descripcionManual !== (detalle.descripcion_cliente ?? "");
    if (hasUnsavedChanges) {
      if (
        !confirm(
          "Tienes cambios manuales sin guardar en la descripción. ¿Estás seguro de que deseas restablecerla?",
        )
      ) {
        return;
      }
    }
    setDescripcionManual(descripcionComercialSugerida);
    setToastMessage("¡Descripción restablecida a la sugerida!");
  };

  useEffect(() => {
    if (editarId) {
      const found = cotizacionesGuardadas.find((c) => c.id === editarId);
      if (found) {
        loadCotizacion(found);
        setTimeout(() => {
          const element = document.getElementById("cotizacion-wizard");
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    }
  }, [editarId, cotizacionesGuardadas, loadCotizacion]);

  const productoById = useCallback(
    (id: string | null) => effectiveProductos.find((p) => p.id === id) ?? null,
    [effectiveProductos],
  );

  return (
    <div id="cotizacion-wizard" className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-6">
      <Card className="border-[var(--katia-primary)]/30 bg-[var(--katia-primary)]/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--katia-primary)]">Ruta simple</p>
            <CardTitle className="mt-1 text-lg">Venta guiada rápida</CardTitle>
            <CardDescription className="mt-1">
              Primero selecciona o registra al cliente. Luego agrega el producto o servicio. Al final revisa el total antes de guardar o convertir a venta.
            </CardDescription>
          </div>
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            {["Cliente", "Producto o servicio", "Total", "Guardar"].map((label) => (
              <span key={label} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-semibold text-[var(--color-text-primary)]">
                {label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Pendientes
          </p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{counts.pend}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Solo se eliminan manualmente.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Listas para producción
          </p>
          <p className="text-2xl font-bold text-[var(--color-accent)]">{counts.aceptadas}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Listas para pasar a taller.</p>
        </Card>
        <Card className="hidden p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            En producción
          </p>
          <p className="text-2xl font-bold text-[var(--color-success)]">0</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Ya registradas como orden.</p>
        </Card>
        <Card className="hidden p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Cobradas
          </p>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">0</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Ingreso registrado en caja.</p>
        </Card>
      </div>

      {guardadaRow ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 shadow-sm transition-all">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="text-sm font-bold">Modo Edición Activo</p>
              <p className="text-xs opacity-90">
                Estás editando la cotización <strong className="font-extrabold">{guardadaRow.correlativo ?? guardadaRow.id.slice(0, 8)}</strong> de <strong className="font-bold">{nombreCliente || "Sin definir"}</strong>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-sm"
              onClick={() => goStep(steps.length - 1)}
            >
              Ir al Resumen
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:bg-zinc-900 dark:text-amber-400 transition-colors shadow-sm"
              onClick={resetWizardFast}
            >
              Cancelar (Nueva)
            </button>
          </div>
        </div>
      ) : null}

      <Card className="sticky top-2 z-10 border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Resumen de la cotización
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">
              Paso {effectiveStepIndex + 1}/{steps.length} · Cliente: {nombreCliente || "Sin definir"} · Total:{" "}
              <strong>{formatPen(totalGralSafe)}</strong>
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Pendientes: {pendientesClave.length > 0 ? pendientesClave.join(", ") : "Ninguno"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold"
              onClick={saveDraft}
            >
              Guardar borrador
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold disabled:opacity-50"
              onClick={restoreDraft}
              disabled={!isClient || !draftSavedAt}
            >
              Recuperar borrador
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold"
              onClick={resetWizardFast}
            >
              Nueva cotización
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
          {isClient && draftSavedAt
            ? `Último borrador: ${new Date(draftSavedAt).toLocaleString("es-PE")}`
            : "Aún no hay borrador guardado."}{" "}
          En PC: `Ctrl/Cmd + S` guarda, `Alt + R` recupera, `Alt + N` nueva.
        </p>
      </Card>

      <Card className="space-y-3 border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <CardTitle className="text-base">Modo completo y opciones avanzadas</CardTitle>
        <CardDescription>
          Modo completo: usa estos pasos cuando necesites medidas, rubros, margen, aserradero, alquiler o notas detalladas.
          Puedes volver atrás y cambiar la información cuando quieras.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          {steps.map((sid, idx) => (
            <button
              key={`${sid}-${idx}`}
              type="button"
              disabled={idx > maxStep}
              onClick={() => goStep(idx)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${idx === effectiveStepIndex
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : idx <= maxStep
                    ? "border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-50"
                }`}
            >
              {idx + 1}. {stepLabels[sid] ?? sid}
            </button>
          ))}
        </div>
      </Card>

      {currentStepId === "cliente" ? (
        <Card className={`${panelClass} space-y-5 border-none`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs text-[var(--color-text-secondary)]">¿Cliente nuevo?</p>
            <NuevoClienteRapidoInline
              onCreated={(nombre, documento, telefono) => {
                setNombreCliente(nombre);
                setDocumento(documento);
                setTelefono(telefono);
                setClienteId(null); // aún no tiene ID en DB hasta guardar
              }}
            />
          </div>
          <CardTitle className="text-center text-2xl font-extrabold">Datos del cliente</CardTitle>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text-primary)]">Datos básicos</p>
            <p>Primero selecciona un cliente existente o registra uno nuevo. Para factura, usa cliente empresa con RUC válido.</p>
          </div>

          <div className="mx-auto max-w-xs grid grid-cols-2 gap-1 bg-[var(--color-primary-soft)]/30 p-1 rounded-xl border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setTipoCliente("natural")}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
                tipoCliente === "natural"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              👤 Persona Natural
            </button>
            <button
              type="button"
              onClick={() => setTipoCliente("empresa")}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
                tipoCliente === "empresa"
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--color-border)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              🏢 Empresa
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ClienteCombobox
              className="[&>span]:text-xs [&>span]:font-medium [&>span]:text-[var(--color-text-secondary)]"
              label="Cliente existente"
              clientes={clientesParaCombo}
              value={clienteId ?? ""}
              onChange={(id) => {
                if (!id) {
                  setClienteId(null);
                  return;
                }
                setClienteId(id);
              }}
              onSelectFull={(c) => {
                setNombreCliente(c.nombre);
                setDocumento(
                  tipoCliente === "empresa" ? (c.ruc ?? c.documento ?? "") : (c.documento ?? ""),
                );
                setTelefono(c.telefono ?? "");
                setDireccion(c.direccion ?? "");
              }}
              placeholder="Buscar o elegir cliente…"
              inputAriaLabel="Cliente existente — buscar en lista"
            />
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fecha</span>
              <input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Nombre / Razón social
              </span>
              <input
                className={inputClass}
                value={nombreCliente}
                onChange={(e) => setNombreCliente(e.target.value)}
                placeholder={tipoCliente === "empresa" ? "Ej: Inversiones Sur SAC" : "Ej: María Quispe"}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{docLabel}</span>
              <input
                className={inputClass}
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder={tipoCliente === "empresa" ? "20xxxxxxxx" : "DNI"}
                inputMode="numeric"
                maxLength={tipoCliente === "empresa" ? 11 : 8}
              />
              {docErrorLive ? <p className="text-xs text-[var(--color-danger)]">{docErrorLive}</p> : null}
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Teléfono</span>
              <input
                className={inputClass}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="999 999 999"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Dirección</span>
              <input
                className={inputClass}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej: Av. Principal 123, Tarapoto"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            {effectiveStepIndex > 0 ? (
              <button type="button" onClick={back} className={navBtnSecondaryClass}>
                Anterior
              </button>
            ) : null}
            <button type="button" onClick={next} className={navBtnClass}>
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "rubros" ? (
        <Card className={`${panelClass} space-y-5 border-none`}>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text-primary)]">Producto o servicio</p>
            <p>Elige el tipo de trabajo que vas a cotizar. Si no estás segura, usa una sola opción y continúa; las opciones avanzadas quedan disponibles en los siguientes pasos.</p>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Tipo de Cotización
            </span>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {(
                [
                  { id: "muebles", label: "Mueble Personalizado", icon: "🪑", desc: "Mesas, sillas, armarios a medida" },
                  { id: "aserradero", label: "Servicio Aserradero", icon: "🪵", desc: "Corte y cubicaje de madera" },
                  { id: "alquiler", label: "Alquiler Maquinaria", icon: "🚜", desc: "Equipos y herramientas" },
                  { id: "general", label: "Cotización General", icon: "📋", desc: "Múltiples servicios combinados" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyCotizacionPreset(p.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 ${
                    tipoCotizacionPreset === p.id
                      ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]/40 text-[var(--color-text-primary)] shadow-sm scale-[1.02]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
                  }`}
                >
                  <span className="text-3xl mb-2">{p.icon}</span>
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">{p.label}</span>
                  <span className="text-[10px] mt-1 leading-normal text-[var(--color-text-secondary)]">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {(tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general") ? (
            <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Plantilla de mueble personalizado
                </span>
                <Combobox
                  options={plantillaComboboxOptions}
                  value={selectedMuebleTemplateId}
                  onChange={applyMuebleTemplate}
                  placeholder="Buscar plantilla…"
                  inputAriaLabel="Plantilla de mueble personalizado"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold"
                  onClick={() => {
                    if (canSaveCurrentAsTemplate) {
                      saveCurrentMuebleTemplate();
                      return;
                    }
                    const fallbackId = selectedMuebleTemplateId || effectiveMuebleTemplates[0]?.id;
                    if (!fallbackId) {
                      setError("No hay plantillas guardadas para cargar.");
                      return;
                    }
                    applyMuebleTemplate(fallbackId);
                  }}
                >
                  {canSaveCurrentAsTemplate ? "Guardar como plantilla" : "Cargar plantilla"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2">
            {tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general" ? (
              <div className="space-y-2">
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Dimensiones</span>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(
                    [
                      {
                        label: "Espesor",
                        unidad: unidadEspesorUI,
                        setUnidad: setUnidadEspesorUI,
                        medida: medidaEspesorUI,
                        setMedida: (v: string) => {
                          setMedidaEspesorUI(v);
                          const espIn = toInches(parseDecimalInput(v), unidadEspesorUI);
                          syncCurrentPiezaToDetalle({ espesor: espIn });
                        },
                      },
                      {
                        label: "Ancho",
                        unidad: unidadAnchoUI,
                        setUnidad: setUnidadAnchoUI,
                        medida: medidaAnchoUI,
                        setMedida: (v: string) => {
                          setMedidaAnchoUI(v);
                          const ancIn = toInches(parseDecimalInput(v), unidadAnchoUI);
                          syncCurrentPiezaToDetalle({ ancho: ancIn });
                        },
                      },
                      {
                        label: "Largo",
                        unidad: unidadLargoUI,
                        setUnidad: setUnidadLargoUI,
                        medida: medidaLargoUI,
                        setMedida: (v: string) => {
                          setMedidaLargoUI(v);
                          const larFt = toFeet(parseDecimalInput(v), unidadLargoUI);
                          syncCurrentPiezaToDetalle({ largo: larFt });
                        },
                      },
                    ] as const
                  ).map(({ label, unidad, setUnidad, medida, setMedida }) => (
                    <div key={label} className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--color-text-secondary)]">{label}</span>
                      <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-accent)]/50 transition-all">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full border-none bg-transparent h-10 px-3 text-sm focus:outline-none focus:ring-0 text-[var(--color-text-primary)]"
                          value={medida}
                          onChange={(e) => setMedida(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addPiezaDesdeDimensiones();
                            }
                          }}
                          placeholder="0"
                        />
                        <select
                          className="border-l border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-2 h-10 text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-0 cursor-pointer"
                          value={unidad}
                          onChange={(e) => {
                            const newUnit = e.target.value as "" | "mm" | "cm" | "m" | "in" | "ft";
                            if (label === "Espesor") {
                              const valIn = toInches(parseDecimalInput(medidaEspesorUI), unidadEspesorUI);
                              setUnidadEspesorUI(newUnit);
                              setMedidaEspesorUI(inchesToUI(valIn, newUnit));
                            } else if (label === "Ancho") {
                              const valIn = toInches(parseDecimalInput(medidaAnchoUI), unidadAnchoUI);
                              setUnidadAnchoUI(newUnit);
                              setMedidaAnchoUI(inchesToUI(valIn, newUnit));
                            } else {
                              const valFt = toFeet(parseDecimalInput(medidaLargoUI), unidadLargoUI);
                              setUnidadLargoUI(newUnit);
                              setMedidaLargoUI(feetToUI(valFt, newUnit));
                            }
                          }}
                          aria-label={`Unidad ${label}`}
                        >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="m">m</option>
                          <option value="in">in</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <label className="space-y-1">
                    <span className="block text-xs font-bold text-[var(--color-text-secondary)]">Cantidad por pieza</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} h-10 text-center`}
                      value={String(piezasMuebleActual[selectedPiezaIndexSafe]?.cantidad ?? 1)}
                      onChange={(e) => {
                        const cantidad = Math.max(0, parseDecimalInput(e.target.value));
                        syncCurrentPiezaToDetalle({ cantidad });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPiezaDesdeDimensiones();
                        }
                      }}
                      placeholder="1"
                    />
                  </label>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)]">
                    <div className="grid gap-1 sm:grid-cols-3">
                      <span>
                        PT unitario:{" "}
                        <strong className="text-[var(--color-text-primary)]">
                          {ptUnitarioPieza(piezasMuebleActual[selectedPiezaIndexSafe] ?? emptyPieza()).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        Cantidad:{" "}
                        <strong className="text-[var(--color-text-primary)]">
                          {piezasMuebleActual[selectedPiezaIndexSafe]?.cantidad ?? 1}
                        </strong>
                      </span>
                      <span>
                        PT total:{" "}
                        <strong className="text-[var(--color-accent)]">
                          {ptTotalPieza(piezasMuebleActual[selectedPiezaIndexSafe] ?? emptyPieza()).toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/10 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[var(--color-text-secondary)]">
                      Piezas ({piezasMuebleActual.length || 1})
                    </p>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-primary-soft)]/20 transition-colors"
                      onClick={addPiezaDesdeDimensiones}
                    >
                      + Agregar pieza
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(piezasMuebleActual.length > 0 ? piezasMuebleActual : [emptyPieza()]).map((pieza, idx) => {
                      const ptPieza = ptTotalPieza(pieza);
                      return (
                        <div
                          key={`pieza-pos-${idx}`}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                            idx === selectedPiezaIndexSafe
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPiezaIndexUI(idx);
                              loadPiezaToUI(pieza);
                            }}
                            className="text-left"
                          >
                            <span>Pieza {idx + 1}</span>
                            <span className="ml-1.5 opacity-75 text-[10px]">{ptPieza.toFixed(2)} PT</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePiezaAtIndex(idx)}
                            className={`ml-1 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 ${
                              idx === selectedPiezaIndexSafe
                                ? "text-[var(--color-on-accent)]"
                                : "text-[var(--color-text-secondary)]"
                            }`}
                            title="Eliminar pieza"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Conversión: Espesor {conversionMedidasUI.espIn.toFixed(2)} in · Ancho {conversionMedidasUI.ancIn.toFixed(2)} in · Largo{" "}
                  {conversionMedidasUI.larFt.toFixed(2)} ft · PT ref: <strong>{conversionMedidasUI.pt.toFixed(2)}</strong>
                </p>
                {/* PT acumulado todas las piezas */}
                {piezasMuebleActual.length > 0 && (
                  <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-primary-soft)]/20 p-2 space-y-1">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {piezasMuebleActual.map((p, i) => {
                        const ptUnit = ptUnitarioPieza(p);
                        const pt = ptTotalPieza(p);
                        return (
                          <span key={i} className="text-[11px] text-[var(--color-text-secondary)]">
                            P{i + 1}: <strong className="text-[var(--color-text-primary)]">{pt.toFixed(2)}</strong>{" "}
                            <span className="opacity-75">({ptUnit.toFixed(2)} x {p.cantidad})</span>
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs font-bold text-[var(--color-accent)]">
                      PT TOTAL ({piezasMuebleActual.length} pieza{piezasMuebleActual.length !== 1 ? "s" : ""}):{" "}
                      <strong>
                        {totalPtMueblesActual.toFixed(2)} PT
                      </strong>
                    </p>
                  </div>
                )}
                
                {/* Inputs de Precio por Pie y Mano de obra integrados en la calculadora */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
                  <label className="space-y-1 text-left">
                    <span className="block text-[11px] font-bold text-[var(--color-text-secondary)]">Precio por Pie (S/)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} h-10 text-center`}
                      value={precioVentaPtUI}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPrecioVentaPtUI(val);
                        const precioPt = parseDecimalInput(val);
                        setDetalle((d) => {
                          if (!d.rubros.muebles || d.muebles_lineas.length === 0) return d;
                          const lineas = [...d.muebles_lineas];
                          lineas[0] = { ...lineas[0], precioPorPt: precioPt };
                          return { ...d, muebles_lineas: lineas };
                        });
                      }}
                      placeholder="S/ por pie"
                    />
                  </label>
                  <label className="space-y-1 text-left">
                    <span className="block text-[11px] font-bold text-[var(--color-text-secondary)]">Mano de Obra (S/)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} h-10 text-center`}
                      value={costoManoObraUI}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCostoManoObraUI(val);
                        const manoObra = parseDecimalInput(val);
                        setDetalle((d) => ({ ...d, costoManoObra: manoObra }));
                      }}
                      placeholder="S/ mano obra"
                    />
                  </label>
                </div>
                
                {parseDecimalInput(precioVentaPtUI) > 0 && (
                  <p className="mt-2 text-[11px] text-left text-[var(--color-text-secondary)]">
                    Madera proyectada: <strong className="text-[var(--color-text-primary)]">{formatPen(totalMaderaProyectado)}</strong>
                  </p>
                )}

                <p className="text-xs text-[var(--color-text-secondary)]">
                  Cada unidad se convierte automáticamente a pulgadas/pies para el cálculo.
                </p>
              </div>
            ) : null}

            {tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general" ? (
              <div className="space-y-2">
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Tipo de madera</span>
                <Combobox
                  options={maderaComboboxOptions}
                  value={tipoMaderaUI}
                  onChange={(selectedId) => {
                    setTipoMaderaUI(selectedId);
                    if (!selectedId) return;
                    const picked = effectiveProductos.find((p) => p.id === selectedId);
                    if (!picked) return;
                    if (detalle.muebles_lineas.length === 0) return;
                    setDetalle((d) => {
                      const first = d.muebles_lineas[0];
                      const nextFirst = {
                        ...first,
                        inventario_producto_id: picked.id,
                        especie_label: picked.nombre ?? first.especie_label,
                      };
                      return { ...d, muebles_lineas: [nextFirst, ...d.muebles_lineas.slice(1)] };
                    });
                  }}
                  placeholder="Buscar madera…"
                  inputAriaLabel="Tipo de madera desde inventario"
                />
                {tipoMaderaUI ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Selección tomada desde inventario para la cotización.
                  </p>
                ) : effectiveProductos.some((p) => (p.stock_actual ?? 0) > 0 && isWoodCategory(p.categoria)) ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">Solo se listan materiales de categoría madera con stock.</p>
                ) : null}
              </div>
            ) : null}

            {tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general" ? (
              <div className="space-y-2">
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Tipo de acabado</span>
                <div className="flex items-end gap-2">
                  <select
                    className={`${inputClass} h-11 flex-1`}
                    value={acabadoUI}
                    onChange={(e) => setAcabadoUI(e.target.value)}
                  >
                    <option value="">Desplegable Acabado</option>
                    <option value="colores">Colores</option>
                    <option value="laca">Laca</option>
                    <option value="barniz">Barniz</option>
                    <option value="sin_acabado">Sin acabado</option>
                    <option value="otro">Otros</option>
                  </select>
                  <label className="space-y-1 pb-0.5">
                    <span className="block text-[11px] font-bold text-[var(--color-text-secondary)]">Costo (S/)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={`${inputClass} h-11 w-[150px] text-center`}
                      value={costoAcabadoSolesUI}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCostoAcabadoSolesUI(raw);
                        setDetalle((d) => ({ ...d, costoAcabadoSoles: parseDecimalInput(raw) }));
                      }}
                      placeholder="0"
                    />
                  </label>
                </div>
                {acabadoUI === "otro" ? (
                  <input
                    className={`${inputClass} h-11`}
                    value={acabadoOtroUI}
                    onChange={(e) => setAcabadoOtroUI(e.target.value)}
                    placeholder="Especificar tipo de acabado"
                  />
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Tipo de pago y modalidad</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={`${inputClass} h-11`}
                  value={pagoMetodoUI}
                  onChange={(e) =>
                    setPagoMetodoUI(
                      e.target.value as "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro",
                    )
                  }
                >
                  <option value="efectivo">Pago (metodo)</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="yape">Yape</option>
                  <option value="billetera_digital">Billetera digital</option>
                  <option value="otro">Otro</option>
                </select>
                <select
                  className={`${inputClass} h-11`}
                  value={pagoModalidadUI}
                  onChange={(e) =>
                    setPagoModalidadUI(e.target.value as "" | "contado" | "adelanto" | "adelanto_saldo" | "credito")
                  }
                >
                  <option value="">Modalidad</option>
                  <option value="contado">Contado</option>
                  <option value="adelanto">Adelanto</option>
                  <option value="adelanto_saldo">Adelanto + saldo</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              {pagoModalidadUI === "credito" || pagoModalidadUI === "adelanto" || pagoModalidadUI === "adelanto_saldo" ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">
                    {plazoDiasUI} {plazoUnidadUI}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} h-11`}
                    value={plazoDiasUI}
                    onChange={(e) => setPlazoDiasUI(e.target.value)}
                    placeholder="Cada cuánto pagará"
                  />
                  <select
                    className={`${inputClass} h-11 max-w-[120px]`}
                    value={plazoUnidadUI}
                    onChange={(e) => setPlazoUnidadUI(e.target.value as "dias" | "meses")}
                  >
                    <option value="dias">Días</option>
                    <option value="meses">Meses</option>
                  </select>
                </div>
              ) : null}
              {pagoModalidadUI === "adelanto" || pagoModalidadUI === "adelanto_saldo" ? (
                <div className="space-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      Monto de adelanto que deja el cliente (S/)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={`${inputClass} h-11`}
                      value={montoAdelantoUI}
                      onChange={(e) => {
                        setMontoAdelantoUI(e.target.value);
                        setDetalle((d) => ({ ...d, monto_adelanto: Number(e.target.value) || 0 }));
                      }}
                      placeholder="Ej: 500.00"
                    />
                  </label>
                  {montoAdelantoUI && Number(montoAdelantoUI) > 0 ? (
                    <p className="text-xs font-semibold text-[var(--color-accent)]">
                      Saldo pendiente:{" "}
                      <strong>
                        {formatPen(Math.max(0, totalGralSafe - (Number(montoAdelantoUI) || 0)))}
                      </strong>
                      {" "}de{" "}
                      <strong>{formatPen(totalGralSafe)}</strong>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {(tipoCotizacionPreset === "aserradero" || tipoCotizacionPreset === "general") && detalle.aserradero ? (
              <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Datos aserradero</span>
                <select
                  className={`${inputClass} h-11`}
                  value={detalle.aserradero.modo}
                  onChange={(e) =>
                    setDetalle((d) =>
                      d.aserradero ? { ...d, aserradero: { ...d.aserradero, modo: e.target.value as "hora" | "total" } } : d,
                    )
                  }
                >
                  <option value="hora">Por tiempo</option>
                  <option value="total">Monto total</option>
                </select>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(
                    [
                      {
                        label: "Espesor",
                        unidad: asrUnidadEspesorUI,
                        setUnidad: setAsrUnidadEspesorUI,
                        medida: asrMedidaEspesorUI,
                        setMedida: setAsrMedidaEspesorUI,
                      },
                      {
                        label: "Ancho",
                        unidad: asrUnidadAnchoUI,
                        setUnidad: setAsrUnidadAnchoUI,
                        medida: asrMedidaAnchoUI,
                        setMedida: setAsrMedidaAnchoUI,
                      },
                      {
                        label: "Largo",
                        unidad: asrUnidadLargoUI,
                        setUnidad: setAsrUnidadLargoUI,
                        medida: asrMedidaLargoUI,
                        setMedida: setAsrMedidaLargoUI,
                      },
                    ] as const
                  ).map(({ label, unidad, setUnidad, medida, setMedida }) => (
                    <div key={`asr-${label}`} className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--color-text-secondary)]">{label}</span>
                      <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-accent)]/50 transition-all">
                        <input
                          type="number"
                          className="w-full border-none bg-transparent h-10 px-3 text-sm focus:outline-none focus:ring-0 text-[var(--color-text-primary)]"
                          value={medida}
                          onChange={(e) => setMedida(e.target.value)}
                          placeholder="0"
                        />
                        <select
                          className="border-l border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 px-2 h-10 text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-0 cursor-pointer"
                          value={unidad}
                          onChange={(e) => {
                            const newUnit = e.target.value as "" | "mm" | "cm" | "m" | "in" | "ft";
                            if (label === "Espesor") {
                              const valIn = toInches(Number(asrMedidaEspesorUI) || 0, asrUnidadEspesorUI);
                              setUnidad(newUnit);
                              setMedida(inchesToUI(valIn, newUnit));
                            } else if (label === "Ancho") {
                              const valIn = toInches(Number(asrMedidaAnchoUI) || 0, asrUnidadAnchoUI);
                              setUnidad(newUnit);
                              setMedida(inchesToUI(valIn, newUnit));
                            } else {
                              const valFt = toFeet(Number(asrMedidaLargoUI) || 0, asrUnidadLargoUI);
                              setUnidad(newUnit);
                              setMedida(feetToUI(valFt, newUnit));
                            }
                          }}
                          aria-label={`Unidad ${label}`}
                        >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="m">m</option>
                          <option value="in">in</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  PT por unidad: <strong>{conversionAserraderoUI.ptUnit.toFixed(2)}</strong> · PT total:{" "}
                  <strong>{asrPtTotal.toFixed(2)}</strong>
                </p>
                {detalle.aserradero.modo === "hora" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className={`${inputClass} h-11`}
                      placeholder="Precio unitario (S/ por PT)"
                      value={detalle.aserradero.precioHora || ""}
                      onChange={(e) =>
                        setDetalle((d) =>
                          d.aserradero ? { ...d, aserradero: { ...d.aserradero, precioHora: Number(e.target.value) || 0 } } : d,
                        )
                      }
                    />
                    <input
                      type="number"
                      className={`${inputClass} h-11`}
                      placeholder="Cantidad"
                      value={detalle.aserradero.horas || ""}
                      onChange={(e) =>
                        setDetalle((d) =>
                          d.aserradero ? { ...d, aserradero: { ...d.aserradero, horas: Number(e.target.value) || 0 } } : d,
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      type="number"
                      className={`${inputClass} h-11`}
                      placeholder="Monto total aserradero"
                      value={detalle.aserradero.montoTotalFijo || ""}
                      onChange={(e) =>
                        setDetalle((d) =>
                          d.aserradero
                            ? { ...d, aserradero: { ...d.aserradero, montoTotalFijo: Number(e.target.value) || 0 } }
                            : d,
                        )
                      }
                    />
                    <button
                      type="button"
                      className="h-11 rounded-xl border border-[var(--color-border)] px-3 text-xs font-semibold"
                      onClick={() =>
                        setDetalle((d) =>
                          d.aserradero
                            ? { ...d, aserradero: { ...d.aserradero, montoTotalFijo: asrTotalEstimado } }
                            : d,
                        )
                      }
                    >
                      Usar estimado
                    </button>
                  </div>
                )}
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Estimado por medida: <strong>{formatPen(asrTotalEstimado)}</strong> (PT total x precio unitario)
                </p>
              </div>
            ) : null}

            {(tipoCotizacionPreset === "alquiler" || tipoCotizacionPreset === "general") && detalle.alquiler ? (
              <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
                <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Datos alquiler</span>
                <input
                  className={`${inputClass} h-11`}
                  placeholder="Nombre maquinaria"
                  value={detalle.alquiler.nombre_maquinaria}
                  onChange={(e) =>
                    setDetalle((d) =>
                      d.alquiler ? { ...d, alquiler: { ...d.alquiler, nombre_maquinaria: e.target.value } } : d,
                    )
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={`${inputClass} h-11`}
                    value={detalle.alquiler.tarifaUnidad}
                    onChange={(e) =>
                      setDetalle((d) =>
                        d.alquiler
                          ? { ...d, alquiler: { ...d.alquiler, tarifaUnidad: e.target.value as "hora" | "dia" } }
                          : d,
                      )
                    }
                  >
                    <option value="hora">Por hora</option>
                    <option value="dia">Por dia</option>
                  </select>
                  <input
                    type="number"
                    className={`${inputClass} h-11`}
                    placeholder="Tarifa"
                    value={detalle.alquiler.tarifa || ""}
                    onChange={(e) =>
                      setDetalle((d) =>
                        d.alquiler ? { ...d, alquiler: { ...d.alquiler, tarifa: Number(e.target.value) || 0 } } : d,
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden">
            {(
              [
                ["muebles", "Muebles"],
                ["aserradero", "Aserradero"],
                ["alquiler", "Alquiler"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={detalle.rubros[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDetalle((d) => {
                      const rubros = { ...d.rubros, [key]: checked };
                      const base = { ...d, rubros };
                      if (key === "muebles" && checked && base.muebles_lineas.length === 0) {
                        return { ...base, muebles_lineas: [emptyLineaMadera()] };
                      }
                      if (key === "aserradero") {
                        return {
                          ...base,
                          aserradero: checked
                            ? (d.aserradero ?? defaultCotizacionDetalleV1().aserradero)
                            : d.aserradero,
                        };
                      }
                      if (key === "alquiler") {
                        return {
                          ...base,
                          alquiler: checked ? (d.alquiler ?? defaultCotizacionDetalleV1().alquiler) : d.alquiler,
                        };
                      }
                      return base;
                    });
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className={navBtnSecondaryClass}>
              Anterior
            </button>
            <button type="button" onClick={next} className={navBtnClass}>
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "muebles" ? (
        <Card className="space-y-4 border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <CardTitle>Muebles — madera y cubicaje (pies-tablar)</CardTitle>
          <CardDescription>
            Resumen simplificado de medidas y cobro para la cotización de muebles personalizados.
          </CardDescription>
          
          <div className="grid gap-4 md:grid-cols-2">
            {/* Card 1: Información de Madera y Cubicaje */}
            <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-5">
              <p className="text-sm font-bold uppercase text-[var(--color-text-secondary)]">Madera y Cubicaje</p>
              
              <div className="grid grid-cols-[1.2fr_1fr] gap-2 pt-2">
                <span className={pillClass}>Categoría Mueble</span>
                <Combobox
                  options={muebleTipoComboboxOptions}
                  value={tipoMuebleVista}
                  onChange={setTipoMuebleVista}
                  placeholder="Buscar tipo de mueble…"
                  inputAriaLabel="Tipo de mueble"
                />
              </div>

              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 text-sm text-[var(--color-text-primary)]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-secondary)]">Volumen de Madera (PT):</span>
                  <strong className="text-[var(--color-accent)] font-extrabold">
                    {totalPtMueblesActual.toFixed(2)} PT
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-secondary)]">Precio por Pie (S/):</span>
                  <strong>{formatPen(parseDecimalInput(precioVentaPtUI))}</strong>
                </div>
              </div>
            </div>

            {/* Card 2: Totales y Desglose de Cobro */}
            <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-5 flex flex-col justify-between">
              <div>
                <p className="text-sm font-bold uppercase text-[var(--color-text-secondary)]">Detalle del Cobro</p>
                
                <div className="mt-4 space-y-3 text-sm text-[var(--color-text-primary)]">
                  <div className="flex items-center justify-between">
                    <span>Cliente:</span>
                    <strong className="font-extrabold">{nombreCliente || "Sin definir"}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Madera Proyectada:</span>
                    <strong>{formatPen(totalMaderaProyectado)}</strong>
                  </div>
                  {parseDecimalInput(costoManoObraUI) > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Mano de Obra:</span>
                      <strong>{formatPen(parseDecimalInput(costoManoObraUI))}</strong>
                    </div>
                  )}
                  {parseDecimalInput(costoAcabadoSolesUI) > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Acabado / Terminación:</span>
                      <strong>{formatPen(parseDecimalInput(costoAcabadoSolesUI))}</strong>
                    </div>
                  )}
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <div className="flex items-center justify-between">
                      <span>Costo de producción:</span>
                      <strong>{formatPen(resumenMargen.costoProduccion)}</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Margen de ganancia ({resumenMargen.margenPct.toFixed(1)}%):</span>
                      <strong>{formatPen(resumenMargen.ganancia)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Precio sugerido final</p>
                <p className="mt-1 text-4xl font-black text-[var(--color-accent)]">{formatPen(resumenMargen.precioSugerido)}</p>
                {tipoMuebleVista && (
                  <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                    Tipo de mueble: {selectedTipoMuebleLabel}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Seccion de Costos Internos Colapsada por defecto */}
          {detalle.rubros.muebles && detalle.muebles_lineas.length > 0 ? (
            <details className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-all duration-200">
              <summary className="flex cursor-pointer items-center justify-between p-4 font-bold text-sm text-[var(--color-text-secondary)] select-none hover:bg-[var(--color-primary-soft)]/20">
                <span className="flex items-center gap-2">
                  ⚙️ Ver costos internos y margen (Avanzado)
                </span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-primary-soft)]/5 space-y-4">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Esta sección muestra los costos y márgenes estimados del taller. No se incluye en el PDF impreso del cliente.
                </p>
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] mb-3">
                  <div>
                    Pies Tablares Netos: <strong className="text-[var(--color-text-primary)]">{totalPtMueblesActual.toFixed(2)} PT</strong>
                  </div>
                  <div>
                    Desperdicio de Madera: <strong className="text-[var(--color-text-primary)]">{detalle.desperdicioPctMuebles}%</strong>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {detalle.muebles_lineas.map((linea, idx) => {
                    const eco = economiaLineaMueble(linea, detalle.desperdicioPctMuebles);
                    const margenNegativo = eco.margenSoles != null && eco.margenSoles < 0;
                    return (
                      <div
                        key={linea.id}
                        className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm"
                      >
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          Línea {idx + 1}
                          {linea.especie_label ? ` · ${linea.especie_label}` : ""}
                        </p>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            Costo por PT — lo que pagaste por la madera (S/, opcional)
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className={`${inputClass} h-10`}
                            value={linea.costoPorPt === undefined ? "" : linea.costoPorPt}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setDetalle((d) => {
                                const lineas = [...d.muebles_lineas];
                                const cur = lineas[idx];
                                if (!cur) return d;
                                let nextCost: number | undefined;
                                if (raw === "") nextCost = undefined;
                                else {
                                  const n = Number(raw);
                                  nextCost = Number.isFinite(n) && n >= 0 ? n : undefined;
                                }
                                lineas[idx] = { ...cur, costoPorPt: nextCost };
                                return { ...d, muebles_lineas: lineas };
                              });
                            }}
                            placeholder="Ej: 12"
                          />
                        </label>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          PT compra (con desperdicio): <strong>{eco.ptCompra.toFixed(2)}</strong>
                        </p>
                        <div className="space-y-1 rounded-lg bg-[var(--color-primary-soft)]/25 px-3 py-2 text-xs">
                          <p>
                            Costo estimado:{" "}
                            <strong>
                              {eco.costoEstimado != null ? formatPen(eco.costoEstimado) : "—"}
                            </strong>{" "}
                            <span className="text-[var(--color-text-secondary)]">
                              (PT compra × costo por PT)
                            </span>
                          </p>
                          <p>
                            Precio de venta: <strong>{formatPen(eco.precioVenta)}</strong>{" "}
                            <span className="text-[var(--color-text-secondary)]">
                              (PT compra × precio venta por PT)
                            </span>
                          </p>
                          <p className={margenNegativo ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                            Margen:{" "}
                            {eco.margenSoles != null ? (
                              <>
                                {formatPen(eco.margenSoles)}
                                {eco.margenPct != null ? ` (${eco.margenPct.toFixed(1)}%)` : ""}
                              </>
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          ) : null}

          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className={navBtnSecondaryClass}>
              Anterior
            </button>
            <button type="button" onClick={next} className={navBtnClass}>
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "aserradero" && detalle.aserradero ? (
        <Card className="space-y-4 p-5">
          <CardTitle>Aserradero — mano de obra</CardTitle>
          <CardDescription>Cobrá por tiempo (hora × tarifa) o un monto cerrado.</CardDescription>
          <div className="flex gap-3">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${detalle.aserradero.modo === "hora" ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]" : "border"
                }`}
              onClick={() =>
                setDetalle((d) =>
                  d.aserradero
                    ? { ...d, aserradero: { ...d.aserradero, modo: "hora" } }
                    : d,
                )
              }
            >
              Por tiempo
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${detalle.aserradero.modo === "total" ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]" : "border"
                }`}
              onClick={() =>
                setDetalle((d) =>
                  d.aserradero
                    ? { ...d, aserradero: { ...d.aserradero, modo: "total" } }
                    : d,
                )
              }
            >
              Monto total
            </button>
          </div>
          {detalle.aserradero.modo === "hora" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">S/ por hora (definís vos)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={detalle.aserradero.precioHora || ""}
                  onChange={(e) =>
                    setDetalle((d) =>
                      d.aserradero
                        ? {
                          ...d,
                          aserradero: { ...d.aserradero, precioHora: Number(e.target.value) || 0 },
                        }
                        : d,
                    )
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">Horas</span>
                <input
                  type="number"
                  className={inputClass}
                  value={detalle.aserradero.horas || ""}
                  onChange={(e) =>
                    setDetalle((d) =>
                      d.aserradero
                        ? {
                          ...d,
                          aserradero: { ...d.aserradero, horas: Number(e.target.value) || 0 },
                        }
                        : d,
                    )
                  }
                />
              </label>
              <p className="md:col-span-2 text-sm">
                Sugerido:{" "}
                <strong>
                  {formatPen(round2(detalle.aserradero.precioHora * detalle.aserradero.horas))}
                </strong>
              </p>
            </div>
          ) : (
            <label className="space-y-1">
              <span className="text-xs font-medium">Monto mano de obra (S/)</span>
              <input
                type="number"
                className={inputClass}
                value={detalle.aserradero.montoTotalFijo || ""}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.aserradero
                      ? {
                        ...d,
                        aserradero: {
                          ...d.aserradero,
                          montoTotalFijo: Number(e.target.value) || 0,
                        },
                      }
                      : d,
                  )
                }
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-xs font-medium">Descripción del trabajo</span>
            <textarea
              className={`${inputClass} min-h-[72px] py-2`}
              value={detalle.aserradero.descripcion}
              onChange={(e) =>
                setDetalle((d) =>
                  d.aserradero
                    ? { ...d, aserradero: { ...d.aserradero, descripcion: e.target.value } }
                    : d,
                )
              }
            />
          </label>
          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold">
              Atrás
            </button>
            <button type="button" onClick={next} className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)]">
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "alquiler" && detalle.alquiler ? (
        <Card className="space-y-4 p-5">
          <CardTitle>Alquiler de maquinaria</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium">Equipo en inventario (opcional)</span>
              <Combobox
                options={alquilerProductoComboboxOptions}
                value={detalle.alquiler.inventario_producto_id ?? ""}
                onChange={(pidStr) => {
                  const pid = pidStr || null;
                  const p = productoById(pid);
                  setDetalle((d) =>
                    d.alquiler
                      ? {
                        ...d,
                        alquiler: {
                          ...d.alquiler,
                          inventario_producto_id: pid,
                          nombre_maquinaria: p?.nombre ?? d.alquiler.nombre_maquinaria,
                        },
                      }
                      : d,
                  );
                }}
                placeholder="Buscar equipo…"
                inputAriaLabel="Equipo en inventario para alquiler"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium">Nombre maquinaria</span>
              <input
                className={inputClass}
                value={detalle.alquiler.nombre_maquinaria}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? { ...d, alquiler: { ...d.alquiler, nombre_maquinaria: e.target.value } }
                      : d,
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Unidad de cobro</span>
              <select
                className={inputClass}
                value={detalle.alquiler.tarifaUnidad}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? {
                        ...d,
                        alquiler: {
                          ...d.alquiler,
                          tarifaUnidad: e.target.value as "hora" | "dia",
                        },
                      }
                      : d,
                  )
                }
              >
                <option value="hora">Por hora</option>
                <option value="dia">Por día</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Tarifa (S/)</span>
              <input
                type="number"
                className={inputClass}
                value={detalle.alquiler.tarifa || ""}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? {
                        ...d,
                        alquiler: {
                          ...d.alquiler,
                          tarifa: Number(e.target.value) || 0,
                        },
                      }
                      : d,
                  )
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Tiempo ({detalle.alquiler.tarifaUnidad === "hora" ? "horas" : "días"})</span>
              <input
                type="number"
                className={inputClass}
                value={detalle.alquiler.unidades_tiempo || ""}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? {
                        ...d,
                        alquiler: {
                          ...d.alquiler,
                          unidades_tiempo: Number(e.target.value) || 0,
                        },
                      }
                      : d,
                  )
                }
              />
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={detalle.alquiler.incluye_garantia_danios}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? {
                        ...d,
                        alquiler: {
                          ...d.alquiler,
                          incluye_garantia_danios: e.target.checked,
                        },
                      }
                      : d,
                  )
                }
              />
              <span className="text-sm">Incluir garantía / posibles daños</span>
            </label>
            {detalle.alquiler.incluye_garantia_danios ? (
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-medium">Monto garantía / daños (S/)</span>
                <input
                  type="number"
                  className={inputClass}
                  value={detalle.alquiler.monto_garantia || ""}
                  onChange={(e) =>
                    setDetalle((d) =>
                      d.alquiler
                        ? {
                          ...d,
                          alquiler: {
                            ...d.alquiler,
                            monto_garantia: Number(e.target.value) || 0,
                          },
                        }
                        : d,
                    )
                  }
                />
              </label>
            ) : null}
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium">Notas</span>
              <textarea
                className={`${inputClass} min-h-[56px] py-2`}
                value={detalle.alquiler.notas}
                onChange={(e) =>
                  setDetalle((d) =>
                    d.alquiler
                      ? { ...d, alquiler: { ...d.alquiler, notas: e.target.value } }
                      : d,
                  )
                }
              />
            </label>
          </div>
          <p className="text-sm">
            Subtotal uso: <strong>{formatPen(safeMoney(totales.alquiler_base))}</strong>
            {safeMoney(totales.garantia) > 0 ? (
              <>
                {" "}
                + garantía <strong>{formatPen(safeMoney(totales.garantia))}</strong>
              </>
            ) : null}{" "}
            → Total rubro: <strong>{formatPen(safeMoney(totales.alquiler))}</strong>
          </p>
          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold">
              Atrás
            </button>
            <button type="button" onClick={next} className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)]">
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "resumen" ? (
        <Card className="space-y-5 overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--katia-primary)]">Resumen final</p>
            <CardTitle className="mt-1">Vista previa — cotización formal</CardTitle>
            <CardDescription>
              Misma maquetación que PDF / impresión. Correlativo mostrado:{" "}
              <strong>{correlativoMostrar}</strong>
              {!guardadaId ? " (previsualización; al guardar se confirma el número)" : null}
            </CardDescription>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Revisa cliente, producto o servicio y total. Luego guarda la cotización, imprímela o conviértela a venta cuando esté aceptada.
            </p>
          </div>

          <div className="px-3 pb-2 sm:px-5">
            <CotizacionResumenFormal
              correlativoLabel={correlativoMostrar}
              fechaISO={fecha}
              nombreCliente={nombreCliente}
              tipoCliente={tipoCliente}
              documentoCliente={documento.trim() || null}
              lineas={lineasFormalSafe}
              notasGenerales={(() => {
                const base = "";
                if (pagoModalidadUI === "adelanto" && montoAdelantoUI && Number(montoAdelantoUI) > 0) {
                  const adelanto = Number(montoAdelantoUI);
                  const saldo = Math.max(0, totalGralSafe - adelanto);
                  const lineasPago = [
                    `Modalidad: Adelanto`,
                    `Monto adelantado: S/ ${adelanto.toFixed(2)}`,
                    `Saldo pendiente: S/ ${saldo.toFixed(2)}`,
                    ...(plazoDiasUI ? [`Plazo para saldo: ${plazoDiasUI} ${plazoUnidadUI}`] : []),
                  ].join("\n");
                  return base ? `${base}\n${lineasPago}` : lineasPago;
                }
                if (pagoModalidadUI === "credito" && plazoDiasUI) {
                  const lineaCredito = `Modalidad: Crédito · Plazo ${plazoDiasUI} ${plazoUnidadUI}`;
                  return base ? `${base}\n${lineaCredito}` : lineaCredito;
                }
                return base;
              })()}
              total={totalGral}
              empresa={empresa}
              embedded
            />
          </div>

          <div className="mx-3 mb-4 rounded-xl border border-dashed border-amber-800/35 bg-amber-50/50 px-4 py-4 text-sm dark:border-amber-500/30 dark:bg-amber-950/30 sm:mx-5">
            <p className="mb-3 font-bold text-[var(--color-text-primary)]">
              Uso interno — economía estimada (no va al PDF del cliente)
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between gap-3 rounded-lg bg-[var(--color-primary-soft)]/20 px-3 py-2">
                <dt className="text-[var(--color-text-secondary)]">Costo total estimado</dt>
                <dd className="font-semibold tabular-nums">{formatPen(resumenMargen.costoProduccion)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-[var(--color-primary-soft)]/20 px-3 py-2">
                <dt className="text-[var(--color-text-secondary)]">Precio total (cotización)</dt>
                <dd className="font-semibold tabular-nums">{formatPen(resumenMargen.precioSugerido)}</dd>
              </div>
              <div
                className={`flex justify-between gap-3 rounded-lg px-3 py-2 sm:col-span-2 ${economiaInterna.gananciaEstimada < 0
                    ? "bg-red-500/15 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-[var(--color-primary-soft)]/20"
                  }`}
              >
                <dt className={economiaInterna.gananciaEstimada < 0 ? "" : "text-[var(--color-text-secondary)]"}>
                  Ganancia estimada
                </dt>
                <dd className="tabular-nums">{formatPen(resumenMargen.ganancia)}</dd>
              </div>
              <div
                className={`flex justify-between gap-3 rounded-lg px-3 py-2 sm:col-span-2 ${(economiaInterna.margenPct ?? 0) < 0
                    ? "bg-red-500/15 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-[var(--color-primary-soft)]/20"
                  }`}
              >
                <dt className={(economiaInterna.margenPct ?? 0) < 0 ? "" : "text-[var(--color-text-secondary)]"}>
                  Margen %
                </dt>
                <dd className="tabular-nums">
                  {economiaInterna.margenPct != null ? `${economiaInterna.margenPct.toFixed(1)}%` : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              El costo incluye PT × costo por PT por línea de madera y el costo fijo de acabado (si aplica). Los rubros
              aserradero/alquiler no tienen costo cargado aquí.
            </p>
          </div>

          <div className="space-y-3 border-t border-[var(--color-border)] px-5 py-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Descripción / notas comerciales
              </span>
              <textarea
                className={`${inputClass} min-h-[88px] py-2`}
                placeholder="Ej: Acabado barniz natural. Incluye instalación en obra. No incluye bisagras ni cerraduras..."
                value={descripcionManual}
                onChange={(e) => setDescripcionManual(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleGuardarDescripcion}
                className="h-9 rounded-lg bg-[var(--color-primary-soft)]/20 px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-primary-soft)]/35 transition-colors border border-[var(--color-border)]"
              >
                Guardar descripción
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleRestablecerDescripcion}
                className="h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Restablecer descripción automática
              </button>
            </div>
            {toastMessage && (
              <p className="text-xs font-semibold text-[var(--color-success)] animate-pulse mt-1">
                {toastMessage}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => handleGuardar("pendiente")}
              className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
            >
              Guardar cotización
            </button>
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => handleGuardar("lista_produccion")}
              className="h-10 rounded-xl border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-50"
            >
              Marcar cotización aceptada
            </button>
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => handleGuardar("pendiente", true)}
              className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Guardar e imprimir cotización
            </button>
            <button
              type="button"
              disabled={!guardadaId}
              onClick={() => guardadaId && window.open(`/cotizacion/unificada/${guardadaId}/pdf`, "_blank")}
              className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Imprimir cotización
            </button>
            <button
              type="button"
              disabled={!guardadaId || !canSave || busy || guardadaRow?.estado_flujo === "pendiente"}
              onClick={async () => {
                if (!guardadaId) return;
                if (!confirm("¿Convertir esta cotización aceptada a venta y registrar el ingreso en caja?")) return;
                setBusy(true);
                const r = await registrarCobroCotizacionUnificada(guardadaId);
                setBusy(false);
                if (!r.ok) setError(r.error);
                else window.location.reload();
              }}
              className="h-10 rounded-xl bg-[var(--color-success)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Convertir a venta
            </button>
            {tipoCotizacionPreset === "muebles" ? (
              <p className="w-full pt-1 text-xs text-[var(--color-text-secondary)]">
                Mueble personalizado se mantiene en estado pendiente.
              </p>
            ) : null}
          </div>

          {guardadaId ? (
            <div className="hidden flex-wrap gap-2 border-t border-[var(--color-border)] px-5 pt-4">
              {guardadaRow?.estado_flujo !== "cobrada" ? (
                <>
                  <button
                    type="button"
                    disabled={!canSave || busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await marcarListaProduccionCotizacion(guardadaId);
                      setBusy(false);
                      if (!r.ok) setError(r.error);
                      else window.location.reload();
                    }}
                    className="h-9 rounded-lg bg-amber-50 px-3 text-xs font-semibold text-amber-900"
                  >
                    Marcar lista producción
                  </button>
                  <button
                    type="button"
                    disabled={!canSave || busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await pasarCotizacionAProduccion(guardadaId);
                      setBusy(false);
                      if (!r.ok) setError(r.error);
                      else window.location.reload();
                    }}
                    className="h-9 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-900"
                  >
                    Pasar a producción (orden taller)
                  </button>
                </>
              ) : null}
              {puedeRegistrarCobro ? (
                <button
                  type="button"
                  disabled={!canSave || busy}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Registrar cobro: se creará un ingreso en caja por el total de la cotización y el estado pasará a cobrada.",
                      )
                    ) {
                      return;
                    }
                    setBusy(true);
                    const r = await registrarCobroCotizacionUnificada(guardadaId);
                    setBusy(false);
                    if (!r.ok) setError(r.error);
                    else window.location.reload();
                  }}
                  className="h-9 rounded-lg bg-teal-50 px-3 text-xs font-semibold text-teal-900"
                >
                  Registrar cobro (caja)
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-between gap-2 px-5 pb-5">
            <button type="button" onClick={back} className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold">
              Atrás
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <CardTitle className="text-base">Cotizaciones guardadas</CardTitle>
          <CardDescription>Cargá una para editarla o usá las acciones según estado.</CardDescription>
        </div>
        <div className="grid gap-3 border-b border-[var(--color-border)] px-5 py-4 md:grid-cols-4">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Buscar</span>
            <input
              className={inputClass}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Cliente, correlativo, estado, fecha..."
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Estado</span>
            <select
              className={inputClass}
              value={filterEstado}
              onChange={(e) =>
                setFilterEstado(
                  e.target.value as
                  | "todos"
                  | "pendiente"
                  | "lista_produccion"
                  | "produccion"
                  | "terminado"
                  | "entregado"
                  | "cobrada"
                  | "inactivo"
                  | "deudor",
                )
              }
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="lista_produccion">Cotización aceptada</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Desde</span>
              <input
                type="date"
                className={inputClass}
                value={filterFechaDesde}
                onChange={(e) => setFilterFechaDesde(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Hasta</span>
              <input
                type="date"
                className={inputClass}
                value={filterFechaHasta}
                onChange={(e) => setFilterFechaHasta(e.target.value)}
              />
            </label>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-primary-soft)]/30">
            <tr>
              <th className="px-3 py-2 text-left">Correlativo</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cotizacionesFiltradas.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-mono text-xs">{c.correlativo ?? c.id.slice(0, 8)}</td>
                <td className="px-3 py-2">{clientesById.get(c.cliente_id)?.nombre ?? "—"}</td>
                <td className="px-3 py-2">{c.fecha}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatPen(c.total)}</td>
                <td className="px-3 py-2">
                  <select
                    value={c.estado_flujo}
                    onChange={async (e) => {
                      const nuevo = e.target.value as Parameters<typeof cambiarEstadoCotizacionUnificada>[1];
                      if (!confirm(`¿Cambiar el estado de la cotización a "${nuevo}"?`)) return;
                      const r = await cambiarEstadoCotizacionUnificada(c.id, nuevo);
                      if (!r.ok) alert(r.error);
                      else window.location.reload();
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border-none cursor-pointer focus:ring-2 focus:ring-[var(--color-accent)] ${c.estado_flujo === "pendiente"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                        : c.estado_flujo === "lista_produccion"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          : c.estado_flujo === "en_produccion"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : c.estado_flujo === "cobrada"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                              : c.estado_flujo === "terminado"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                                : c.estado_flujo === "entregado"
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                  : c.estado_flujo === "inactivo"
                                    ? "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                      }`}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="lista_produccion">Cotización aceptada</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    {c.estado_flujo !== "cobrada" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                        onClick={() => {
                          loadCotizacion(c);
                          router.push(`/cotizacion?editar=${c.id}`);
                          setTimeout(() => {
                            const element = document.getElementById("cotizacion-wizard");
                            if (element) {
                              element.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }, 50);
                        }}
                      >
                        Editar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-semibold hover:underline"
                      onClick={() => window.open(`/cotizacion/unificada/${c.id}/pdf`, "_blank")}
                    >
                      PDF
                    </button>
                    {(c.estado_flujo === "lista_produccion" || c.estado_flujo === "en_produccion") &&
                      canSave ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                        onClick={async () => {
                          if (
                            !confirm(
                              `¿Registrar cobro de ${c.correlativo ?? c.id.slice(0, 8)}? Se guardará un ingreso en caja.`,
                            )
                          ) {
                            return;
                          }
                          const r = await registrarCobroCotizacionUnificada(c.id);
                          if (!r.ok) setError(r.error);
                          else window.location.reload();
                        }}
                      >
                        Convertir a venta
                      </button>
                    ) : null}
                    {c.estado_flujo !== "cobrada" && canSave ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:underline"
                        onClick={async () => {
                          if (!confirm(`¿Eliminar esta cotización (${c.correlativo ?? c.id.slice(0, 8)})?`)) return;
                          const r = await deleteCotizacionUnificada(c.id);
                          if (!r.ok) setError(r.error);
                          else window.location.reload();
                        }}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cotizacionesFiltradas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">Aún no hay cotizaciones unificadas guardadas.</p>
        ) : null}
      </Card>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {!canSave ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Tu rol no puede guardar cambios en cotización.</p>
      ) : null}
    </div>
  );
}
