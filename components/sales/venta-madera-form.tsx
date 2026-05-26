"use client";

import { submitCreateVentaMaderaForm } from "@/app/actions";
import { useMemo, useState, useActionState, useEffect } from "react";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Combobox } from "@/components/ui/Combobox";
import { Field, SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { liteClientesToCompleto, MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { formatPen } from "@/lib/utils";

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string;
  nombre: string;
  unidad: string;
  stock_actual: number | string;
  categoria: string;
};

type VentaMaderaFormProps = {
  clientes: Cliente[];
  productos: Producto[];
  mockData?: boolean;
  onSuccess?: () => void;
};

export function VentaMaderaForm({
  clientes,
  productos,
  mockData = false,
  onSuccess,
}: VentaMaderaFormProps) {
  const { showToast } = useToast();
  const hoy = new Date().toISOString().slice(0, 10);

  // Form States
  const [clienteId, setClienteId] = useState("");
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");
  const [fecha, setFecha] = useState(hoy);
  const [modalidadPago, setModalidadPago] = useState<"contado" | "adelanto" | "credito">("contado");
  const [metodoPago, setMetodoPago] = useState("efectivo");

  // Product States
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState<number | "">("");
  const [precioUnitario, setPrecioUnitario] = useState<number | "">("");
  const [tipoComprobante, setTipoComprobante] = useState<"boleta" | "factura">("boleta");

  // Payment states
  const [adelanto, setAdelanto] = useState<number | "">("");

  const [step, setStep] = useState(1);
  const [touchedSteps, setTouchedSteps] = useState<Record<number, boolean>>({});

  // Action State
  const [state, formAction] = useActionState(submitCreateVentaMaderaForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onSuccess?.();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onSuccess]);

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const clientesCombo = useMemo(() => liteClientesToCompleto(todosLosClientes), [todosLosClientes]);
  const selectedCliente = useMemo(() => {
    return todosLosClientes.find((c) => c.id === clienteId);
  }, [clienteId, todosLosClientes]);
  const selectedClienteRuc = (selectedCliente as any)?.ruc || "";
  const selectedClienteDoc = (selectedCliente as any)?.documento || "";
  const hasRuc = !!(selectedClienteRuc && selectedClienteRuc.trim().length === 11);

  const effectiveProductos = useMemo((): Producto[] => {
    if (!mockData) return productos;
    return MOCK_INVENTARIO_PRODUCTOS.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stock_actual: p.stock_actual,
      categoria: p.categoria,
    }));
  }, [mockData, productos]);

  const productoComboOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar producto de madera…", sublabel: undefined },
      ...effectiveProductos.map((p) => ({
        value: p.id,
        label: p.nombre,
        sublabel: `Stock: ${(() => {
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
  const selectedUnit = productoSeleccionado?.unidad || "Pzs";
  const stockDisponible = productoSeleccionado ? Number(productoSeleccionado.stock_actual) : 0;
  const sinStock = productoSeleccionado && stockDisponible <= 0;

  // Auto-calculated total
  const total = useMemo(() => {
    const qty = cantidad === "" ? 0 : cantidad;
    const price = precioUnitario === "" ? 0 : precioUnitario;
    return qty * price;
  }, [cantidad, precioUnitario]);

  // Pending balance
  const saldoPendiente = useMemo(() => {
    if (modalidadPago === "contado") return 0;
    const adv = adelanto === "" ? 0 : adelanto;
    return Math.max(0, total - adv);
  }, [total, modalidadPago, adelanto]);

  // Validation checks per step
  const stepErrors = useMemo(() => {
    const errors: Record<number, boolean> = {};

    // Paso 1: Cliente y Fecha (si es factura, RUC obligatorio de 11 dígitos)
    errors[1] = !clienteId || !fecha || (tipoComprobante === "factura" && !hasRuc);

    // Paso 2: Producto, Cantidad y Precio
    errors[2] =
      !productoId ||
      cantidad === "" ||
      cantidad <= 0 ||
      precioUnitario === "" ||
      precioUnitario <= 0 ||
      (productoSeleccionado !== undefined && cantidad > stockDisponible);

    // Paso 3: Adelanto si aplica
    if (modalidadPago === "adelanto") {
      errors[3] = adelanto === "" || adelanto < 0 || adelanto > total;
    } else {
      errors[3] = false;
    }

    return errors;
  }, [clienteId, fecha, productoId, cantidad, precioUnitario, productoSeleccionado, stockDisponible, modalidadPago, adelanto, total]);

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  function handleStepClick(targetStep: number) {
    setTouchedSteps((prev) => ({ ...prev, [step]: true }));
    setStep(targetStep);
  }

  const anyValidationError = stepErrors[1] || stepErrors[2] || stepErrors[3];

  return (
    <form action={formAction} className="space-y-6">
      {/* Stepper del Wizard */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: "Cliente" },
            { n: 2, label: "Producto" },
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

      {/* PASO 1: DATOS DEL CLIENTE */}
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
                  onClick={() => setTipoComprobante(opt.value as any)}
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
                <div className="space-y-1">
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
                    inputAriaLabel="Cliente para venta de madera clásica"
                    className={touchedSteps[1] && (!clienteId || (tipoComprobante === "factura" && !hasRuc)) ? "!border-[var(--color-danger)]" : ""}
                  />
                  {tipoComprobante === "factura" && !hasRuc && clienteId && (
                    <p className="text-xs font-semibold text-red-500 mt-1">
                      ⚠️ El cliente seleccionado no tiene un RUC de 11 dígitos válido.
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
                </div>
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
              label="Fecha de registro *"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setTouchedSteps((prev) => ({ ...prev, 1: true }));
              }}
              required
              className={touchedSteps[1] && !fecha ? "!border-[var(--color-danger)]" : ""}
            />

            <SelectField
              label="Modalidad de pago"
              value={modalidadPago}
              onChange={(e) => {
                setModalidadPago(e.target.value as "contado" | "adelanto" | "credito");
                if (e.target.value !== "adelanto") setAdelanto("");
              }}
            >
              <option value="contado">Al contado</option>
              <option value="adelanto">Con adelanto</option>
              <option value="credito">A crédito</option>
            </SelectField>

            <SelectField
              label="Método de pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="yape">Yape / Plin</option>
              <option value="transferencia">Transferencia bancaria</option>
            </SelectField>
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
            Siguiente: Producto →
          </Button>
        </div>
      </div>

      {/* PASO 2: PRODUCTO */}
      <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Producto</h3>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 flex flex-col">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Especie de madera (Inventario) *</span>
              <Combobox
                options={productoComboOptions}
                value={productoId}
                onChange={(val) => {
                  setProductoId(val);
                  setTouchedSteps((prev) => ({ ...prev, 2: true }));
                }}
                hiddenInputName="inventario_producto_id"
                placeholder="Buscar producto…"
                inputAriaLabel="Especie de madera de inventario"
                className={touchedSteps[2] && !productoId ? "!border-[var(--color-danger)]" : ""}
              />
              {productoSeleccionado && (
                <span className="text-xs font-semibold text-[var(--color-accent)] mt-1">
                  Stock actual: {(() => {
                    const u = (selectedUnit ?? "").trim().toLowerCase();
                    if (u === "unidad" || u === "u" || u === "u." || u === "pzs" || u === "pieza" || u === "piezas") return Math.round(stockDisponible);
                    return Number(stockDisponible.toFixed(2));
                  })()} {selectedUnit}
                </span>
              )}
            </div>

            <div className="grid gap-3 grid-cols-2">
              <Field
                label={`Cantidad (${selectedUnit}) *`}
                type="number"
                min="0.01"
                step="0.01"
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value === "" ? "" : (Number(e.target.value) || 0));
                  setTouchedSteps((prev) => ({ ...prev, 2: true }));
                }}
                className={
                  touchedSteps[2] && (cantidad === "" || cantidad <= 0 || (productoSeleccionado && cantidad > stockDisponible))
                    ? "!border-[var(--color-danger)]"
                    : ""
                }
              />

              <Field
                label="Precio unitario (S/) *"
                type="number"
                min="0.01"
                step="0.01"
                value={precioUnitario}
                onChange={(e) => {
                  setPrecioUnitario(e.target.value === "" ? "" : (Number(e.target.value) || 0));
                  setTouchedSteps((prev) => ({ ...prev, 2: true }));
                }}
                className={touchedSteps[2] && (precioUnitario === "" || precioUnitario <= 0) ? "!border-[var(--color-danger)]" : ""}
              />
            </div>
          </div>

          {productoSeleccionado && cantidad !== "" && cantidad > stockDisponible ? (
            <p className="text-xs font-semibold text-[var(--color-danger)]">
              ⚠️ La cantidad a vender ({cantidad}) excede el stock disponible ({stockDisponible} {selectedUnit}).
            </p>
          ) : null}

          {sinStock ? (
            <p className="text-xs font-semibold text-[var(--color-danger)]">
              ⚠️ El producto seleccionado no tiene stock disponible para la venta.
            </p>
          ) : null}

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-4 flex justify-between items-center mt-4">
            <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Total calculado en vivo:</span>
            <span className="text-2xl font-black text-[var(--color-primary)]">{formatPen(total)}</span>
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
            Siguiente: Resumen →
          </Button>
        </div>
      </div>

      {/* PASO 3: RESUMEN Y COBRO */}
      <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 3: Cobro y condiciones</h3>
          
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
            <div className="flex justify-between items-center text-sm border-b border-[var(--color-border)] pb-2">
              <span className="text-[var(--color-text-secondary)] font-medium">Subtotal venta:</span>
              <span className="font-bold text-lg">{formatPen(total)}</span>
            </div>

            {modalidadPago === "adelanto" && (
              <div className="space-y-2 pt-2">
                <Field
                  label="Monto del adelanto (S/) *"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adelanto}
                  onChange={(e) => {
                    setAdelanto(e.target.value === "" ? "" : (Number(e.target.value) || 0));
                    setTouchedSteps((prev) => ({ ...prev, 3: true }));
                  }}
                  className={
                    touchedSteps[3] && (adelanto === "" || adelanto < 0 || adelanto > total)
                      ? "!border-[var(--color-danger)]"
                      : ""
                  }
                />
                {touchedSteps[3] && adelanto !== "" && adelanto > total ? (
                  <p className="text-xs font-semibold text-[var(--color-danger)]">
                    ⚠️ El adelanto no puede ser mayor que el total de la venta ({formatPen(total)}).
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex justify-between items-center text-base pt-2">
              <span className="text-[var(--color-text-secondary)] font-semibold">Monto cobrado hoy:</span>
              <span className="font-black text-lg text-[var(--color-success)]">
                {formatPen(modalidadPago === "contado" ? total : modalidadPago === "adelanto" ? Number(adelanto) || 0 : 0)}
              </span>
            </div>

            <div className="flex justify-between items-center text-base border-t border-dashed border-[var(--color-border)] pt-2">
              <span className="text-[var(--color-text-secondary)] font-semibold">Saldo pendiente:</span>
              <span className={`font-black text-lg ${saldoPendiente > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>
                {formatPen(saldoPendiente)}
              </span>
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

      {/* PASO 4: CONFIRMAR Y REGISTRAR */}
      <div style={{ display: step === 4 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 4: Confirmar y registrar</h3>

          {anyValidationError ? (
            <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-[var(--color-danger)]">
              <p className="text-sm font-semibold">⚠️ Existen errores de validación en pasos anteriores</p>
              <p className="text-xs">Por favor, regresa a los pasos marcados con advertencias para completar correctamente todos los campos obligatorios.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
              <p className="text-sm font-semibold">✓ Todo listo para registrar</p>
              <p className="text-xs">Por favor, revisa el resumen a continuación antes de proceder a guardar el servicio.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Resumen del Cliente */}
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
              <p className="text-sm">
                <strong>Modalidad:</strong> <span className="capitalize">{modalidadPago}</span>
              </p>
              <p className="text-sm">
                <strong>Método de pago:</strong> <span className="capitalize">{metodoPago}</span>
              </p>
            </div>

            {/* Resumen del Producto y Cobro */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Detalle del Producto</h4>
              <p className="text-sm">
                <strong>Producto / Especie:</strong> {productoSeleccionado?.nombre ?? "Ninguno seleccionado"}
              </p>
              <p className="text-sm">
                <strong>Cantidad:</strong> {cantidad} {selectedUnit}
              </p>
              <p className="text-sm">
                <strong>Precio unitario:</strong> {formatPen(Number(precioUnitario) || 0)}
              </p>
              <div className="border-t border-[var(--color-border)] pt-2 space-y-1">
                <div className="flex justify-between text-base font-black text-[var(--color-primary)]">
                  <span>TOTAL VENTA:</span>
                  <span>{formatPen(total)}</span>
                </div>
                {modalidadPago === "adelanto" && (
                  <div className="flex justify-between text-xs text-[var(--color-success)] font-bold">
                    <span>Adelanto pagado:</span>
                    <span>{formatPen(Number(adelanto) || 0)}</span>
                  </div>
                )}
                {saldoPendiente > 0 && (
                  <div className="flex justify-between text-xs text-[var(--color-danger)] font-bold">
                    <span>Saldo pendiente:</span>
                    <span>{formatPen(saldoPendiente)}</span>
                  </div>
                )}
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
            Confirmar y registrar ✓
          </Button>
        </div>
      </div>

      {/* Hidden inputs to matching createVentaMadera form expectations */}
      <input type="hidden" name="total" value={total.toFixed(2)} />
      <input type="hidden" name="estado" value="confirmada" />
      <input type="hidden" name="cantidad_product" value={cantidad} />
      <input type="hidden" name="cantidad_producto" value={cantidad} />
      {state?.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 mt-2">{state.error}</p>
      )}
    </form>
  );
}
