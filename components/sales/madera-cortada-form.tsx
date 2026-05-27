"use client";

import { submitCreateVentaMaderaCortadaForm } from "@/app/actions";
import { useMemo, useState, useEffect, useActionState, useCallback } from "react";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field, SelectField } from "@/components/ui/field";
import { liteClientesToCompleto, MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { formatPen } from "@/lib/utils";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import type { ZonaEntregaRow } from "@/lib/demo-store";
import { useToast } from "@/components/ui/toast";
import { CubicajeInput } from "@/components/sales/cubicaje-input";

type Cliente = { id: string; nombre: string };
type Chofer = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type Producto = {
  id: string;
  nombre: string;
  unidad: string;
  stock_actual: number | string;
  categoria: string;
  costo_unitario?: number | string | null;
};

type MaderaCortadaFormProps = {
  clientes: Cliente[];
  choferes: Chofer[];
  productos: Producto[];
  zonas?: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  mockData?: boolean;
  /** Callback que se dispara cuando la venta se guardó con éxito (para cerrar el modal). */
  onSuccess?: () => void;
};

const tiposCorte = [
  { value: "tabla", label: "Tabla" },
  { value: "liston", label: "Listón" },
  { value: "cuarton", label: "Cuartón" },
  { value: "poste", label: "Poste" },
] as const;

function calcularPT(cantidad: number, espesor: number, ancho: number, largo: number) {
  return (cantidad * espesor * ancho * largo) / 12;
}

function parseDimensionesDeNombre(nombre: string) {
  const cleanName = nombre.replace(/\s+/g, " ");
  // Match three numbers separated by x or * or unicode × (e.g. 2x10x240 or 2×6×8)
  const threePartMatch = cleanName.match(/(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)/);
  if (threePartMatch) {
    const parseFractionOrFloat = (str: string) => {
      if (str.includes("/")) {
        const parts = str.split("/");
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(str);
    };
    
    const espesor = parseFractionOrFloat(threePartMatch[1]);
    const ancho = parseFractionOrFloat(threePartMatch[2]);
    let largo = parseFractionOrFloat(threePartMatch[3]);
    if (largo > 20) {
      // If length > 20, assume it's in cm and convert to feet by dividing by 30
      largo = Math.round(largo / 30);
    }
    const descMatch = cleanName.match(/^(.*?)\b\d/);
    const descripcion = descMatch ? descMatch[1].trim() : cleanName;

    return { espesor, ancho, largo, descripcion };
  }
  
  // Match two numbers separated by x or * or × (e.g. 2x4)
  const twoPartMatch = cleanName.match(/(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)/);
  if (twoPartMatch) {
    const parseFractionOrFloat = (str: string) => {
      if (str.includes("/")) {
        const parts = str.split("/");
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(str);
    };
    const espesor = parseFractionOrFloat(twoPartMatch[1]);
    const ancho = parseFractionOrFloat(twoPartMatch[2]);
    const descMatch = cleanName.match(/^(.*?)\b\d/);
    const descripcion = descMatch ? descMatch[1].trim() : cleanName;
    return { espesor, ancho, largo: 8, descripcion }; // default 8 ft length
  }

  return { espesor: 2, ancho: 6, largo: 8, descripcion: nombre };
}

export function MaderaCortadaForm({
  clientes,
  choferes,
  productos,
  zonas = [],
  mockData = false,
  onSuccess,
}: MaderaCortadaFormProps) {
  const { showToast } = useToast();
  const hoy = new Date().toISOString().slice(0, 10);

  // Wizard Navigation States
  const [step, setStep] = useState(1);
  const [touchedSteps, setTouchedSteps] = useState<Record<number, boolean>>({});

  // Paso 1 States
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");

  // Paso 1 Comprobante
  const [tipoComprobante, setTipoComprobante] = useState<"boleta" | "factura">("boleta");

  // Paso 2 States
  const [tipoCorte, setTipoCorte] = useState("tabla");
  const [productoId, setProductoId] = useState("");
  const [totalPt, setTotalPt] = useState<number>(0);
  const [totalPC, setTotalPC] = useState<number>(0);
  const [precioPorPt, setPrecioPorPt] = useState<number>(0);
  const [totalSolesCalculado, setTotalSolesCalculado] = useState<number>(0);

  // Paso 3 States
  const [totalManual, setTotalManual] = useState<string>("");

  const handleCubicajeChange = useCallback((data: { totalPT: number; totalPC: number; precioPorPT: number; totalSoles: number; piezas: any[] }) => {
    setTotalPt(data.totalPT);
    setTotalPC(data.totalPC);
    setPrecioPorPt(data.precioPorPT);
    setTotalSolesCalculado(data.totalSoles);
    const firstProd = data.piezas.find((p) => p.inventario_producto_id)?.inventario_producto_id || "";
    setProductoId(firstProd);
  }, []);

  const totalFinal = totalManual !== "" ? (Number(totalManual) || 0) : totalSolesCalculado;

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);

  const selectedCliente = useMemo(() => {
    return todosLosClientes.find((c) => c.id === clienteId);
  }, [clienteId, todosLosClientes]);
  const selectedClienteRuc = (selectedCliente as { ruc?: string })?.ruc || "";
  const selectedClienteDoc = (selectedCliente as { documento?: string })?.documento || "";
  const hasRuc = !!(selectedClienteRuc && selectedClienteRuc.trim().length === 11);

  // useActionState para detectar éxito y cerrar automáticamente
  const [state, formAction] = useActionState(submitCreateVentaMaderaCortadaForm, mutationFormInitialState);

  useEffect(() => {
    if (state?.success && state?.message) {
      showToast({ variant: "success", message: state.message });
      
      // Open print ticket automatically
      if (state.id) {
        const isFactura = tipoComprobante === "factura" && hasRuc;
        const printUrl = `/ventas/comprobante/venta-madera/${state.id}?tipoComprobante=${isFactura ? "factura" : "boleta"}`;
        window.open(printUrl, "_blank");
      }

      // Limpiar estados de la calculadora y formulario
      setClienteId("");
      setFecha(hoy);
      setTipoComprobante("boleta");
      setTotalPt(0);
      setTotalPC(0);
      setPrecioPorPt(0);
      setTotalSolesCalculado(0);
      setProductoId("");
      setTotalManual("");
      
      if (onSuccess) {
        onSuccess();
      }
    } else if (state?.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onSuccess, hoy, tipoComprobante, hasRuc]);



  const effectiveProductos = useMemo((): Producto[] => {
    if (!mockData) return productos;
    return MOCK_INVENTARIO_PRODUCTOS.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stock_actual: p.stock_actual,
      categoria: p.categoria,
      costo_unitario: p.costo_unitario,
    }));
  }, [mockData, productos]);

  const clientesCombo = useMemo(() => liteClientesToCompleto(todosLosClientes), [todosLosClientes]);

  const productoComboOptions = useMemo(
    () => [
      { value: "", label: "Sin descontar inventario", sublabel: undefined },
      ...effectiveProductos.map((p) => ({
        value: p.id,
        label: p.nombre,
        sublabel: `stock ${(() => {
          const u = (p.unidad ?? "").trim().toLowerCase();
          const val = Number(p.stock_actual);
          if (u === "unidad" || u === "u" || u === "u." || u === "pzs" || u === "pieza" || u === "piezas") return Math.round(val);
          return Number(val.toFixed(2));
        })()} ${p.unidad}`,
      })),
    ],
    [effectiveProductos],
  );

  const productoSeleccionado = effectiveProductos.find((p) => p.id === productoId);
  const stockDisponible = productoSeleccionado ? Number(productoSeleccionado.stock_actual) : 0;
  const sinStock = productoSeleccionado && stockDisponible <= 0;

  const defaultPiezasParaCalculadora = useMemo(() => {
    if (!productoId) return [];
    const prod = effectiveProductos.find((p) => p.id === productoId);
    if (!prod) return [];
    const parsed = parseDimensionesDeNombre(prod.nombre);
    return [
      {
        id: 1,
        style: undefined,
        cantidad: 1,
        espesor: parsed.espesor,
        ancho: parsed.ancho,
        largo: parsed.largo,
        descripcion: parsed.descripcion,
      },
    ];
  }, [productoId, effectiveProductos]);

  function handleClienteCreado(id: string, nombre: string, documento?: string, ruc?: string) {
    setClientesLocales((prev) => [...prev, { id, nombre, documento, ruc }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  function handleStepClick(targetStep: number) {
    setTouchedSteps((prev) => ({ ...prev, [step]: true }));
    setStep(targetStep);
  }



  // Dynamic Validation indicators per step
  const stepErrors = useMemo(() => {
    const errors: Record<number, boolean> = {};

    // Paso 1: Cliente y Fecha (si es factura, RUC obligatorio de 11 dígitos)
    errors[1] = !clienteId || !fecha || (tipoComprobante === "factura" && !hasRuc);

    // Paso 2: Detalles de Corte y Calculadora
    errors[2] =
      totalPt <= 0 ||
      precioPorPt <= 0 ||
      (productoSeleccionado !== undefined && totalPC > stockDisponible);

    // Paso 3: Resumen y Cobro (si es totalManual menor a cero, por ejemplo)
    errors[3] = totalFinal < 0;

    return errors;
  }, [clienteId, fecha, tipoComprobante, hasRuc, totalPt, precioPorPt, totalPC, stockDisponible, productoSeleccionado, totalFinal]);

  const anyValidationError = stepErrors[1] || stepErrors[2] || stepErrors[3];

  return (
    <form action={formAction} className="space-y-6">
      {/* ── STEPPER DE WIZARD ── */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: "Cliente" },
            { n: 2, label: "Corte" },
            { n: 3, label: "Cobro" },
            { n: 4, label: "Confirmar" },
          ].map((item, index) => {
            const isCompleted = step > item.n;
            const isActive = step === item.n;
            const hasError = stepErrors[item.n] && (touchedSteps[item.n] || step > item.n);

            return (
              <div key={item.n} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(item.n)}
                  className="flex flex-col items-center flex-1 focus:outline-none group"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                      hasError
                        ? "bg-[var(--color-danger)] border-[var(--color-danger)] text-white animate-pulse"
                        : isCompleted
                        ? "bg-[var(--color-success)] border-[var(--color-success)] text-white"
                        : isActive
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                        : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {hasError ? "⚠️" : isCompleted ? "✓" : item.n}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-semibold tracking-wide transition-all duration-300 hidden sm:inline ${
                      hasError
                        ? "text-[var(--color-danger)] font-bold"
                        : isActive
                        ? "text-[var(--color-primary)] font-bold"
                        : isCompleted
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
                {index < 3 && (
                  <div
                    className={`h-0.5 w-full -mt-4 transition-all duration-500 ${
                      step > item.n
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PASO 1: DATOS DEL CLIENTE ── */}
      <div style={{ display: step === 1 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 1: Datos del cliente y comprobante</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Elige el tipo de comprobante de pago y busca o registra al cliente.
          </p>

          {/* Tipo de Comprobante */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Comprobante *
            </p>
            <div className="flex gap-2">
              {[
                { value: "boleta", label: "Boleta" },
                { value: "factura", label: "Factura" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTipoComprobante(opt.value as any);
                    setTouchedSteps((prev) => ({ ...prev, 1: true }));
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    tipoComprobante === opt.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="tipo_comprobante" value={tipoComprobante} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {modoCliente === "buscar" ? (
                <>
                  <ClienteCombobox
                    mockData={mockData}
                    clientes={clientesCombo}
                    value={clienteId}
                    onChange={(val) => {
                      setClienteId(val);
                      setTouchedSteps((prev) => ({ ...prev, 1: true }));
                    }}
                    hiddenInputName="cliente_id"
                    label="Cliente *"
                    placeholder="Buscar cliente…"
                    inputAriaLabel="Cliente para venta de madera cortada"
                    className={touchedSteps[1] && (!clienteId || (tipoComprobante === "factura" && !hasRuc)) ? "!border-[var(--color-danger)]" : ""}
                  />
                  {tipoComprobante === "factura" && !hasRuc && clienteId && (
                    <p className="text-xs font-semibold text-[var(--color-danger)] pt-1">
                      ⚠️ El cliente seleccionado no tiene un RUC de 11 dígitos válido. Por favor edítalo o selecciona un cliente con RUC para emitir Factura.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModoCliente("nuevo")}
                      className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                    >
                      + Nuevo cliente
                    </button>
                    <span className="text-xs text-[var(--color-text-secondary)]">·</span>
                    <button
                      type="button"
                      onClick={() => setModoCliente("temporal")}
                      className="text-xs font-semibold text-[var(--color-text-secondary)] hover:underline"
                    >
                      + Cliente temporal
                    </button>
                  </div>
                </>
              ) : (
                <NuevoClienteInlinePanel
                  temporal={modoCliente === "temporal"}
                  onCreated={handleClienteCreado}
                  onCancel={() => setModoCliente("buscar")}
                />
              )}
            </div>

            <Field
              name="fecha"
              type="date"
              label="Fecha *"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setTouchedSteps((prev) => ({ ...prev, 1: true }));
              }}
              required
              className={touchedSteps[1] && !fecha ? "!border-[var(--color-danger)]" : ""}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="button"
            onClick={() => {
              setTouchedSteps((prev) => ({ ...prev, 1: true }));
              setStep(2);
            }}
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Detalle del corte →
          </Button>
        </div>
      </div>

      {/* ── PASO 2: DETALLE DEL CORTE ── */}
      <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Detalle del corte y cubicaje</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Define el tipo de corte y calcula el volumen total de pies tablares (PT) de madera.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="tipo_corte" value={tipoCorte} />
            <input type="hidden" name="inventario_producto_id" value={productoId} />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Calculadora de cubicaje
            </p>

            <CubicajeInput
              name="lineas_cubicaje"
              totalPtName="total_pt_calc"
              totalM3Name="total_m3_calc"
              onChange={handleCubicajeChange}
              defaultPiezas={[]}
              productos={effectiveProductos}
              defaultPrecioPorPT={precioPorPt > 0 ? String(precioPorPt) : "0"}
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(1)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTouchedSteps((prev) => ({ ...prev, 2: true }));
              setStep(3);
            }}
            className="px-6 py-2"
          >
            Siguiente: Cobro y Entrega →
          </Button>
        </div>
      </div>

      {/* ── PASO 3: RESUMEN Y COBRO ── */}
      <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 3: Resumen de cobro, entrega y pago</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/10 p-4 space-y-3">
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Costo sugerido</h4>
                <div className="flex justify-between items-center text-sm border-b border-[var(--color-border)] pb-2">
                  <span>Corte: {totalPt.toFixed(2)} PT a S/ {precioPorPt || "0.00"}</span>
                  <span className="font-semibold">{formatPen(totalSolesCalculado)}</span>
                </div>
                
                <div className="space-y-1.5 pt-1">
                  <label htmlFor="total-editable" className="text-sm font-medium text-[var(--color-text-primary)]">Total editable (S/)</label>
                  <input
                    id="total-editable"
                    name="total_manual_input"
                    type="number"
                    step="0.01"
                    value={totalManual}
                    placeholder={totalSolesCalculado.toFixed(2)}
                    onChange={(e) => {
                      setTotalManual(e.target.value);
                      setTouchedSteps((prev) => ({ ...prev, 3: true }));
                    }}
                    className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-bold text-[var(--color-text-primary)] focus-visible:border-[var(--accent-primary)] focus-visible:ring-2"
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary)]">Deja en blanco para usar el costo sugerido ({formatPen(totalSolesCalculado)}).</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Datos de pago</p>
                <PagoFormFields showAdelantoInput={true} />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Datos de entrega</p>
              <EntregaFormFields mockData={mockData} choferes={choferes} zonas={zonas} />
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(2)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTouchedSteps((prev) => ({ ...prev, 3: true }));
              setStep(4);
            }}
            className="px-6 py-2"
          >
            Siguiente: Confirmar →
          </Button>
        </div>
      </div>

      {/* ── PASO 4: CONFIRMAR Y REGISTRAR ── */}
      <div style={{ display: step === 4 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 4: Confirmar y registrar</h3>

          {anyValidationError ? (
            <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-[var(--color-danger)]">
              <p className="text-sm font-semibold">⚠️ Existen errores de validación en pasos anteriores</p>
              <p className="text-xs">Por favor, regresa a los pasos marcados con advertencias para completar todos los campos obligatorios.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
              <p className="text-sm font-semibold">✓ Todo listo para registrar</p>
              <p className="text-xs">Por favor, revisa el resumen a continuación antes de proceder a registrar la venta.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Resumen Cliente y Corte */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cliente & Comprobante</h4>
              <p className="text-sm">
                <strong>Cliente:</strong> {todosLosClientes.find((c) => c.id === clienteId)?.nombre ?? "No seleccionado"}
              </p>
              <p className="text-sm">
                <strong>Comprobante:</strong> <span className="capitalize">{tipoComprobante}</span>
              </p>
              {tipoComprobante === "factura" && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  · RUC: {selectedClienteRuc || <span className="text-red-500 font-semibold">Falta RUC</span>}
                </p>
              )}
              {tipoComprobante === "boleta" && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  · DNI/Doc: {selectedClienteDoc || "Opcional"}
                </p>
              )}
              <p className="text-sm">
                <strong>Fecha:</strong> {fecha}
              </p>

              <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider mt-4">Detalles del Cubicaje</h4>
              <p className="text-sm">
                <strong>Volumen Pies Tablares:</strong> {totalPt.toFixed(2)} PT
              </p>
              <p className="text-sm">
                <strong>Volumen Pies Cúbicos:</strong> {totalPC.toFixed(2)} ft³
              </p>
              <p className="text-sm">
                <strong>Costo por PT:</strong> {formatPen(Number(precioPorPt) || 0)}
              </p>
            </div>

            {/* Resumen Cobro Final */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cobro y Financiero</h4>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Costo sugerido:</span>
                  <span>{formatPen(totalSolesCalculado)}</span>
                </div>
                {totalManual !== "" && (
                  <div className="flex justify-between text-xs text-[var(--color-accent)] font-bold">
                    <span>Ajuste manual:</span>
                    <span>{formatPen(Number(totalManual) || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black border-t border-[var(--color-border)] pt-2 text-[var(--color-primary)]">
                  <span>PRECIO COBRADO FINAL:</span>
                  <span>{formatPen(totalFinal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(3)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            size="lg"
            disabled={anyValidationError}
            className="px-8 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Registrar venta ✓
          </Button>
        </div>
      </div>

      {/* Hidden inputs expected by submitCreateVentaMaderaCortadaForm */}
      <input type="hidden" name="total_pt" value={totalPt.toFixed(4)} />
      <input type="hidden" name="precio_por_pt" value={precioPorPt} />
      <input type="hidden" name="total" value={totalFinal.toFixed(2)} />

      {state?.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 mt-2">{state.error}</p>
      )}
    </form>
  );
}
