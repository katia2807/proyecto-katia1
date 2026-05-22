"use client";

import { submitCreateVentaMuebleTerminadoForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { liteClientesToCompleto, MOCK_MUEBLES_CATALOGO_VENTA } from "@/lib/combobox-mocks";
import type { ZonaEntregaRow } from "@/lib/demo-store";
import { formatPen } from "@/lib/utils";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState, useCallback, useActionState, useEffect, useRef } from "react";

type ClienteOpt = { id: string; nombre: string };
type ChoferOpt = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type MuebleOpt = {
  id: string;
  codigo: string;
  nombre: string;
  precio_lista: number | string;
  stock_disponible: number | string;
};

type TipoComprobante = "nota_venta" | "boleta" | "factura";

type MueblesTerminadosContextPanelsProps = {
  clientes: ClienteOpt[];
  muebles: MuebleOpt[];
  choferes: ChoferOpt[];
  zonas: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  fechaDefault: string;
  mockData?: boolean;
};


export function MueblesTerminadosContextPanels({
  clientes,
  muebles,
  choferes,
  zonas,
  fechaDefault,
  mockData = false,
}: MueblesTerminadosContextPanelsProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [clienteVentaId, setClienteVentaId] = useState("");
  const [muebleCatalogoId, setMuebleCatalogoId] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>("nota_venta");
  const [precioUnitario, setPrecioUnitario] = useState("");

  // Nuevos estados para el wizard
  const [step, setStep] = useState(1);
  const [cantidad, setCantidad] = useState("1");
  const [fecha, setFecha] = useState(fechaDefault || new Date().toISOString().slice(0, 10));
  const [rucFactura, setRucFactura] = useState("");
  const [dniBoleta, setDniBoleta] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  const [deliveryInfo, setDeliveryInfo] = useState({
    tipo_entrega: "envio",
    direccion_entrega: "",
    costo_envio: "0",
    chofer_id: "",
    zona_entrega_id: "",
    estado_entrega: "pendiente",
    metodo_pago: "efectivo",
    modalidad_pago: "contado",
    fecha_pago_credito: "",
    adelanto: "0",
    monto_credito: "0",
  });

  // Estado para crear cliente inline
  const [clientesLocales, setClientesLocales] = useState<ClienteOpt[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");

  const [state, formAction] = useActionState(submitCreateVentaMuebleTerminadoForm, mutationFormInitialState);

  function syncFormValues() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setDeliveryInfo({
      tipo_entrega: String(formData.get("tipo_entrega") || "envio"),
      direccion_entrega: String(formData.get("direccion_entrega") || ""),
      costo_envio: String(formData.get("costo_envio") || "0"),
      chofer_id: String(formData.get("chofer_id") || ""),
      zona_entrega_id: String(formData.get("zona_entrega_id") || ""),
      estado_entrega: String(formData.get("estado_entrega") || "pendiente"),
      metodo_pago: String(formData.get("metodo_pago") || "efectivo"),
      modalidad_pago: String(formData.get("modalidad_pago") || "contado"),
      fecha_pago_credito: String(formData.get("fecha_pago_credito") || ""),
      adelanto: String(formData.get("adelanto") || "0"),
      monto_credito: String(formData.get("monto_credito") || "0"),
    });
  }

  function handleFormChange() {
    syncFormValues();
  }

  // Sincronizar al cambiar de paso
  useEffect(() => {
    if (step === 4) {
      syncFormValues();
    }
  }, [step]);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    setFormKey((k) => k + 1);
    setClienteVentaId("");
    setMuebleCatalogoId("");
    setTipoComprobante("nota_venta");
    setModoCliente("buscar");
    setStep(1);
    setCantidad("1");
    setFecha(fechaDefault || new Date().toISOString().slice(0, 10));
    setRucFactura("");
    setDniBoleta("");
    setDeliveryInfo({
      tipo_entrega: "envio",
      direccion_entrega: "",
      costo_envio: "0",
      chofer_id: "",
      zona_entrega_id: "",
      estado_entrega: "pendiente",
      metodo_pago: "efectivo",
      modalidad_pago: "contado",
      fecha_pago_credito: "",
      adelanto: "0",
      monto_credito: "0",
    });
  }, [fechaDefault]);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      handleSuccess();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, handleSuccess]);

  const clientesCombo = useMemo(
    () => liteClientesToCompleto([...clientes, ...clientesLocales]),
    [clientes, clientesLocales],
  );

  const activeMuebles = useMemo((): MuebleOpt[] => {
    return (mockData && muebles.length === 0)
      ? [...MOCK_MUEBLES_CATALOGO_VENTA].map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        precio_lista: m.precio_lista,
        stock_disponible: m.stock_disponible,
      }))
      : muebles;
  }, [mockData, muebles]);

  const muebleOptions = useMemo(() => {
    return activeMuebles.map((m) => ({
      value: m.id,
      label: `${m.codigo} — ${m.nombre}`,
      sublabel: `${formatPen(Number(m.precio_lista))}${Number(m.stock_disponible) <= 0 ? " · sin stock" : ""
        }`,
    }));
  }, [activeMuebles]);

  useEffect(() => {
    if (muebleCatalogoId) {
      const selected = activeMuebles.find((m) => m.id === muebleCatalogoId);
      if (selected) {
        setPrecioUnitario(String(selected.precio_lista));
      }
    } else {
      setPrecioUnitario("");
    }
  }, [muebleCatalogoId, activeMuebles]);

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteVentaId(id);
    setModoCliente("buscar");
  }

  // Cálculos de validaciones visuales
  const hasStep1Warning = !clienteVentaId;
  const hasStep2Warning = !muebleCatalogoId || !cantidad || Number(cantidad) < 1 || !precioUnitario || Number(precioUnitario) < 0 || !fecha;
  const hasStep3Warning =
    (deliveryInfo.tipo_entrega === "envio" && !deliveryInfo.direccion_entrega.trim()) ||
    ((deliveryInfo.modalidad_pago === "credito" || deliveryInfo.modalidad_pago === "adelanto_saldo") && !deliveryInfo.fecha_pago_credito);

  const parsedCant = Number(cantidad) || 0;
  const parsedPrecio = Number(precioUnitario) || 0;
  const parsedFlete = deliveryInfo.tipo_entrega !== "entrega_local" ? (Number(deliveryInfo.costo_envio) || 0) : 0;
  const subtotalMueble = parsedCant * parsedPrecio;
  const totalGeneral = subtotalMueble + parsedFlete;

  const clienteSeleccionado = [...clientes, ...clientesLocales].find((c) => c.id === clienteVentaId);
  const nombreCliente = clienteSeleccionado?.nombre || "No seleccionado";

  const muebleSeleccionado = activeMuebles.find((m) => m.id === muebleCatalogoId);
  const nombreMueble = muebleSeleccionado ? `${muebleSeleccionado.codigo} — ${muebleSeleccionado.nombre}` : "No seleccionado";

  const choferSeleccionado = choferes.find((c) => c.id === deliveryInfo.chofer_id);
  const nombreChofer = choferSeleccionado ? `${choferSeleccionado.nombre}${choferSeleccionado.placa ? ` · ${choferSeleccionado.placa}` : ""}` : "Sin asignar";

  const zonaSeleccionada = zonas.find((z) => z.id === deliveryInfo.zona_entrega_id);
  const nombreZona = zonaSeleccionada ? `${zonaSeleccionada.nombre} (Tarifa: ${formatPen(zonaSeleccionada.tarifa)})` : "Sin zona asignada";

  return (
    <>
      <ContextActionPanel
        triggerLabel="Vender mueble"
        title="Nueva venta de mueble"
        description={
          <>
            Solo muebles que ya existen en el catálogo. Para dar de alta o editar precios, fotos y stock del catálogo
            usá{" "}
            <Link href="/inventario?tab=muebles" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">
              Inventario
            </Link>{" "}
            → pestaña <strong>Productos</strong> → sección <strong>Catálogo de muebles</strong>.
          </>
        }
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) handleSuccess();
        }}
      >
        <form
          key={formKey}
          ref={formRef}
          action={formAction}
          onChange={handleFormChange}
          className="space-y-4"
          noValidate
        >
          {/* Stepper del Wizard */}
          <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              {[
                { n: 1, label: "Cliente", hasWarning: hasStep1Warning },
                { n: 2, label: "Producto", hasWarning: hasStep2Warning },
                { n: 3, label: "Entrega", hasWarning: hasStep3Warning },
                { n: 4, label: "Confirmar", hasWarning: hasStep1Warning || hasStep2Warning || hasStep3Warning },
              ].map((item, index) => {
                const isCompleted = step > item.n;
                const isActive = step === item.n;
                return (
                  <div key={item.n} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center flex-1">
                      <button
                        type="button"
                        onClick={() => setStep(item.n)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                          item.hasWarning
                            ? "border-red-500 bg-red-500/10 text-red-500 shadow-md shadow-red-500/10"
                            : isCompleted
                            ? "bg-[var(--color-success)] border-[var(--color-success)] text-white"
                            : isActive
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                            : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {item.hasWarning ? "⚠️" : isCompleted ? "✓" : item.n}
                      </button>
                      <span
                        className={`mt-1.5 text-xs font-semibold tracking-wide transition-all duration-300 hidden sm:inline ${
                          item.hasWarning
                            ? "text-red-500 font-bold"
                            : isActive
                            ? "text-[var(--color-primary)] font-bold"
                            : isCompleted
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
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

          {/* ── PASO 1: COMPROBANTE Y CLIENTE ── */}
          <div style={{ display: step === 1 ? "block" : "none" }} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 1: Comprobante y Cliente</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Elige el tipo de comprobante de pago y selecciona o registra al cliente.
              </p>

              {/* Tipo de Comprobante */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Comprobante
                </p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "nota_venta", label: "Nota de venta" },
                      { value: "boleta", label: "Boleta" },
                      { value: "factura", label: "Factura" },
                    ] as { value: TipoComprobante; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTipoComprobante(opt.value)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${tipoComprobante === opt.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="tipo_comprobante" value={tipoComprobante} />
                
                {tipoComprobante === "factura" && (
                  <Field
                    name="ruc_factura"
                    label="RUC del cliente"
                    placeholder="20123456789"
                    className="mt-3"
                    value={rucFactura}
                    onChange={(e) => setRucFactura(e.target.value)}
                    required
                  />
                )}
                {tipoComprobante === "boleta" && (
                  <Field
                    name="dni_boleta"
                    label="DNI del cliente (opcional)"
                    placeholder="12345678"
                    className="mt-3"
                    value={dniBoleta}
                    onChange={(e) => setDniBoleta(e.target.value)}
                  />
                )}
              </div>

              {/* Cliente */}
              <div className="space-y-2">
                {modoCliente === "buscar" ? (
                  <>
                    <div className={hasStep1Warning ? "[&_input]:!border-red-500/80 [&_input]:focus:!border-red-500 [&_input]:focus:!ring-red-500 [&_input]:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}>
                      <ClienteCombobox
                        mockData={mockData}
                        clientes={clientesCombo}
                        value={clienteVentaId}
                        onChange={setClienteVentaId}
                        hiddenInputName="cliente_id"
                        label="Cliente"
                        placeholder="Buscar cliente…"
                        inputAriaLabel="Cliente para venta de mueble terminado"
                      />
                    </div>
                    {hasStep1Warning && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium animate-pulse">
                        ⚠️ Selecciona un cliente para completar este paso.
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
            </div>

            <div className="flex justify-end pt-4 mt-4">
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
              >
                Siguiente: Producto →
              </Button>
            </div>
          </div>

          {/* ── PASO 2: DATOS DEL PRODUCTO ── */}
          <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Datos del Producto</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Elige el mueble de catálogo, la fecha de venta, la cantidad y el precio acordado.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                  <span>Mueble del catálogo</span>
                  <div className={!muebleCatalogoId ? "[&_input]:!border-red-500/80 [&_input]:focus:!border-red-500 [&_input]:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}>
                    <Combobox
                      options={muebleOptions}
                      value={muebleCatalogoId}
                      onChange={setMuebleCatalogoId}
                      hiddenInputName="mueble_catalogo_id"
                      placeholder="Buscar en catálogo…"
                      inputAriaLabel="Mueble del catálogo"
                    />
                  </div>
                  {!muebleCatalogoId && (
                    <span className="text-[11px] text-red-500 font-medium">⚠️ Debe seleccionar un mueble.</span>
                  )}
                </label>

                <Field
                  name="fecha"
                  label="Fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />

                <Field
                  name="cantidad"
                  label="Cantidad"
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                  className={(!cantidad || Number(cantidad) < 1) ? "!border-red-500/80 focus:!border-red-500 focus:!ring-red-500" : ""}
                />

                <Field
                  name="precio_unitario"
                  label="Precio unitario regateado (S/)"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={precioUnitario}
                  onChange={(e) => setPrecioUnitario(e.target.value)}
                  className={(!precioUnitario || Number(precioUnitario) < 0) ? "!border-red-500/80 focus:!border-red-500 focus:!ring-red-500" : ""}
                />
              </div>

              {/* Muestra información de stock si está seleccionado */}
              {muebleCatalogoId && (
                (() => {
                  const selected = activeMuebles.find((m) => m.id === muebleCatalogoId);
                  if (!selected) return null;
                  const stock = Number(selected.stock_disponible) || 0;
                  const cantNum = Number(cantidad) || 0;
                  const isOverStock = cantNum > stock;
                  return (
                    <div className={`rounded-lg p-3 text-xs border ${
                      isOverStock 
                        ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
                        : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
                    }`}>
                      <p className="font-semibold">Información del Catálogo:</p>
                      <p>Precio sugerido de lista: <strong>{formatPen(Number(selected.precio_lista))}</strong></p>
                      <p>Stock disponible: <strong>{stock} unidades</strong> {isOverStock && <span className="font-black text-red-600 dark:text-red-400">(¡Estás vendiendo más unidades de las disponibles!)</span>}</p>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="flex justify-between pt-4 mt-4">
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
                onClick={() => setStep(3)}
                className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
              >
                Siguiente: Entrega y Pago →
              </Button>
            </div>
          </div>

          {/* ── PASO 3: ENTREGA Y PAGO ── */}
          <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
            {/* Sección Entrega */}
            <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  Paso 3: Datos de Entrega
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    // Saltar este paso: avanzar a Paso 4
                    setStep(4);
                  }}
                  className="text-xs font-bold text-[var(--color-accent)] border border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white px-3 py-1.5 rounded-lg transition-all"
                >
                  Saltar este paso ➔
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Asigna un chofer, el tipo de entrega (puesto en obra, local o envío) y los costos de envío correspondientes. Si no aplica flete o entrega especial, puedes saltar este paso.
              </p>
              <div className="mt-2">
                <EntregaFormFields mockData={mockData} choferes={choferes} zonas={zonas} />
              </div>
            </div>

            {/* Sección Pago */}
            <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)] shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Datos de Pago</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Define el método de pago y la modalidad (contado, adelanto, crédito).
              </p>
              <div className="mt-2">
                <PagoFormFields />
              </div>
            </div>

            {/* Botones de navegación */}
            <div className="flex justify-between pt-4 mt-4">
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
                onClick={() => setStep(4)}
                className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
              >
                Siguiente: Confirmar →
              </Button>
            </div>
          </div>

          {/* ── PASO 4: RESUMEN Y CONFIRMAR ── */}
          <div style={{ display: step === 4 ? "block" : "none" }} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 4: Resumen y Confirmar</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Por favor, verifica toda la información de la venta antes de proceder al registro definitivo.
              </p>

              {/* Caja de alerta condicional */}
              {(hasStep1Warning || hasStep2Warning || hasStep3Warning) ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400 space-y-1">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    ⚠️ Faltan datos obligatorios para registrar la venta
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-0.5 font-medium">
                    {hasStep1Warning && (
                      <li>Debes seleccionar un cliente en el Paso 1.</li>
                    )}
                    {hasStep2Warning && (
                      <li>Debes completar los datos del producto (mueble, cantidad válida & precio mayor o igual a 0) en el Paso 2.</li>
                    )}
                    {hasStep3Warning && (
                      <li>Debes rellenar los datos de envío requeridos (dirección de entrega) o de pago (fecha límite de crédito) en el Paso 3.</li>
                    )}
                  </ul>
                  <p className="text-[11px] text-red-500/80 pt-1">
                    Por favor, regresa a los pasos correspondientes usando el stepper o los botones de navegación para completar la información.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    ✓ Todo listo para registrar la venta
                  </p>
                  <p className="text-xs">Por favor, revisa el resumen a continuación antes de proceder a confirmar.</p>
                </div>
              )}

              {/* Grilla de Resumen */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Columna 1: Cliente y Producto */}
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] shadow-sm">
                  <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cliente & Comprobante</h4>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <strong>Comprobante:</strong> <span className="capitalize">{tipoComprobante.replace("_", " ")}</span>
                    </p>
                    {tipoComprobante === "factura" && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        · RUC: {rucFactura || <span className="text-red-500 font-semibold">Falta RUC</span>}
                      </p>
                    )}
                    {tipoComprobante === "boleta" && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        · DNI: {dniBoleta || "Opcional / No ingresado"}
                      </p>
                    )}
                    <p>
                      <strong>Cliente:</strong> {nombreCliente}
                    </p>
                    <p>
                      <strong>Fecha de Venta:</strong> {fecha}
                    </p>
                  </div>

                  <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider mt-4">Detalle del Producto</h4>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <strong>Mueble:</strong> {nombreMueble}
                    </p>
                    <p>
                      <strong>Cantidad:</strong> {cantidad} und.
                    </p>
                    <p>
                      <strong>Precio Unitario:</strong> {formatPen(parsedPrecio)}
                    </p>
                    <p className="border-t border-[var(--color-border)] pt-1.5 mt-1 font-semibold flex justify-between text-xs text-[var(--color-text-secondary)]">
                      <span>Subtotal Producto:</span>
                      <span>{formatPen(subtotalMueble)}</span>
                    </p>
                  </div>
                </div>

                {/* Columna 2: Entrega y Pago */}
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] shadow-sm">
                  <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Entrega (Flete)</h4>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <strong>Tipo de Entrega:</strong>{" "}
                      {deliveryInfo.tipo_entrega === "puesto_en_obra"
                        ? "Puesto en obra"
                        : deliveryInfo.tipo_entrega === "entrega_local"
                        ? "Entrega en local"
                        : "Envío a domicilio"}
                    </p>
                    {deliveryInfo.tipo_entrega !== "entrega_local" && (
                      <>
                        <p>
                          <strong>Chofer:</strong> {nombreChofer}
                        </p>
                        <p className="text-xs break-all">
                          <strong>Dirección:</strong> {deliveryInfo.direccion_entrega || <span className="text-red-500 font-semibold">Falta dirección</span>}
                        </p>
                        <p>
                          <strong>Zona:</strong> {nombreZona}
                        </p>
                        <p>
                          <strong>Costo Envío (Flete):</strong> {formatPen(parsedFlete)}
                        </p>
                      </>
                    )}
                  </div>

                  <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider mt-4">Condición de Pago</h4>
                  <div className="space-y-1.5 text-sm">
                    <p>
                      <strong>Método:</strong> <span className="capitalize">{deliveryInfo.metodo_pago}</span>
                    </p>
                    <p>
                      <strong>Modalidad:</strong> <span className="capitalize">{deliveryInfo.modalidad_pago.replace("_", " ")}</span>
                    </p>
                    {(deliveryInfo.modalidad_pago === "adelanto" || deliveryInfo.modalidad_pago === "adelanto_saldo") && (
                      <p>
                        <strong>Adelanto:</strong> {formatPen(Number(deliveryInfo.adelanto) || 0)}
                      </p>
                    )}
                    {deliveryInfo.modalidad_pago === "credito" && (
                      <p>
                        <strong>Crédito:</strong> {formatPen(Number(deliveryInfo.monto_credito) || 0)}
                      </p>
                    )}
                    {(deliveryInfo.modalidad_pago === "credito" || deliveryInfo.modalidad_pago === "adelanto_saldo") && (
                      <p>
                        <strong>Límite de pago:</strong> {deliveryInfo.fecha_pago_credito || <span className="text-red-500 font-semibold">Falta fecha</span>}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-[var(--color-border)] pt-3 mt-3 space-y-2">
                    <div className="flex justify-between text-base font-black text-[var(--color-primary)]">
                      <span>TOTAL A PAGAR:</span>
                      <span>{formatPen(totalGeneral)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-between pt-4 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(3)}
                className="px-6 py-2"
              >
                ← Anterior
              </Button>

              {/* Renderizado condicional del botón de submit */}
              {(hasStep1Warning || hasStep2Warning || hasStep3Warning) ? (
                <Button
                  type="button"
                  disabled
                  className="px-8 shadow-lg opacity-50 cursor-not-allowed"
                >
                  Confirmar venta ✓
                </Button>
              ) : (
                <PendingSubmitButton
                  idleText="Confirmar venta ✓"
                  className="px-8 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
                />
              )}
            </div>
          </div>
        </form>
      </ContextActionPanel>
    </>
  );
}
