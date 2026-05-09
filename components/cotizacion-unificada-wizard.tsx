"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createClienteCotizacionRapida,
  deleteCotizacionUnificada,
  marcarListaProduccionCotizacion,
  pasarCotizacionAProduccion,
  registrarCobroCotizacionUnificada,
  saveCotizacionUnificada,
} from "@/app/actions";
import {
  computeEconomiaInterna,
  computeTotalesDetalle,
  economiaLineaMueble,
  round2,
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
import { buildLineasResumen } from "@/lib/cotizacion-unificada-lineas";
import type { EmpresaConfig } from "@/lib/company-config";
import { formatPen } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type InventarioProductoRow = Database["public"]["Tables"]["inventario_productos"]["Row"];
type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];
type CotizacionUnificadaRow = Database["public"]["Tables"]["cotizaciones_unificadas"]["Row"];

type CotizacionUnificadaWizardProps = {
  canSave: boolean;
  /** Siguiente N° de cotización (solo lectura; se calcula en el servidor). */
  correlativoPreview: string;
  productos: InventarioProductoRow[];
  clientes: ClienteRow[];
  cotizacionesGuardadas: CotizacionUnificadaRow[];
  empresa: EmpresaConfig;
};

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]/60 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";
const panelClass =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5";
const pillClass =
  "rounded-full border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-5 py-2 text-sm font-semibold text-[var(--color-text-primary)]";
const navBtnClass =
  "h-10 min-w-28 rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:brightness-110";
const MUEBLE_TEMPLATES_KEY = "cotizacion_muebles_templates_v1";
const COTIZACION_DRAFT_KEY = "cotizacion_unificada_draft_v1";

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
  pagoMetodoUI: "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro";
  pagoModalidadUI: "" | "contado" | "adelanto" | "credito";
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
  pagoMetodoUI: "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro";
  pagoModalidadUI: "" | "contado" | "adelanto" | "credito";
  plazoDiasUI: string;
  plazoUnidadUI: "dias" | "meses";
};

function newId() {
  return crypto.randomUUID();
}

