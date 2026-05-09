"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatPen } from "@/lib/utils";

type QuoteRow = {
  id: string;
  especie: string;
  espesorIn: string;
  anchoIn: string;
  largoFt: string;
  cantidad: string;
};

type QuoteDualFlowProps = {
  canSave?: boolean;
  mode?: "tecnico" | "simple";
};

type AccessoryRow = {
  id: string;
  descripcion: string;
  costo: string;
};

type QuoteTemplate = {
  id: string;
  name: string;
  rows: Array<Pick<QuoteRow, "especie" | "espesorIn" | "anchoIn" | "largoFt" | "cantidad">>;
};

type ParametricInputs = {
  altoCm: number;
  anchoCm: number;
  fondoCm: number;
  espesorIn: number;
};

type ParametricPiece = {
  pieza: string;
  cantidad: number;
  largoIn: number;
  anchoIn: number;
};

type ParametricTemplate = {
  id: string;
  label: string;
  buildPieces: (inputs: ParametricInputs) => ParametricPiece[];
};

const CELL_COUNT = 4;
const ACCESSORY_CELL_COUNT = 2;
const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/70 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";
const tableInputClass =
  "h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/70 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";
const TEMPLATES_STORAGE_KEY = "quote_templates";
const PT_PRICE_STORAGE_KEY = "quote_last_pt_price";
const CM_TO_IN = 1 / 2.54;

function cmToIn(cm: number) {
  return cm * CM_TO_IN;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildRopero2PuertasPieces(inputs: ParametricInputs): ParametricPiece[] {
  const altoIn = cmToIn(Math.max(0, inputs.altoCm));
  const anchoIn = cmToIn(Math.max(0, inputs.anchoCm));
  const fondoIn = cmToIn(Math.max(0, inputs.fondoCm));

  const estanteLargoIn = Math.max(0, anchoIn - inputs.espesorIn * 2);
  const estanteAnchoIn = cmToIn(Math.max(0, inputs.fondoCm - 2));
  const puertaLargoIn = cmToIn(Math.max(0, inputs.altoCm - 2));
  const puertaAnchoIn = cmToIn(Math.max(0, inputs.anchoCm / 2));

  return [
    {
      pieza: "Laterales",
      cantidad: 2,
      largoIn: altoIn,
      anchoIn: fondoIn,
    },
    {
      pieza: "Techo y Base",
      cantidad: 2,
      largoIn: anchoIn,
      anchoIn: fondoIn,
    },
    {
      pieza: "Estantes Interiores",
      cantidad: 3,
      largoIn: estanteLargoIn,
      anchoIn: estanteAnchoIn,
    },
    {
      pieza: "Puertas",
      cantidad: 2,
      largoIn: puertaLargoIn,
      anchoIn: puertaAnchoIn,
    },
  ];
}

const PARAMETRIC_TEMPLATES: ParametricTemplate[] = [
  {
    id: "ropero-2p",
    label: "Ropero estandar (2 puertas)",
    buildPieces: buildRopero2PuertasPieces,
  },
];

function createEmptyRow(): QuoteRow {
  return {
    id: crypto.randomUUID(),
    especie: "",
    espesorIn: "",
    anchoIn: "",
    largoFt: "",
    cantidad: "1",
  };
}

function isBlankRow(row: QuoteRow) {
  return !row.espesorIn.trim() && !row.anchoIn.trim() && !row.largoFt.trim();
}

function createEmptyAccessoryRow(): AccessoryRow {
  return {
    id: crypto.randomUUID(),
    descripcion: "",
    costo: "",
  };
}

function loadTemplatesFromStorage(): QuoteTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const rawTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!rawTemplates) return [];
    const parsed = JSON.parse(rawTemplates) as QuoteTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadPTPriceFromStorage() {
  if (typeof window === "undefined") return "0";
  try {
    const rawPrice = localStorage.getItem(PT_PRICE_STORAGE_KEY);
    return rawPrice !== null && rawPrice !== "" ? rawPrice : "0";
  } catch {
    return "0";
  }
}

function parseNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return 0;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getRowPT(row: QuoteRow) {
  const espesor = parseNumber(row.espesorIn);
  const ancho = parseNumber(row.anchoIn);
  const largo = parseNumber(row.largoFt);
  const cantidad = parseNumber(row.cantidad) || 1;
  return Math.floor((espesor * ancho * largo * cantidad) / 12);
}