function emptyPieza(): MuebleLineaPieza {
  return {
    id: newId(),
    cantidad: 1,
    espesor: 2,
    ancho: 6,
    largo: 8,
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

function toFeet(value: number, unit: "" | "mm" | "cm" | "m" | "in" | "ft") {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === "mm") return value / 304.8;
  if (unit === "cm") return value / 30.48;
  if (unit === "m") return value * 3.280839895;
  if (unit === "in") return value / 12;
  return value;
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
  const doc = (cliente.documento ?? "").replace(/\D/g, "");
  if (doc.length === 11) return true; // RUC usual
  if (doc.length === 8) return false; // DNI usual
  const name = cliente.nombre.toLowerCase();
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

export function CotizacionUnificadaWizard({
  canSave,
  correlativoPreview,
  productos,
  clientes,
  cotizacionesGuardadas,
  empresa,
}: CotizacionUnificadaWizardProps) {
  const router = useRouter();
  const [tipoCliente, setTipoCliente] = useState<"natural" | "empresa">("natural");
  const [nombreCliente, setNombreCliente] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [detalle, setDetalle] = useState<CotizacionDetalleV1>(() => defaultCotizacionDetalleV1());
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
  const [pagoMetodoUI, setPagoMetodoUI] = useState<
    "efectivo" | "transferencia" | "yape" | "billetera_digital" | "otro"
  >("efectivo");
  const [pagoModalidadUI, setPagoModalidadUI] = useState<"" | "contado" | "adelanto" | "credito">("");
  const [plazoDiasUI, setPlazoDiasUI] = useState("15");
  const [plazoUnidadUI, setPlazoUnidadUI] = useState<"dias" | "meses">("dias");
  const [asrUnidadEspesorUI, setAsrUnidadEspesorUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrUnidadAnchoUI, setAsrUnidadAnchoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrUnidadLargoUI, setAsrUnidadLargoUI] = useState<"" | "mm" | "cm" | "m" | "in" | "ft">("cm");
  const [asrMedidaEspesorUI, setAsrMedidaEspesorUI] = useState("");
  const [asrMedidaAnchoUI, setAsrMedidaAnchoUI] = useState("");
  const [asrMedidaLargoUI, setAsrMedidaLargoUI] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filterEstado, setFilterEstado] = useState<
    "todos" | "pendiente" | "lista_produccion" | "produccion" | "cobrada"
  >("todos");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [muebleTemplates, setMuebleTemplates] = useState<MuebleTemplate[]>(loadMuebleTemplatesFromStorage);
  const [selectedMuebleTemplateId, setSelectedMuebleTemplateId] = useState("");
  const [hasDraftAvailable, setHasDraftAvailable] = useState(() => Boolean(loadDraftFromStorage()));
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => loadDraftFromStorage()?.savedAt ?? null);

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
          pagoModalidadUI,
      ),
    [
      acabadoUI,
      costoAcabadoSolesUI,
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
    const base: string[] = ["tipo", "cliente", "rubros"];
    if (detalle.rubros.muebles) base.push("muebles");
    if (detalle.rubros.aserradero) base.push("aserradero");
    if (detalle.rubros.alquiler) base.push("alquiler");
    base.push("resumen");
    return base;
  }, [detalle.rubros]);

  const effectiveStepIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStepId = steps[effectiveStepIndex] ?? "tipo";

  const totales = useMemo(() => computeTotalesDetalle(detalle), [detalle]);
  const totalGral = useMemo(() => totalGeneralDetalle(detalle), [detalle]);
  const totalGralSafe = Number.isFinite(totalGral) ? totalGral : 0;
  const economiaInterna = useMemo(() => computeEconomiaInterna(detalle), [detalle]);
  const conversionMedidasUI = useMemo(() => {
    const esp = Number(medidaEspesorUI) || 0;
    const anc = Number(medidaAnchoUI) || 0;
    const lar = Number(medidaLargoUI) || 0;
    const espIn = toInches(esp, unidadEspesorUI);
    const ancIn = toInches(anc, unidadAnchoUI);
    const larFt = toFeet(lar, unidadLargoUI);
    const pt = round2((espIn * ancIn * larFt) / 12);
    return { espIn, ancIn, larFt, pt };
  }, [medidaAnchoUI, medidaEspesorUI, medidaLargoUI, unidadAnchoUI, unidadEspesorUI, unidadLargoUI]);
  const totalMaderaProyectado = useMemo(() => {
    const precioPt = Number(precioVentaPtUI) || 0;
    return round2(conversionMedidasUI.pt * precioPt);
  }, [conversionMedidasUI.pt, precioVentaPtUI]);
  const conversionAserraderoUI = useMemo(() => {
    const esp = Number(asrMedidaEspesorUI) || 0;
    const anc = Number(asrMedidaAnchoUI) || 0;
    const lar = Number(asrMedidaLargoUI) || 0;
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
    const activos = productos.filter((p) => p.activo !== false);
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
  }, [productos]);
  const selectedTipoMuebleLabel = useMemo(
    () => muebleOptions.find((x) => x.id === tipoMuebleVista)?.nombre ?? "Mueble",
    [muebleOptions, tipoMuebleVista],
  );
  const clientesFiltrados = useMemo(
    () =>
      clientes.filter((c) =>
        tipoCliente === "empresa" ? isEmpresaClienteRow(c) : !isEmpresaClienteRow(c),
      ),
    [clientes, tipoCliente],
  );

  useEffect(() => {
    if (!clienteId) return;
    const found = clientesFiltrados.some((c) => c.id === clienteId);
    if (!found) {
      const timer = window.setTimeout(() => {
        setClienteId(null);
        setNombreCliente("");
        setDocumento("");
        setTelefono("");
        setDireccion("");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [clienteId, clientesFiltrados]);

  useEffect(() => {
    if (!(tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general")) return;
    const precioPt = Number(precioVentaPtUI) || 0;
    const selectedMadera = productos.find((p) => p.id === tipoMaderaUI) ?? null;
    const timer = window.setTimeout(() => {
      setDetalle((d) => {
        const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
        const first = lineas[0];
        const piezas = first.piezas.length > 0 ? [...first.piezas] : [emptyPieza()];
        const idx = Math.min(Math.max(0, selectedPiezaIndexSafe), Math.max(0, piezas.length - 1));
        const piezaBase = piezas[idx] ?? emptyPieza();
        piezas[idx] = {
          ...piezaBase,
          descripcion: selectedTipoMuebleLabel !== "Mueble" ? selectedTipoMuebleLabel : "Pieza",
          cantidad: 1,
          espesor: round2(conversionMedidasUI.espIn),
          ancho: round2(conversionMedidasUI.ancIn),
          largo: round2(conversionMedidasUI.larFt),
        };
        lineas[0] = {
          ...first,
          inventario_producto_id: selectedMadera?.id ?? first.inventario_producto_id,
          especie_label: selectedMadera?.nombre ?? first.especie_label,
          precioPorPt: precioPt,
          piezas,
        };
        return { ...d, muebles_lineas: lineas };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    conversionMedidasUI.ancIn,
    conversionMedidasUI.espIn,
    conversionMedidasUI.larFt,
    precioVentaPtUI,
    productos,
    selectedTipoMuebleLabel,
    selectedPiezaIndexSafe,
    tipoCotizacionPreset,
    tipoMaderaUI,
    unidadAnchoUI,
    unidadEspesorUI,
    unidadLargoUI,
  ]);

  const addPiezaDesdeDimensiones = useCallback(() => {
    let nextSelected = selectedPiezaIndexSafe;
    setDetalle((d) => {
      const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
      const first = lineas[0];
      const piezas = first.piezas.length > 0 ? [...first.piezas] : [emptyPieza()];
      const insertAt = piezas.length === 0 ? 0 : Math.min(Math.max(0, selectedPiezaIndexSafe), piezas.length - 1) + 1;
      const nueva = {
        ...emptyPieza(),
        descripcion: selectedTipoMuebleLabel !== "Mueble" ? selectedTipoMuebleLabel : "Pieza",
        cantidad: 1,
        espesor: round2(conversionMedidasUI.espIn),
        ancho: round2(conversionMedidasUI.ancIn),
        largo: round2(conversionMedidasUI.larFt),
      };
      piezas.splice(insertAt, 0, nueva);
      lineas[0] = { ...first, piezas };
      nextSelected = insertAt;
      return { ...d, muebles_lineas: lineas };
    });
    setSelectedPiezaIndexUI(nextSelected);
  }, [conversionMedidasUI.ancIn, conversionMedidasUI.espIn, conversionMedidasUI.larFt, selectedPiezaIndexSafe, selectedTipoMuebleLabel]);

  const removeSelectedPieza = useCallback(() => {
    let nextSelected = 0;
    setDetalle((d) => {
      const lineas = d.muebles_lineas.length > 0 ? [...d.muebles_lineas] : [emptyLineaMadera()];
      const first = lineas[0];
      const piezas = first.piezas.length > 0 ? [...first.piezas] : [emptyPieza()];
      const idx = Math.min(Math.max(0, selectedPiezaIndexSafe), piezas.length - 1);
      if (piezas.length <= 1) {
        lineas[0] = { ...first, piezas: [emptyPieza()] };
        nextSelected = 0;
        return { ...d, muebles_lineas: lineas };
      }
      piezas.splice(idx, 1);
      lineas[0] = { ...first, piezas };
      nextSelected = Math.max(0, idx - 1);
      return { ...d, muebles_lineas: lineas };
    });
    setSelectedPiezaIndexUI(nextSelected);
  }, [selectedPiezaIndexSafe]);

  const applyMuebleTemplate = useCallback(
    (templateId: string) => {
      setSelectedMuebleTemplateId(templateId);
      const selected = muebleTemplates.find((t) => t.id === templateId);
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
      setDetalle((d) => ({ ...d, costoAcabadoSoles: Number(selected.costoAcabadoSolesUI) || 0 }));
      setPagoMetodoUI(selected.pagoMetodoUI);
      setPagoModalidadUI(selected.pagoModalidadUI);
      setPlazoDiasUI(selected.plazoDiasUI);
      setPlazoUnidadUI(selected.plazoUnidadUI);
      setError("");
    },
    [muebleTemplates],
  );

  const saveCurrentMuebleTemplate = useCallback(() => {
    const name = window.prompt("Nombre de la plantilla de mueble:");
    if (!name || !name.trim()) return;
    const next: MuebleTemplate = {
      id: crypto.randomUUID(),
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
      pagoMetodoUI,
      pagoModalidadUI,
      plazoDiasUI,
      plazoUnidadUI,
    };
    setMuebleTemplates((current) => {
      const merged = [...current.filter((t) => t.name.toLowerCase() !== next.name.toLowerCase()), next];
      try {
        localStorage.setItem(MUEBLE_TEMPLATES_KEY, JSON.stringify(merged));
      } catch {
        // ignore local storage errors
      }
      return merged;
    });
    setSelectedMuebleTemplateId(next.id);
  }, [
    acabadoOtroUI,
    acabadoUI,
    costoAcabadoSolesUI,
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
      pagoMetodoUI,
      pagoModalidadUI,
      plazoDiasUI,
      plazoUnidadUI,
    };
    try {
      localStorage.setItem(COTIZACION_DRAFT_KEY, JSON.stringify(draft));
      setHasDraftAvailable(true);
      setDraftSavedAt(draft.savedAt);
    } catch {
      // Ignore localStorage errors.
    }
  }, [
    acabadoOtroUI,
    acabadoUI,
    costoAcabadoSolesUI,
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
    setHasDraftAvailable(false);
    setDraftSavedAt(null);
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
    setDetalle((d) => ({ ...d, costoAcabadoSoles: Number(draft.costoAcabadoSolesUI) || 0 }));
    setPagoMetodoUI(draft.pagoMetodoUI);
    setPagoModalidadUI(draft.pagoModalidadUI);
    setPlazoDiasUI(draft.plazoDiasUI);
    setPlazoUnidadUI(draft.plazoUnidadUI);
    setError("Borrador recuperado.");
    setHasDraftAvailable(true);
    setDraftSavedAt(draft.savedAt);
  }, [applyCotizacionPreset]);

  const resetWizardFast = useCallback(() => {
    setClienteId(null);
    setNombreCliente("");
    setDocumento("");
    setTelefono("");
    setDireccion("");
    setTipoCliente("natural");
    setTipoCotizacionPreset("muebles");
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
    setAcabadoOtroUI("");
    setPagoMetodoUI("efectivo");
    setPagoModalidadUI("");
    setPlazoDiasUI("15");
    setPlazoUnidadUI("dias");
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

  const lineasFormal = useMemo(() => buildLineasResumen(detalleParaLineas), [detalleParaLineas]);
  const lineasFormalSafe = useMemo(
    () =>
      lineasFormal.map((linea) => ({
        ...linea,
        precioUnit: safeMoney(linea.precioUnit),
        precioTotal: safeMoney(linea.precioTotal),
      })),
    [lineasFormal],
  );

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
    let lista = 0;
    let prod = 0;
    let cob = 0;
    for (const c of cotizacionesGuardadas) {
      if (c.estado_flujo === "pendiente") pend += 1;
      else if (c.estado_flujo === "lista_produccion") lista += 1;
      else if (c.estado_flujo === "en_produccion") prod += 1;
      else if (c.estado_flujo === "cobrada") cob += 1;
    }
    return { pend, lista, prod, cob };
  }, [cotizacionesGuardadas]);

  const guardadaRow = useMemo(
    () => (guardadaId ? cotizacionesGuardadas.find((c) => c.id === guardadaId) ?? null : null),
    [guardadaId, cotizacionesGuardadas],
  );
  const puedeRegistrarCobro = Boolean(
    guardadaRow &&
      (guardadaRow.estado_flujo === "lista_produccion" ||
        guardadaRow.estado_flujo === "en_produccion"),
  );
  const stepLabels: Record<string, string> = useMemo(
    () => ({
      tipo: "Tipo cliente",
      cliente: "Datos cliente",
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
    for (const c of clientes) map.set(c.id, c);
    return map;
  }, [clientes]);
  const cotizacionesFiltradas = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return cotizacionesGuardadas.filter((c) => {
      if (filterEstado !== "todos") {
        const esperado =
          filterEstado === "produccion" ? "en_produccion" : filterEstado;
        if (c.estado_flujo !== esperado) return false;
      }
      if (filterFechaDesde && c.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && c.fecha > filterFechaHasta) return false;
      if (!q) return true;
      const cliente = clientesById.get(c.cliente_id);
      const clienteNombre = (cliente?.nombre ?? "").toLowerCase();
      const correlativo = (c.correlativo ?? "").toLowerCase();
      const estado = c.estado_flujo.toLowerCase();
      return (
        correlativo.includes(q) ||
        c.fecha.includes(q) ||
        estado.includes(q) ||
        clienteNombre.includes(q) ||
        c.id.toLowerCase().includes(q)
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
    if (id === "tipo") {
      setMaxStep((m) => Math.max(m, idxNow + 1));
      setStepIndex(idxNow + 1);
      return;
    }
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
    async (estadoFlujo: "pendiente" | "lista_produccion", imprimir?: boolean) => {
      if (!canSave) {
        setError("Tu rol no puede guardar cotizaciones.");
        return;
      }
      if (tipoCotizacionPreset === "muebles" && estadoFlujo === "lista_produccion") {
        setError("Para mueble personalizado, la cotizacion debe guardarse como pendiente.");
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

      let det = { ...detalle };
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
    [canSave, clearDraft, detalle, ensureCliente, fecha, guardadaId, router, tipoCliente, tipoCotizacionPreset, totalGral],
  );

  const loadCotizacion = useCallback((row: CotizacionUnificadaRow) => {
    const d = parseCotizacionDetalle(row.detalle as unknown);
    setGuardadaId(row.id);
    setTipoCliente(row.tipo_cliente);
    setFecha(row.fecha);
    setDetalle(d);
    setClienteId(row.cliente_id);
    const cl = clientes.find((c) => c.id === row.cliente_id);
    setNombreCliente(cl?.nombre ?? "");
    setDocumento(cl?.documento ?? "");
    setTelefono(cl?.telefono ?? "");
    setDireccion(cl?.direccion ?? "");
    if (d.rubros.muebles && d.rubros.aserradero && d.rubros.alquiler) setTipoCotizacionPreset("general");
    else if (d.rubros.aserradero) setTipoCotizacionPreset("aserradero");
    else if (d.rubros.alquiler) setTipoCotizacionPreset("alquiler");
    else setTipoCotizacionPreset("muebles");
    setStepIndex(0);
    setMaxStep(30);
    setError("");
  }, [clientes]);

  const productoById = useCallback(
    (id: string | null) => productos.find((p) => p.id === id) ?? null,
    [productos],
  );

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-6">

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <p className="text-2xl font-bold text-[var(--color-accent)]">{counts.lista}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Listas para pasar a taller.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            En producción
          </p>
          <p className="text-2xl font-bold text-[var(--color-success)]">{counts.prod}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Ya registradas como orden.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Cobradas
          </p>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{counts.cob}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Ingreso registrado en caja.</p>
        </Card>
      </div>

      <Card className="sticky top-2 z-10 border-[var(--color-border)] bg-[var(--color-surface)]/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Resumen rápido de cotización
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
              disabled={!hasDraftAvailable}
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
          {draftSavedAt
            ? `Último borrador: ${new Date(draftSavedAt).toLocaleString("es-PE")}`
            : "Aún no hay borrador guardado."}{" "}
          En PC: `Ctrl/Cmd + S` guarda, `Alt + R` recupera, `Alt + N` nueva.
        </p>
      </Card>

      <Card className="space-y-3 border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <CardTitle className="text-base">Pasos de cotización</CardTitle>
        <CardDescription>
          Podés volver atrás y cambiar tipo de cliente o rubros cuando quieras. Los pasos visibles dependen de lo
          que marques.
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          {steps.map((sid, idx) => (
            <button
              key={`${sid}-${idx}`}
              type="button"
              disabled={idx > maxStep}
              onClick={() => goStep(idx)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                idx === effectiveStepIndex
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

      {currentStepId === "tipo" ? (
        <Card className={`${panelClass} space-y-5 border-none`}>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setTipoCliente("natural")}
              className={`rounded-3xl border px-4 py-6 text-xl font-bold text-[var(--color-text-primary)] ${
                tipoCliente === "natural"
                  ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              Persona natural
            </button>
            <button
              type="button"
              onClick={() => setTipoCliente("empresa")}
              className={`rounded-3xl border px-4 py-6 text-xl font-bold text-[var(--color-text-primary)] ${
                tipoCliente === "empresa"
                  ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              Empresa
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={next} className={navBtnClass}>
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "cliente" ? (
        <Card className={`${panelClass} space-y-5 border-none`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
          </div>
          <CardTitle className="text-center text-2xl font-extrabold">Datos del cliente</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Cliente existente</span>
              <select
                className={inputClass}
                value={clienteId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setClienteId(null);
                    return;
                  }
                  setClienteId(v);
                  const c = clientes.find((x) => x.id === v);
                  if (c) {
                    setNombreCliente(c.nombre);
                    setDocumento(c.documento ?? "");
                    setTelefono(c.telefono ?? "");
                    setDireccion(c.direccion ?? "");
                  }
                }}
              >
                <option value="">— Nuevo cliente —</option>
                {clientesFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
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
          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className={`${navBtnClass} border border-[var(--color-border)] bg-transparent`}>
              Anterior
            </button>
            <button type="button" onClick={next} className={navBtnClass}>
              Siguiente
            </button>
          </div>
        </Card>
      ) : null}

      {currentStepId === "rubros" ? (
        <Card className={`${panelClass} space-y-5 border-none`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <span className={`${pillClass} inline-flex`}>Tipo de cotización</span>
              <select
                className={`${inputClass} h-12 min-w-[260px] border-[var(--color-border)] bg-[var(--color-surface)] text-center font-bold text-[var(--color-text-primary)]`}
                value={tipoCotizacionPreset}
                onChange={(e) =>
                  applyCotizacionPreset(
                    e.target.value as "muebles" | "aserradero" | "alquiler" | "general",
                  )
                }
              >
                <option value="aserradero">Aserradero</option>
                <option value="muebles">Mueble personalizado</option>
                <option value="alquiler">Alquiler</option>
                <option value="general">Cotización general</option>
              </select>
            </div>
          </div>

          {(tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general") ? (
            <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Plantilla de mueble personalizado
                </span>
                <select
                  className={inputClass}
                  value={selectedMuebleTemplateId}
                  onChange={(e) => applyMuebleTemplate(e.target.value)}
                >
                  <option value="">Seleccionar plantilla...</option>
                  {muebleTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
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
                    const fallbackId = selectedMuebleTemplateId || muebleTemplates[0]?.id;
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
                    ["Espesor", unidadEspesorUI, setUnidadEspesorUI, medidaEspesorUI, setMedidaEspesorUI],
                    ["Ancho", unidadAnchoUI, setUnidadAnchoUI, medidaAnchoUI, setMedidaAnchoUI],
                    ["Largo", unidadLargoUI, setUnidadLargoUI, medidaLargoUI, setMedidaLargoUI],
                  ] as const
                ).map(([label, unidad, setUnidad, medida, setMedida]) => (
                  <div key={label} className="space-y-1">
                    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-center text-sm font-extrabold text-[var(--color-text-primary)]">
                      {label}
                    </div>
                    <select
                      className={inputClass + " h-10"}
                      value={unidad}
                      onChange={(e) => setUnidad(e.target.value as "" | "mm" | "cm" | "m" | "in" | "ft")}
                      aria-label={`Unidad ${label}`}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="in">in</option>
                      <option value="ft">ft</option>
                    </select>
                    <input
                      type="number"
                      className={`${inputClass} h-10 rounded-sm`}
                      value={medida}
                      onChange={(e) => setMedida(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPiezaDesdeDimensiones();
                        }
                      }}
                      placeholder={unidad ? String(unidad).toUpperCase() : "Unidad"}
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Muebles personalizados ({piezasMuebleActual.length || 1}) · Enter = agregar siguiente
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold"
                      onClick={removeSelectedPieza}
                    >
                      Eliminar seleccionada
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold"
                      onClick={addPiezaDesdeDimensiones}
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(piezasMuebleActual.length > 0 ? piezasMuebleActual : [emptyPieza()]).map((_, idx) => (
                    <button
                      key={`pieza-pos-${idx}`}
                      type="button"
                      onClick={() => setSelectedPiezaIndexUI(idx)}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                        idx === selectedPiezaIndexSafe
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)]"
                      }`}
                    >
                      Pieza {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Conversión: Espesor {conversionMedidasUI.espIn.toFixed(2)} in · Ancho {conversionMedidasUI.ancIn.toFixed(2)} in · Largo{" "}
                {conversionMedidasUI.larFt.toFixed(2)} ft · PT ref: <strong>{conversionMedidasUI.pt.toFixed(2)}</strong>
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Cada unidad se convierte automáticamente a pulgadas/pies para el cálculo.
              </p>
            </div>
            ) : null}

            {tipoCotizacionPreset === "muebles" || tipoCotizacionPreset === "general" ? (
            <div className="space-y-2">
              <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)]">Tipo de madera</span>
              <select
                className={`${inputClass} h-11`}
                value={tipoMaderaUI}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setTipoMaderaUI(selectedId);
                  if (!selectedId) return;
                  const picked = productos.find((p) => p.id === selectedId);
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
              >
                <option value="">Desplegable madera (según inventario)</option>
                {productos
                  .filter((p) => (p.stock_actual ?? 0) > 0 && isWoodCategory(p.categoria))
                  .map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.categoria}] {stripDimensionesMadera(p.nombre)} · Pies disponibles:{" "}
                    {formatoPiesDisponibles(p.stock_actual, p.unidad)} · Stock: {p.stock_actual} {p.unidad}
                  </option>
                  ))}
              </select>
              {tipoMaderaUI ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Selección tomada desde inventario para la cotización.
                </p>
              ) : productos.some((p) => (p.stock_actual ?? 0) > 0 && isWoodCategory(p.categoria)) ? (
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
                    type="number"
                    min={0}
                    className={`${inputClass} h-11 w-[150px] text-center`}
                    value={costoAcabadoSolesUI}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCostoAcabadoSolesUI(raw);
                      setDetalle((d) => ({ ...d, costoAcabadoSoles: Number(raw) || 0 }));
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
                    setPagoModalidadUI(e.target.value as "" | "contado" | "adelanto" | "credito")
                  }
                >
                  <option value="">Modalidad</option>
                  <option value="contado">Contado</option>
                  <option value="adelanto">Adelanto</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              {pagoModalidadUI === "credito" || pagoModalidadUI === "adelanto" ? (
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
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["Espesor", asrUnidadEspesorUI, setAsrUnidadEspesorUI, asrMedidaEspesorUI, setAsrMedidaEspesorUI],
                      ["Ancho", asrUnidadAnchoUI, setAsrUnidadAnchoUI, asrMedidaAnchoUI, setAsrMedidaAnchoUI],
                      ["Largo", asrUnidadLargoUI, setAsrUnidadLargoUI, asrMedidaLargoUI, setAsrMedidaLargoUI],
                    ] as const
                  ).map(([label, unidad, setUnidad, medida, setMedida]) => (
                    <div key={`asr-${label}`} className="space-y-1">
                      <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">{label}</span>
                      <select
                        className={`${inputClass} h-9`}
                        value={unidad}
                        onChange={(e) => setUnidad(e.target.value as "" | "mm" | "cm" | "m" | "in" | "ft")}
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                        <option value="in">in</option>
                        <option value="ft">ft</option>
                      </select>
                      <input
                        type="number"
                        className={`${inputClass} h-9`}
                        value={medida}
                        onChange={(e) => setMedida(e.target.value)}
                        placeholder={String(unidad).toUpperCase()}
                      />
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
            <button type="button" onClick={back} className={`${navBtnClass} border border-[var(--color-border)] bg-transparent`}>
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
            Elegí material del inventario para amarrar stock; el costo usa precio por PT que definís (referencia de
            compra/venta).
          </CardDescription>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-4">
              <div className="grid grid-cols-[1fr_1.5fr] gap-2">
                <span className={pillClass}>Tipo de mueble</span>
                <select
                  className={`${inputClass} h-10`}
                  value={tipoMuebleVista}
                  onChange={(e) => setTipoMuebleVista(e.target.value)}
                >
                  <option value="">Desplegable de tipo</option>
                  {muebleOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text-primary)]">
                <p className="mb-2 text-sm font-bold uppercase text-[var(--color-text-secondary)]">Detalle de cobro</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md bg-[var(--color-primary-soft)]/40 px-3 py-2">
                    <span>Cliente</span>
                    <strong>{nombreCliente || "Sin definir"}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-[var(--color-primary-soft)]/40 px-3 py-2">
                    <span>Tipo de mueble</span>
                    <strong>{selectedTipoMuebleLabel}</strong>
                  </div>
                  {lineasFormalSafe.slice(0, 6).map((linea) => (
                    <div key={`${linea.titulo}-${linea.precioTotal}`} className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2">{linea.titulo}</span>
                      <strong>{formatPen(safeMoney(linea.precioTotal))}</strong>
                    </div>
                  ))}
                  {lineasFormalSafe.length === 0 ? (
                    <p className="text-[var(--color-text-secondary)]">Aun no hay lineas cargadas.</p>
                  ) : null}
                </div>
                {tipoMuebleVista ? (
                  <p className="mt-2 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
                    Tipo seleccionado: {selectedTipoMuebleLabel}
                  </p>
                ) : (
                  <p className="mt-2 text-center text-xs text-[var(--color-text-secondary)]">
                    Los tipos de mueble se toman del inventario; si no hay, se muestran ejemplos.
                  </p>
                )}
              </div>
              <div className="mx-auto max-w-[220px] rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-center text-3xl font-extrabold text-[var(--color-text-primary)]">
                {formatPen(totalGralSafe)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">Vista previa del mueble</p>
                <div className="grid min-h-24 place-items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-6 text-center">
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">
                    {selectedTipoMuebleLabel === "Mueble" ? "Selecciona un tipo de mueble" : selectedTipoMuebleLabel}
                  </p>
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-5 text-center">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Precio sugerido de venta</p>
                <p className="mt-1 text-4xl font-extrabold text-[var(--color-text-primary)]">{formatPen(totalGralSafe)}</p>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Madera: {formatPen(safeMoney(totales.muebles))} · Aserradero: {formatPen(safeMoney(totales.aserradero))} · Alquiler: {formatPen(safeMoney(totales.alquiler))}
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  Precio de venta por pie (madera)
                </p>
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} mt-3 h-11 text-center`}
                  value={precioVentaPtUI}
                  onChange={(e) => setPrecioVentaPtUI(e.target.value)}
                  placeholder="S/ por pie"
                />
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  PT calculado: <strong>{conversionMedidasUI.pt.toFixed(2)}</strong> · Total madera proyectado:{" "}
                  <strong>{formatPen(totalMaderaProyectado)}</strong>
                </p>
              </div>
            </div>
          </div>

          {detalle.rubros.muebles && detalle.muebles_lineas.length > 0 ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-amber-800/35 bg-amber-50/40 p-4 dark:border-amber-500/30 dark:bg-amber-950/25">
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                Costos internos por línea de madera (no van al PDF del cliente)
              </p>
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
          ) : null}

          <div className="flex justify-between gap-2">
            <button type="button" onClick={back} className={`${navBtnClass} border border-[var(--color-border)] bg-transparent`}>
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
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                detalle.aserradero.modo === "hora" ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]" : "border"
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
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                detalle.aserradero.modo === "total" ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]" : "border"
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
              <select
                className={inputClass}
                value={detalle.alquiler.inventario_producto_id ?? ""}
                onChange={(e) => {
                  const pid = e.target.value || null;
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
              >
                <option value="">— Escribir manual —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
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
            <CardTitle>Vista previa — cotización formal</CardTitle>
            <CardDescription>
              Misma maquetación que PDF / impresión. Correlativo mostrado:{" "}
              <strong>{correlativoMostrar}</strong>
              {!guardadaId ? " (previsualización; al guardar se confirma el número)" : null}
            </CardDescription>
          </div>

          <div className="px-3 pb-2 sm:px-5">
            <CotizacionResumenFormal
              correlativoLabel={correlativoMostrar}
              fechaISO={fecha}
              nombreCliente={nombreCliente}
              tipoCliente={tipoCliente}
              documentoCliente={documento.trim() || null}
              lineas={lineasFormalSafe}
              notasGenerales={detalle.notas_generales}
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
                <dd className="font-semibold tabular-nums">{formatPen(economiaInterna.costoTotalEstimado)}</dd>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-[var(--color-primary-soft)]/20 px-3 py-2">
                <dt className="text-[var(--color-text-secondary)]">Precio total (cotización)</dt>
                <dd className="font-semibold tabular-nums">{formatPen(economiaInterna.precioTotal)}</dd>
              </div>
              <div
                className={`flex justify-between gap-3 rounded-lg px-3 py-2 sm:col-span-2 ${
                  economiaInterna.gananciaEstimada < 0
                    ? "bg-red-500/15 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-[var(--color-primary-soft)]/20"
                }`}
              >
                <dt className={economiaInterna.gananciaEstimada < 0 ? "" : "text-[var(--color-text-secondary)]"}>
                  Ganancia estimada
                </dt>
                <dd className="tabular-nums">{formatPen(economiaInterna.gananciaEstimada)}</dd>
              </div>
              <div
                className={`flex justify-between gap-3 rounded-lg px-3 py-2 sm:col-span-2 ${
                  (economiaInterna.margenPct ?? 0) < 0
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

          <div className="space-y-2 border-t border-[var(--color-border)] px-5 py-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Notas al pie del documento (una por línea aparece como viñeta bajo NOTA:)
              </span>
              <textarea
                className={`${inputClass} min-h-[88px] py-2`}
                placeholder="Ej: Acabado barniz natural. Incluye instalación en obra. No incluye bisagras ni cerraduras..."
                value={detalle.notas_generales}
                onChange={(e) =>
                  setDetalle((d) => ({ ...d, notas_generales: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => handleGuardar("pendiente")}
              className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
            >
              Guardar pendiente
            </button>
            <button
              type="button"
              disabled={!canSave || busy || tipoCotizacionPreset === "muebles"}
              onClick={() => handleGuardar("lista_produccion")}
              className="h-10 rounded-xl border border-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-50"
            >
              Guardar lista para producción
            </button>
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => handleGuardar("pendiente", true)}
              className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Guardar + PDF
            </button>
            <button
              type="button"
              disabled={!guardadaId}
              onClick={() => guardadaId && window.open(`/cotizacion/unificada/${guardadaId}/pdf`, "_blank")}
              className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Solo PDF (cotización guardada)
            </button>
            {tipoCotizacionPreset === "muebles" ? (
              <p className="w-full pt-1 text-xs text-[var(--color-text-secondary)]">
                Mueble personalizado se mantiene en estado pendiente.
              </p>
            ) : null}
          </div>

          {guardadaId ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] px-5 pt-4">
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
                    | "cobrada",
                )
              }
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="lista_produccion">Lista producción</option>
              <option value="produccion">Producción</option>
              <option value="cobrada">Cobrada</option>
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
                <td className="px-3 py-2">{c.correlativo ?? c.id.slice(0, 8)}</td>
                <td className="px-3 py-2">{clientesById.get(c.cliente_id)?.nombre ?? "—"}</td>
                <td className="px-3 py-2">{c.fecha}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatPen(c.total)}</td>
                <td className="px-3 py-2">{c.estado_flujo}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--color-accent)]"
                      onClick={() => loadCotizacion(c)}
                    >
                      Cargar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold"
                      onClick={() => window.open(`/cotizacion/unificada/${c.id}/pdf`, "_blank")}
                    >
                      PDF
                    </button>
                    {(c.estado_flujo === "lista_produccion" || c.estado_flujo === "en_produccion") &&
                    canSave ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-teal-700 dark:text-teal-400"
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
                        Cobrar
                      </button>
                    ) : null}
                    {c.estado_flujo === "pendiente" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600"
                        onClick={async () => {
                          if (!confirm("¿Eliminar esta cotización pendiente?")) return;
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