export function QuoteDualFlow({ canSave = true, mode = "simple" }: QuoteDualFlowProps) {
  const [rows, setRows] = useState<QuoteRow[]>([createEmptyRow()]);
  const [quickEntry, setQuickEntry] = useState("");
  const [selectedParametricTemplateId, setSelectedParametricTemplateId] = useState(PARAMETRIC_TEMPLATES[0].id);
  const [parametricAltoCm, setParametricAltoCm] = useState("200");
  const [parametricAnchoCm, setParametricAnchoCm] = useState("120");
  const [parametricFondoCm, setParametricFondoCm] = useState("55");
  const [parametricEspesorIn, setParametricEspesorIn] = useState("0.75");
  const [precioPorPT, setPrecioPorPT] = useState<string>(loadPTPriceFromStorage);
  const [manoObra, setManoObra] = useState<string>("0");
  const [maderaDelCliente, setMaderaDelCliente] = useState(false);
  const [accesorios, setAccesorios] = useState<AccessoryRow[]>([createEmptyAccessoryRow()]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>(loadTemplatesFromStorage);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [contactoCliente, setContactoCliente] = useState("");
  const [fechaCotizacion, setFechaCotizacion] = useState(() => new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [anchoFinalCm, setAnchoFinalCm] = useState("");
  const [altoFinalCm, setAltoFinalCm] = useState("");
  const [fondoFinalCm, setFondoFinalCm] = useState("");
  const [distribucionInterior, setDistribucionInterior] = useState("");
  const [observacionesTecnicas, setObservacionesTecnicas] = useState("");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const quickEntryRef = useRef<HTMLInputElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const accessoryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try {
      localStorage.setItem(PT_PRICE_STORAGE_KEY, precioPorPT);
    } catch {
      // Ignore write failures (private mode, policy, etc).
    }
  }, [precioPorPT]);

  const totals = useMemo(() => {
    const sumaPT = rows.reduce((acc, row) => acc + getRowPT(row), 0);
    const precioPieTablar = parseNumber(precioPorPT);
    const manoObraTotal = parseNumber(manoObra);
    const sumaInsumosExtra = accesorios.reduce((acc, row) => acc + parseNumber(row.costo), 0);

    // Regla de negocio:
    // Si la madera la pone el cliente, no se cobra costo de madera.
    const costoMadera = maderaDelCliente ? 0 : sumaPT * precioPieTablar;
    const precioFinal = costoMadera + manoObraTotal + sumaInsumosExtra;

    return {
      totalPT: sumaPT,
      costoMadera,
      costoOtros: manoObraTotal,
      costoAccesorios: sumaInsumosExtra,
      precioFinal,
    };
  }, [rows, precioPorPT, manoObra, accesorios, maderaDelCliente]);

  const parametricTemplate = useMemo(
    () => PARAMETRIC_TEMPLATES.find((template) => template.id === selectedParametricTemplateId) ?? PARAMETRIC_TEMPLATES[0],
    [selectedParametricTemplateId],
  );

  const parametricBreakdown = useMemo(() => {
    const parsedInputs: ParametricInputs = {
      altoCm: parseNumber(parametricAltoCm),
      anchoCm: parseNumber(parametricAnchoCm),
      fondoCm: parseNumber(parametricFondoCm),
      espesorIn: parseNumber(parametricEspesorIn),
    };
    if (
      parsedInputs.altoCm <= 0 ||
      parsedInputs.anchoCm <= 0 ||
      parsedInputs.fondoCm <= 0 ||
      parsedInputs.espesorIn <= 0
    ) {
      return { rows: [] as Array<ParametricPiece & { subtotalPT: number }>, totalPT: 0 };
    }

    const computedRows = parametricTemplate.buildPieces(parsedInputs).map((piece) => {
      const subtotalPT = (piece.cantidad * parsedInputs.espesorIn * piece.anchoIn * piece.largoIn) / 144;
      return {
        ...piece,
        largoIn: round2(piece.largoIn),
        anchoIn: round2(piece.anchoIn),
        subtotalPT: round2(subtotalPT),
      };
    });

    const totalPT = round2(computedRows.reduce((acc, row) => acc + row.subtotalPT, 0));
    return { rows: computedRows, totalPT };
  }, [parametricTemplate, parametricAltoCm, parametricAnchoCm, parametricFondoCm, parametricEspesorIn]);

  const precioPTInputClass = maderaDelCliente
    ? `${inputClass} cursor-not-allowed bg-[var(--color-primary-soft)]/60 text-[var(--color-text-secondary)] opacity-70`
    : inputClass;

  function updateRow(rowId: string, key: keyof QuoteRow, value: string) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  function moveRow(sourceRowId: string, targetRowId: string) {
    if (sourceRowId === targetRowId) return;
    setRows((current) => {
      const sourceIndex = current.findIndex((row) => row.id === sourceRowId);
      const targetIndex = current.findIndex((row) => row.id === targetRowId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function handleRowDragStart(event: DragEvent<HTMLTableRowElement>, rowId: string) {
    setDraggingRowId(rowId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", rowId);
  }

  function handleRowDragOver(event: DragEvent<HTMLTableRowElement>, rowId: string) {
    if (!draggingRowId || draggingRowId === rowId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleRowDrop(event: DragEvent<HTMLTableRowElement>, targetRowId: string) {
    event.preventDefault();
    const sourceRowId = draggingRowId || event.dataTransfer.getData("text/plain");
    if (!sourceRowId) return;
    moveRow(sourceRowId, targetRowId);
    setDraggingRowId(null);
  }

  function handleRowDragEnd() {
    setDraggingRowId(null);
  }

  function addRowFromQuickEntry(entry: string) {
    const normalized = entry.trim();
    if (!normalized) return;
    const parts = normalized
      .split(/[\s*]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (parts.length < 1 || parts.length > 4) {
      setError("Ingreso rápido inválido. Usa 1, 2, 3 o 4 números.");
      return;
    }

    const numericParts = parts.map(parseNumber);
    if (numericParts.some((value) => value <= 0)) {
      setError("Solo se permiten valores numéricos mayores a 0.");
      return;
    }

    const lastReferenceRow = [...rows].reverse().find((row) => !isBlankRow(row));
    let cantidad = "1";
    let espesorIn = "";
    let anchoIn = "";
    let largoFt = "";

    if (numericParts.length === 4) {
      cantidad = String(numericParts[0]);
      espesorIn = String(numericParts[1]);
      anchoIn = String(numericParts[2]);
      largoFt = String(numericParts[3]);
    } else if (numericParts.length === 3) {
      espesorIn = String(numericParts[0]);
      anchoIn = String(numericParts[1]);
      largoFt = String(numericParts[2]);
    } else if (numericParts.length === 2) {
      if (!lastReferenceRow) {
        setError("Para usar 2 valores, primero ingresa una medida completa.");
        return;
      }
      cantidad = String(numericParts[0]);
      espesorIn = lastReferenceRow.espesorIn;
      anchoIn = lastReferenceRow.anchoIn;
      largoFt = String(numericParts[1]);
    } else {
      if (!lastReferenceRow) {
        setError("Para usar 1 valor, primero ingresa una medida completa.");
        return;
      }
      espesorIn = lastReferenceRow.espesorIn;
      anchoIn = lastReferenceRow.anchoIn;
      largoFt = String(numericParts[0]);
    }

    const nextRow: QuoteRow = {
      id: crypto.randomUUID(),
      especie: lastReferenceRow?.especie ?? "",
      espesorIn,
      anchoIn,
      largoFt,
      cantidad,
    };

    setRows((current) => {
      if (current.length === 1 && isBlankRow(current[0])) return [nextRow];
      return [...current, nextRow];
    });
    setError("");
    setQuickEntry("");
    requestAnimationFrame(() => {
      quickEntryRef.current?.focus();
    });
  }

  function handleQuickEntryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addRowFromQuickEntry(quickEntry);
  }

  function duplicateRow(rowIndex: number) {
    setRows((current) => {
      const source = current[rowIndex];
      if (!source) return current;
      const duplicate: QuoteRow = {
        id: crypto.randomUUID(),
        especie: source.especie,
        espesorIn: source.espesorIn,
        anchoIn: source.anchoIn,
        largoFt: source.largoFt,
        cantidad: source.cantidad || "1",
      };
      const next = [...current];
      next.splice(rowIndex + 1, 0, duplicate);
      return next;
    });
    requestAnimationFrame(() => {
      const source = rows[rowIndex];
      if (!source) return;
      const rowAfter = rows[rowIndex + 1];
      if (rowAfter) {
        inputRefs.current[`${rowAfter.id}-0`]?.focus();
      }
    });
  }

  function deleteRow(rowId: string) {
    setRows((current) => {
      if (current.length === 1) {
        return [createEmptyRow()];
      }
      const filtered = current.filter((row) => row.id !== rowId);
      return filtered.length > 0 ? filtered : [createEmptyRow()];
    });
  }

  function appendRowAndFocus(nextCol: number) {
    const newRow = createEmptyRow();
    setRows((current) => [...current, newRow]);
    requestAnimationFrame(() => {
      inputRefs.current[`${newRow.id}-${nextCol}`]?.focus();
    });
  }

  function focusCell(rowIndex: number, colIndex: number) {
    const row = rows[rowIndex];
    if (!row) return;
    inputRefs.current[`${row.id}-${colIndex}`]?.focus();
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    if (event.shiftKey) return;
    if (event.key !== "Enter" && event.key !== "Tab") return;

    // Mimics notebook-style navigation and auto-append on the last cell.
    event.preventDefault();
    let nextCol = colIndex + 1;
    let nextRow = rowIndex;

    if (nextCol >= CELL_COUNT) {
      nextCol = 0;
      nextRow += 1;
    }

    if (nextRow >= rows.length) {
      appendRowAndFocus(nextCol);
      return;
    }

    focusCell(nextRow, nextCol);
  }

  function updateAccessoryRow(rowId: string, key: keyof AccessoryRow, value: string) {
    setAccesorios((current) => current.map((row) => (row.id === rowId ? { ...row, [key]: value } : row)));
  }

  function appendAccessoryRowAndFocus(nextCol: number) {
    const newRow = createEmptyAccessoryRow();
    setAccesorios((current) => [...current, newRow]);
    requestAnimationFrame(() => {
      accessoryInputRefs.current[`${newRow.id}-${nextCol}`]?.focus();
    });
  }

  function focusAccessoryCell(rowIndex: number, colIndex: number) {
    const row = accesorios[rowIndex];
    if (!row) return;
    accessoryInputRefs.current[`${row.id}-${colIndex}`]?.focus();
  }

  function handleAccessoryKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    if (event.shiftKey) return;
    if (event.key !== "Enter" && event.key !== "Tab") return;

    event.preventDefault();
    let nextCol = colIndex + 1;
    let nextRow = rowIndex;

    if (nextCol >= ACCESSORY_CELL_COUNT) {
      nextCol = 0;
      nextRow += 1;
    }

    if (nextRow >= accesorios.length) {
      appendAccessoryRowAndFocus(nextCol);
      return;
    }

    focusAccessoryCell(nextRow, nextCol);
  }

  function deleteAccessoryRow(rowId: string) {
    setAccesorios((current) => {
      if (current.length === 1) return [createEmptyAccessoryRow()];
      const filtered = current.filter((row) => row.id !== rowId);
      return filtered.length > 0 ? filtered : [createEmptyAccessoryRow()];
    });
  }

  function saveCurrentAsTemplate() {
    const name = window.prompt("Nombre de la plantilla:");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const rowPayload = rows.map(({ especie, espesorIn, anchoIn, largoFt, cantidad }) => ({
      especie,
      espesorIn,
      anchoIn,
      largoFt,
      cantidad,
    }));
    const nextTemplate: QuoteTemplate = {
      id: crypto.randomUUID(),
      name: cleanName,
      rows: rowPayload,
    };

    setTemplates((current) => {
      const withoutSameName = current.filter((template) => template.name.toLowerCase() !== cleanName.toLowerCase());
      const next = [...withoutSameName, nextTemplate];
      try {
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage failures.
      }
      return next;
    });
    setSelectedTemplateId(nextTemplate.id);
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const mappedRows = template.rows.map((row) => ({
      id: crypto.randomUUID(),
      especie: row.especie ?? "",
      espesorIn: row.espesorIn ?? "",
      anchoIn: row.anchoIn,
      largoFt: row.largoFt,
      cantidad: row.cantidad || "1",
    }));
    setRows(mappedRows.length > 0 ? mappedRows : [createEmptyRow()]);
  }

  function saveQuoteToDB(payload: unknown) {
    // Replace this with your API/backend integration.
    console.log("saveQuoteToDB", payload);
  }

  function handleSave() {
    setError("");
    setSavedAt(null);

    if (!canSave) {
      setError("Tu rol no tiene permisos para guardar cotizaciones.");
      return;
    }
    if (!nombreCliente.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    if (!descripcion.trim()) {
      setError("La descripción es obligatoria para guardar.");
      return;
    }
    if (totals.totalPT <= 0) {
      setError("Ingresa al menos una medida válida antes de guardar.");
      return;
    }

    const detailRows = rows
      .map((row) => ({
        especie: row.especie.trim() || null,
        espesorIn: parseNumber(row.espesorIn),
        anchoIn: parseNumber(row.anchoIn),
        largoFt: parseNumber(row.largoFt),
        cantidad: parseNumber(row.cantidad),
        pt: getRowPT(row),
      }))
      .filter((row) => row.pt > 0);

    const quote = {
      cliente: nombreCliente.trim(),
      contacto: contactoCliente.trim() || null,
      fecha: fechaCotizacion,
      descripcion: descripcion.trim(),
      dimensionesFinales: {
        anchoCm: parseNumber(anchoFinalCm),
        altoCm: parseNumber(altoFinalCm),
        fondoCm: parseNumber(fondoFinalCm),
        distribucionInterior: distribucionInterior.trim() || null,
      },
      observacionesTecnicas: observacionesTecnicas.trim() || null,
      maderaProporcionadaPorCliente: maderaDelCliente,
      precioPorPT: parseNumber(precioPorPT),
      manoObraOtros: parseNumber(manoObra),
      resumen: totals,
      insumosExtra: accesorios
        .map((row) => ({
          descripcion: row.descripcion.trim(),
          costo: parseNumber(row.costo),
        }))
        .filter((row) => row.descripcion || row.costo > 0),
      detalle: detailRows,
      createdAt: new Date().toISOString(),
    };

    saveQuoteToDB(quote);
    setSavedAt(new Date().toLocaleTimeString("es-PE"));
  }

  return (
    <Card>
      <CardTitle>Cotización (Doble función)</CardTitle>
      <CardDescription>
        {mode === "tecnico"
          ? "Flujo técnico: cálculo inmediato en campo y registro cuando el cliente confirma."
          : "Consulta rápida sin guardar y registro formal cuando el cliente acepta."}
      </CardDescription>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Plantillas técnicas</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className={inputClass}
            >
              <option value="">Seleccionar plantilla...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="w-full" onClick={saveCurrentAsTemplate}>
              Guardar como Plantilla
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/35 px-3 py-2">
          <input
            type="checkbox"
            checked={maderaDelCliente}
            onChange={(e) => setMaderaDelCliente(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Madera proporcionada por el cliente</span>
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Cliente</span>
            <input
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              placeholder="Ej: Sr. Carlos"
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Contacto</span>
            <input
              value={contactoCliente}
              onChange={(e) => setContactoCliente(e.target.value)}
              placeholder="Ej: 930781012"
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fecha</span>
            <input
              value={fechaCotizacion}
              onChange={(e) => setFechaCotizacion(e.target.value)}
              type="date"
              className={inputClass}
            />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Plantilla de despiece</span>
              <select
                value={selectedParametricTemplateId}
                onChange={(e) => setSelectedParametricTemplateId(e.target.value)}
                className={inputClass}
              >
                {PARAMETRIC_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Alto Total (cm)</span>
              <input
                value={parametricAltoCm}
                onChange={(e) => setParametricAltoCm(e.target.value)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Ancho Total (cm)</span>
              <input
                value={parametricAnchoCm}
                onChange={(e) => setParametricAnchoCm(e.target.value)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fondo / Profundidad (cm)</span>
              <input
                value={parametricFondoCm}
                onChange={(e) => setParametricFondoCm(e.target.value)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Espesor de Madera (pulgadas)</span>
              <input
                value={parametricEspesorIn}
                onChange={(e) => setParametricEspesorIn(e.target.value)}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={inputClass}
              />
            </label>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/35 p-3 md:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                Suma Total PT (Despiece)
              </p>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">{parametricBreakdown.totalPT.toFixed(2)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Pieza</TH>
                  <TH className="text-right">Cantidad</TH>
                  <TH className="text-right">Largo (in)</TH>
                  <TH className="text-right">Ancho (in)</TH>
                  <TH className="text-right">Subtotal PT</TH>
                </TRow>
              </THead>
              <tbody>
                {parametricBreakdown.rows.map((piece) => (
                  <TRow key={piece.pieza}>
                    <TD>{piece.pieza}</TD>
                    <TD className="text-right">{piece.cantidad}</TD>
                    <TD className="text-right">{piece.largoIn.toFixed(2)}</TD>
                    <TD className="text-right">{piece.anchoIn.toFixed(2)}</TD>
                    <TD className="text-right font-semibold">{piece.subtotalPT.toFixed(2)}</TD>
                  </TRow>
                ))}
                <TRow>
                  <TD className="font-semibold">TOTAL</TD>
                  <TD />
                  <TD />
                  <TD />
                  <TD className="text-right font-extrabold">{parametricBreakdown.totalPT.toFixed(2)}</TD>
                </TRow>
              </tbody>
            </Table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-primary-soft)]/25 p-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Ingreso rapido</span>
              <input
                ref={quickEntryRef}
                value={quickEntry}
                onChange={(e) => setQuickEntry(e.target.value)}
                onKeyDown={handleQuickEntryKeyDown}
                placeholder="Ej: 8 4 5 | 8*4*5 | 2 10 3 5 | 2 5 | 7"
                className={inputClass}
              />
            </label>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Enter agrega fila. Formatos: 3 valores = Espesor Ancho Largo; 4 valores = Cantidad Espesor Ancho Largo;
              2 valores = Cantidad Largo (hereda Espesor y Ancho); 1 valor = Largo (hereda Espesor y Ancho).
            </p>
          </div>
          <Table>
            <THead>
              <TRow>
                <TH className="w-12">#</TH>
                <TH>Espesor (pulgadas)</TH>
                <TH>Ancho (pulgadas)</TH>
                <TH>Largo (pies)</TH>
                <TH>Cantidad</TH>
                <TH className="text-right">PT</TH>
                <TH className="text-right">Acciones</TH>
              </TRow>
            </THead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <TRow
                  key={row.id}
                  draggable
                  onDragStart={(event) => handleRowDragStart(event, row.id)}
                  onDragOver={(event) => handleRowDragOver(event, row.id)}
                  onDrop={(event) => handleRowDrop(event, row.id)}
                  onDragEnd={handleRowDragEnd}
                  className={draggingRowId === row.id ? "opacity-60" : "cursor-grab"}
                  title="Arrastra esta fila para reordenar"
                >
                  <TD className="text-xs text-[var(--color-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true">↕</span>
                      {rowIndex + 1}
                    </span>
                  </TD>
                  <TD>
                    <input
                      ref={(node) => {
                        inputRefs.current[`${row.id}-0`] = node;
                      }}
                      value={row.espesorIn}
                      onChange={(e) => updateRow(row.id, "espesorIn", e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 0)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0"
                      type="number"
                      min="0"
                      step="0.01"
                      className={tableInputClass}
                    />
                  </TD>
                  <TD>
                    <input
                      ref={(node) => {
                        inputRefs.current[`${row.id}-1`] = node;
                      }}
                      value={row.anchoIn}
                      onChange={(e) => updateRow(row.id, "anchoIn", e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 1)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0"
                      type="number"
                      min="0"
                      step="0.01"
                      className={tableInputClass}
                    />
                  </TD>
                  <TD>
                    <input
                      ref={(node) => {
                        inputRefs.current[`${row.id}-2`] = node;
                      }}
                      value={row.largoFt}
                      onChange={(e) => updateRow(row.id, "largoFt", e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 2)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="0"
                      type="number"
                      min="0"
                      step="0.01"
                      className={tableInputClass}
                    />
                  </TD>
                  <TD>
                    <input
                      ref={(node) => {
                        inputRefs.current[`${row.id}-3`] = node;
                      }}
                      value={row.cantidad}
                      onChange={(e) => updateRow(row.id, "cantidad", e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, 3)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="1"
                      type="number"
                      min="1"
                      step="1"
                      className={tableInputClass}
                    />
                  </TD>
                  <TD className="text-right font-semibold">{getRowPT(row)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => duplicateRow(rowIndex)}>
                        Duplicar
                      </Button>
                      <Button type="button" variant="danger" className="h-8 px-2 text-xs" onClick={() => deleteRow(row.id)}>
                        Eliminar
                      </Button>
                    </div>
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Orden de medida: <strong>Espesor - Ancho - Largo</strong>. Usa <strong>Enter</strong> o <strong>Tab</strong>{" "}
          para pasar de celda y crear filas nuevas.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Tip: arrastra una fila desde el icono ↕ para cambiar su posición (por ejemplo, mover la 1 al medio).
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Precio por Pie Tablar (S/)</span>
            <input
              value={precioPorPT}
              onChange={(e) => setPrecioPorPT(e.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={precioPTInputClass}
              disabled={maderaDelCliente}
              aria-disabled={maderaDelCliente}
            />
            {maderaDelCliente ? (
              <p className="text-xs text-[var(--color-text-secondary)]">Bloqueado: el cliente proporciona la madera.</p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Mano de Obra / Otros Costos</span>
            <input
              value={manoObra}
              onChange={(e) => setManoObra(e.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className={inputClass}
            />
          </label>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/35 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">Suma PT</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{totals.totalPT}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Insumos Extra</p>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Descripción del insumo</TH>
                  <TH className="text-right">Costo S/</TH>
                  <TH className="text-right">Acciones</TH>
                </TRow>
              </THead>
              <tbody>
                {accesorios.map((row, rowIndex) => (
                  <TRow key={row.id}>
                    <TD>
                      <input
                        ref={(node) => {
                          accessoryInputRefs.current[`${row.id}-0`] = node;
                        }}
                        value={row.descripcion}
                        onChange={(e) => updateAccessoryRow(row.id, "descripcion", e.target.value)}
                        onKeyDown={(e) => handleAccessoryKeyDown(e, rowIndex, 0)}
                        placeholder="Bisagras, jaladores, etc."
                        className={tableInputClass}
                      />
                    </TD>
                    <TD>
                      <input
                        ref={(node) => {
                          accessoryInputRefs.current[`${row.id}-1`] = node;
                        }}
                        value={row.costo}
                        onChange={(e) => updateAccessoryRow(row.id, "costo", e.target.value)}
                        onKeyDown={(e) => handleAccessoryKeyDown(e, rowIndex, 1)}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className={`${tableInputClass} text-right`}
                      />
                    </TD>
                    <TD className="text-right">
                      <Button
                        type="button"
                        variant="danger"
                        className="h-8 px-2 text-xs"
                        onClick={() => deleteAccessoryRow(row.id)}
                      >
                        Eliminar
                      </Button>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => appendAccessoryRowAndFocus(0)}>
              Agregar insumo
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Precio sugerido al cliente</p>
          <p className="mt-1 text-4xl font-extrabold text-[var(--color-text-primary)]">{formatPen(totals.precioFinal)}</p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Costo madera: {formatPen(totals.costoMadera)} + Mano de obra / Otros: {formatPen(totals.costoOtros)} +
            Insumos extra: {formatPen(totals.costoAccesorios)}
          </p>
          {maderaDelCliente ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Modo cliente activo: no se cobra madera, solo mano de obra e insumos extra.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Descripción del Mueble</span>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Ropero 2 puertas + 3 cajones"
              className={inputClass}
            />
          </label>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/35 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Dimensiones Finales del Mueble
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Ancho (cm)</span>
                <input
                  value={anchoFinalCm}
                  onChange={(e) => setAnchoFinalCm(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Alto (cm)</span>
                <input
                  value={altoFinalCm}
                  onChange={(e) => setAltoFinalCm(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fondo/Profundidad (cm)</span>
                <input
                  value={fondoFinalCm}
                  onChange={(e) => setFondoFinalCm(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Distribución Interior</span>
                <input
                  value={distribucionInterior}
                  onChange={(e) => setDistribucionInterior(e.target.value)}
                  placeholder="Ej: 65cm colgador, 35cm repisas"
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Observaciones técnicas</span>
            <textarea
              value={observacionesTecnicas}
              onChange={(e) => setObservacionesTecnicas(e.target.value)}
              placeholder="Ej: Triplay espalda, puerta con porta espejo..."
              rows={2}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/70 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        {savedAt ? <p className="text-sm text-[var(--color-success)]">Cotización preparada para guardar ({savedAt}).</p> : null}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            Confirmar y Guardar Cotización
          </Button>
        </div>
      </div>
    </Card>
  );
}
