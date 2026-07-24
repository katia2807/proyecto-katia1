"use client";

import { submitCreateServicioAserraderoForm } from "@/app/actions";
import { CubicajeInput } from "@/components/sales/cubicaje-input";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { liteClientesToCompleto } from "@/lib/combobox-mocks";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { formatPen, parseDecimal, roundMoney } from "@/lib/utils";
import {
  calculateAserraderoAdjustment,
  calculateAserraderoCutSubtotal,
  calculateAserraderoTotal,
} from "@/lib/aserradero-print-model";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

type Cliente = {
  id: string;
  nombre: string;
  documento?: string | null;
  ruc?: string | null;
};

type ServicioEspecial = {
  id: string;
  codigo: string;
  nombre: string;
  tarifa_por_pieza: number;
};

type CubicajePieza = {
  id: number;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  descripcion: string;
  ptUnitarioReal?: number;
  ptTotalReal?: number;
  ptUnitarioComercial?: number;
  ptTotalComercial?: number;
};

type CubicajeChange = {
  totalPT: number;
  totalPC: number;
  precioPorPT: number;
  totalSoles: number;
  totalCantidad: number;
  precioUnitarioComercial: number;
  piezas: CubicajePieza[];
};

type AserraderoFormProps = {
  clientes: Cliente[];
  serviciosEspeciales: ServicioEspecial[];
  mockData?: boolean;
  onSuccess?: () => void;
};

type ConfiguredServiceState = Record<
  string,
  { activo: boolean; cantidad: string; tarifa: string }
>;

type CustomService = {
  id: string;
  nombre: string;
  cantidad: string;
  tarifa: string;
};

const DEFAULT_TARIFA_POR_PT = "0.50";

function isCompleteBlock(piece: CubicajePieza) {
  return piece.espesor > 0 && piece.ancho > 0 && piece.largo > 0;
}

function isEmptyBlock(piece: CubicajePieza) {
  return piece.espesor === 0 && piece.ancho === 0 && piece.largo === 0;
}

function displayPaymentValue(value: string) {
  return value.replaceAll("_", " ");
}

export function AserraderoForm({
  clientes,
  serviciosEspeciales,
  mockData = false,
  onSuccess,
}: AserraderoFormProps) {
  const { showToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);
  const [pieces, setPieces] = useState<CubicajePieza[]>([]);
  const [tarifaPorPT, setTarifaPorPT] = useState(0.5);
  const [cubicajeAttempted, setCubicajeAttempted] = useState(false);
  const [clientAttempted, setClientAttempted] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  const [configuredServices, setConfiguredServices] = useState<ConfiguredServiceState>(() =>
    Object.fromEntries(
      serviciosEspeciales.map((service) => [
        service.id,
        {
          activo: false,
          cantidad: "1",
          tarifa: String(service.tarifa_por_pieza),
        },
      ]),
    ),
  );
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [laborInput, setLaborInput] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [usarClienteProvisional, setUsarClienteProvisional] = useState(false);
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const [clientMode, setClientMode] = useState<"buscar" | "nuevo" | "temporal">("buscar");
  const [tipoComprobante, setTipoComprobante] = useState<"boleta" | "factura">("boleta");
  const [fecha, setFecha] = useState(today);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [modalidadPago, setModalidadPago] = useState("contado");
  const [adelanto, setAdelanto] = useState("");
  const [fechaPagoCredito, setFechaPagoCredito] = useState("");

  const [manualTotal, setManualTotal] = useState(false);
  const [manualTotalInput, setManualTotalInput] = useState("");
  const [state, formAction, isPending] = useActionState(
    submitCreateServicioAserraderoForm,
    mutationFormInitialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onSuccess?.();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [onSuccess, showToast, state]);

  const handleCubicajeChange = useCallback((data: CubicajeChange) => {
    setPieces(data.piezas);
    setTarifaPorPT(data.precioPorPT);
    if (data.piezas.some((piece) => !isEmptyBlock(piece) && !isCompleteBlock(piece))) {
      setCubicajeAttempted(true);
    }
  }, []);

  const completePieces = useMemo(() => pieces.filter(isCompleteBlock), [pieces]);
  const hasPartialRows = useMemo(
    () => pieces.some((piece) => !isEmptyBlock(piece) && !isCompleteBlock(piece)),
    [pieces],
  );
  const totalPTReal = useMemo(
    () => completePieces.reduce((total, piece) => total + (piece.ptTotalReal ?? 0), 0),
    [completePieces],
  );
  const totalPTComercial = useMemo(
    () => completePieces.reduce(
      (total, piece) =>
        total +
        (piece.ptTotalComercial ??
          Math.floor((piece.espesor * piece.ancho * piece.largo) / 12) * piece.cantidad),
      0,
    ),
    [completePieces],
  );
  const piesCubicos = totalPTReal / 12;
  const subtotalCorte = calculateAserraderoCutSubtotal(totalPTComercial, tarifaPorPT);

  const configuredServiceErrors = useMemo(
    () => Object.values(configuredServices).some(
      (service) =>
        service.activo &&
        (parseDecimal(service.cantidad) <= 0 || parseDecimal(service.tarifa) <= 0),
    ),
    [configuredServices],
  );
  const customServiceErrors = useMemo(
    () => customServices.some((service) => {
      const hasAnyValue =
        service.nombre.trim() !== "" || service.cantidad.trim() !== "" || service.tarifa.trim() !== "";
      return hasAnyValue && (
        service.nombre.trim() === "" ||
        parseDecimal(service.cantidad) <= 0 ||
        parseDecimal(service.tarifa) <= 0
      );
    }),
    [customServices],
  );
  const additionalServiceErrors = configuredServiceErrors || customServiceErrors;

  useEffect(() => {
    if (additionalServiceErrors) setExtrasOpen(true);
  }, [additionalServiceErrors]);

  const configuredSubtotal = useMemo(
    () => roundMoney(
      Object.values(configuredServices).reduce((total, service) => {
        if (!service.activo) return total;
        return total + roundMoney(parseDecimal(service.cantidad) * parseDecimal(service.tarifa));
      }, 0),
    ),
    [configuredServices],
  );
  const customSubtotal = useMemo(
    () => roundMoney(
      customServices.reduce(
        (total, service) =>
          total + roundMoney(parseDecimal(service.cantidad) * parseDecimal(service.tarifa)),
        0,
      ),
    ),
    [customServices],
  );
  const labor = roundMoney(parseDecimal(laborInput));
  const subtotalServicios = roundMoney(configuredSubtotal + customSubtotal);
  const totalCalculado = calculateAserraderoTotal(subtotalCorte, subtotalServicios, labor);
  const precioCobrado = manualTotal
    ? roundMoney(parseDecimal(manualTotalInput))
    : totalCalculado;
  const ajusteAlTotal = calculateAserraderoAdjustment(precioCobrado, totalCalculado);

  const addedServicesCount =
      Object.values(configuredServices).filter((service) => service.activo).length +
      customServices.filter((service) => service.nombre.trim() !== "").length +
    (labor > 0 ? 1 : 0);

  const allClients = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const selectedClient = useMemo(
    () => allClients.find((client) => client.id === clienteId),
    [allClients, clienteId],
  );
  const clientsForCombobox = useMemo(() => liteClientesToCompleto(allClients), [allClients]);
  const selectedRuc = selectedClient?.ruc?.trim() ?? "";
  const selectedDocument = selectedClient?.documento?.trim() ?? "";
  const hasValidRuc = selectedRuc.length === 11;
  const isClientValid =
    usarClienteProvisional ||
    (clienteId !== "" && (tipoComprobante !== "factura" || hasValidRuc));
  const isPaymentValid = modalidadPago !== "credito" || fechaPagoCredito !== "";
  const isStepOneValid =
    completePieces.length > 0 &&
    !hasPartialRows &&
    tarifaPorPT > 0 &&
    !additionalServiceErrors;
  const isStepTwoValid = isClientValid && isPaymentValid;

  const lineasServiciosPayload: Record<string, unknown>[] = (() => {
    const lines: Record<string, unknown>[] = [];
    for (const [id, configured] of Object.entries(configuredServices)) {
      if (!configured.activo) continue;
      const service = serviciosEspeciales.find((item) => item.id === id);
      const cantidad = parseDecimal(configured.cantidad);
      const tarifa = parseDecimal(configured.tarifa);
      lines.push({
        id,
        tipo: "servicio_especial",
        codigo: service?.codigo ?? id,
        nombre: service?.nombre ?? id,
        cantidad,
        tarifa,
        subtotal: roundMoney(cantidad * tarifa),
      });
    }

    for (const service of customServices) {
      if (service.nombre.trim() === "") continue;
      const cantidad = parseDecimal(service.cantidad);
      const tarifa = parseDecimal(service.tarifa);
      lines.push({
        id: service.id,
        tipo: "servicio_especial",
        codigo: "SERV-ESP",
        nombre: service.nombre.trim(),
        cantidad,
        tarifa,
        subtotal: roundMoney(cantidad * tarifa),
      });
    }

    if (labor > 0) {
      lines.push({
        id: "mano-de-obra-aserradero",
        tipo: "mano_de_obra",
        codigo: "MANO-OBRA",
        nombre: "Mano de obra adicional",
        cantidad: 1,
        tarifa: labor,
        subtotal: labor,
      });
    }

    if (internalNotes.trim() !== "") {
      lines.push({
        id: "nota-interna-aserradero",
        tipo: "nota_interna",
        codigo: "NOTA-INT",
        nombre: "Nota interna",
        cantidad: 1,
        tarifa: 0,
        subtotal: 0,
        observaciones: internalNotes.trim(),
      });
    }
    return lines;
  })();

  const lineasPayload = [
      ...completePieces.map((piece) => ({ ...piece, tipo: "bloque_cubicaje" })),
      ...lineasServiciosPayload,
      {
        tipo: "resumen_aserradero",
        schemaVersion: 1,
        precioPorPT: tarifaPorPT,
        totalPTComercial,
        tipoComprobante,
      },
  ];

  function navigateTo(nextStep: number) {
    if (nextStep > 1 && !isStepOneValid) {
      setCubicajeAttempted(true);
      if (additionalServiceErrors) setExtrasOpen(true);
      return;
    }
    if (nextStep > 2 && !isStepTwoValid) {
      setClientAttempted(true);
      return;
    }
    setStep(nextStep);
  }

  function selectClient(id: string) {
    setClienteId(id);
    if (id !== "") {
      setUsarClienteProvisional(false);
      setClientAttempted(false);
    }
  }

  function useProvisionalClient() {
    setClienteId("");
    setUsarClienteProvisional(true);
    setClientMode("buscar");
    setTipoComprobante("boleta");
    setClientAttempted(false);
  }

  function clientCreated(id: string, nombre: string, documento?: string, ruc?: string) {
    setClientesLocales((current) => [
      ...current,
      { id, nombre, documento: documento ?? null, ruc: ruc ?? null },
    ]);
    setClienteId(id);
    setUsarClienteProvisional(false);
    setClientMode("buscar");
    setClientAttempted(false);
  }

  const visibleServiceLines = lineasServiciosPayload.filter((line) => line.tipo !== "nota_interna");

  return (
    <form action={formAction} className="space-y-5">
      <nav className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {[
          { number: 1, label: "Cubicaje y tarifa" },
          { number: 2, label: "Cliente y pago" },
          { number: 3, label: "Confirmar y registrar" },
        ].map((item) => (
          <button
            key={item.number}
            type="button"
            onClick={() => navigateTo(item.number)}
            className={`px-2 py-3 text-center text-xs font-semibold transition-colors ${
              step === item.number
                ? "bg-[var(--color-primary)] text-white"
                : step > item.number
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "text-[var(--color-text-secondary)]"
            }`}
          >
            <span className="mr-1 font-black">{item.number}.</span> {item.label}
          </button>
        ))}
      </nav>

      <section hidden={step !== 1} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h3 className="text-lg font-bold">Paso 1: Cubicaje y tarifa</h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Registra cada bloque. El cobro usa PT comercial por la tarifa global.
          </p>
          <div className="mt-4">
            <CubicajeInput
              quantityMode="fixed-one"
              presentationMode="aserradero-compact"
              defaultPrecioPorPT={DEFAULT_TARIFA_POR_PT}
              onChange={handleCubicajeChange}
            />
          </div>
          {cubicajeAttempted && !isStepOneValid ? (
            <div className="mt-3 space-y-1 text-xs font-semibold text-red-500">
              {completePieces.length === 0 ? <p>Registra al menos un bloque válido.</p> : null}
              {hasPartialRows ? <p>Completa espesor, ancho y largo de cada fila iniciada.</p> : null}
              {tarifaPorPT <= 0 ? <p>La tarifa de corte por PT debe ser mayor que cero.</p> : null}
              {additionalServiceErrors ? <p>Completa o elimina los servicios adicionales incompletos.</p> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <button
            type="button"
            onClick={() => setExtrasOpen((open) => !open)}
            aria-expanded={extrasOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span>
              <strong>Agregar servicio adicional</strong>
              <span className="ml-2 text-xs text-[var(--color-text-secondary)]">Opcional</span>
            </span>
            <span className="text-xs font-semibold text-[var(--color-primary)]">
              {addedServicesCount > 0 ? `Servicios adicionales · ${addedServicesCount} agregados` : extrasOpen ? "Cerrar" : "Abrir"}
            </span>
          </button>

          {extrasOpen ? (
            <div className="space-y-4 border-t border-[var(--color-border)] p-4">
              {serviciosEspeciales.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-[var(--color-text-secondary)]">Servicios configurados</p>
                  {serviciosEspeciales.map((service) => {
                    const current = configuredServices[service.id] ?? {
                      activo: false,
                      cantidad: "1",
                      tarifa: String(service.tarifa_por_pieza),
                    };
                    return (
                      <div key={service.id} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-2 md:grid-cols-[1.5fr_110px_130px_110px] md:items-end">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={current.activo}
                            onChange={(event) => setConfiguredServices((all) => ({
                              ...all,
                              [service.id]: { ...current, activo: event.target.checked },
                            }))}
                          />
                          <span><strong>{service.codigo}</strong> · {service.nombre}</span>
                        </label>
                        <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                          Cantidad
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!current.activo}
                            value={current.cantidad}
                            onChange={(event) => setConfiguredServices((all) => ({
                              ...all,
                              [service.id]: { ...current, cantidad: event.target.value },
                            }))}
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-right"
                          />
                        </label>
                        <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                          Tarifa S/
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={!current.activo}
                            value={current.tarifa}
                            onChange={(event) => setConfiguredServices((all) => ({
                              ...all,
                              [service.id]: { ...current, tarifa: event.target.value },
                            }))}
                            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-right"
                          />
                        </label>
                        <output className="rounded-lg bg-[var(--color-bg)] px-2 py-2 text-right text-sm font-bold">
                          {formatPen(current.activo ? parseDecimal(current.cantidad) * parseDecimal(current.tarifa) : 0)}
                        </output>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase text-[var(--color-text-secondary)]">Servicios manuales</p>
                  <button
                    type="button"
                    onClick={() => setCustomServices((current) => [
                      ...current,
                      { id: `servicio-manual-${Date.now()}-${Math.random()}`, nombre: "", cantidad: "1", tarifa: "" },
                    ])}
                    className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    + Agregar servicio manual
                  </button>
                </div>
                {customServices.map((service) => (
                  <div key={service.id} className="grid gap-2 rounded-lg border border-[var(--color-border)] p-2 md:grid-cols-[1fr_100px_120px_auto]">
                    <input
                      aria-label="Nombre del servicio manual"
                      value={service.nombre}
                      onChange={(event) => setCustomServices((all) => all.map((item) => item.id === service.id ? { ...item, nombre: event.target.value } : item))}
                      placeholder="Descripción del servicio"
                      className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-sm"
                    />
                    <input
                      aria-label="Cantidad del servicio manual"
                      type="text"
                      inputMode="decimal"
                      value={service.cantidad}
                      onChange={(event) => setCustomServices((all) => all.map((item) => item.id === service.id ? { ...item, cantidad: event.target.value } : item))}
                      className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-right text-sm"
                    />
                    <input
                      aria-label="Tarifa del servicio manual"
                      type="text"
                      inputMode="decimal"
                      value={service.tarifa}
                      onChange={(event) => setCustomServices((all) => all.map((item) => item.id === service.id ? { ...item, tarifa: event.target.value } : item))}
                      placeholder="Tarifa S/"
                      className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-right text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomServices((all) => all.filter((item) => item.id !== service.id))}
                      className="px-2 text-xs font-semibold text-red-500"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Mano de obra adicional (S/)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={laborInput}
                    onChange={(event) => setLaborInput(event.target.value)}
                    placeholder="0.00"
                    className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Notas internas
                  <textarea
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    rows={2}
                    placeholder="No se imprimen en comprobantes"
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm md:grid-cols-[1fr_220px] md:items-end">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3"><span>Subtotal del corte</span><strong>{formatPen(subtotalCorte)}</strong></div>
            {subtotalServicios > 0 ? <div className="flex justify-between gap-3"><span>Servicios adicionales</span><strong>{formatPen(subtotalServicios)}</strong></div> : null}
            {labor > 0 ? <div className="flex justify-between gap-3"><span>Mano de obra adicional</span><strong>{formatPen(labor)}</strong></div> : null}
            <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-1"><span>Total calculado</span><strong>{formatPen(totalCalculado)}</strong></div>
            {ajusteAlTotal !== 0 ? <div className="flex justify-between gap-3 text-[var(--color-primary)]"><span>Ajuste al total</span><strong>{formatPen(ajusteAlTotal)}</strong></div> : null}
          </div>
          <label className="text-sm font-bold">
            Total a cobrar
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={manualTotal ? manualTotalInput : totalCalculado.toFixed(2)}
                onChange={(event) => {
                  setManualTotal(true);
                  setManualTotalInput(event.target.value);
                }}
                className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--color-primary)] bg-[var(--color-bg)] px-3 text-right text-lg font-black"
              />
              {manualTotal ? (
                <button
                  type="button"
                  onClick={() => {
                    setManualTotal(false);
                    setManualTotalInput("");
                  }}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Usar total calculado
                </button>
              ) : null}
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => navigateTo(2)}>Siguiente: Cliente y pago</Button>
        </div>
      </section>

      <section hidden={step !== 2} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h3 className="text-lg font-bold">Paso 2: Cliente y pago</h3>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-[var(--color-text-secondary)]">Comprobante *</p>
              <div className="flex gap-2">
                {(["boleta", "factura"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={usarClienteProvisional && type === "factura"}
                    onClick={() => setTipoComprobante(type)}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold capitalize ${
                      tipoComprobante === type
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                {clientMode === "buscar" ? (
                  <>
                    <ClienteCombobox
                      mockData={mockData}
                      clientes={clientsForCombobox}
                      value={clienteId}
                      onChange={selectClient}
                      hiddenInputName="cliente_id"
                      label="Cliente"
                      placeholder="Buscar cliente…"
                      inputAriaLabel="Cliente para servicio de aserradero"
                    />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button type="button" onClick={() => { setUsarClienteProvisional(false); setClientMode("nuevo"); }} className="font-semibold text-[var(--color-accent)] hover:underline">+ Nuevo cliente</button>
                      <button type="button" onClick={() => { setUsarClienteProvisional(false); setClientMode("temporal"); }} className="font-semibold text-[var(--color-text-secondary)] hover:underline">+ Cliente temporal</button>
                      <button type="button" onClick={useProvisionalClient} className="font-semibold text-[var(--color-primary)] hover:underline">+ Continuar sin datos</button>
                    </div>
                    {usarClienteProvisional ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
                        Se creará un cliente provisional y el comprobante será Boleta.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <NuevoClienteInlinePanel
                    temporal={clientMode === "temporal"}
                    onCreated={clientCreated}
                    onCancel={() => setClientMode("buscar")}
                  />
                )}
              </div>
              <Field name="fecha" type="date" label="Fecha *" value={fecha} onChange={(event) => setFecha(event.target.value)} required />
            </div>

            {clientAttempted && !isClientValid ? (
              <p className="text-xs font-semibold text-red-500">
                {tipoComprobante === "factura" && clienteId !== ""
                  ? "El cliente necesita un RUC válido de 11 dígitos para Factura."
                  : "Selecciona un cliente o usa un cliente provisional."}
              </p>
            ) : null}

            <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Método de pago
                <select value={metodoPago} onChange={(event) => setMetodoPago(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm">
                  <option value="efectivo">Efectivo</option>
                  <option value="yape">Yape</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="billetera_digital">Billetera digital</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Modalidad de pago
                <select value={modalidadPago} onChange={(event) => setModalidadPago(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm">
                  <option value="contado">Contado</option>
                  <option value="adelanto">Adelanto + saldo</option>
                  <option value="credito">Crédito</option>
                </select>
              </label>
              {modalidadPago === "adelanto" ? (
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Adelanto (S/)
                  <input type="text" inputMode="decimal" value={adelanto} onChange={(event) => setAdelanto(event.target.value)} placeholder="0.00" className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm" />
                </label>
              ) : null}
              {modalidadPago === "credito" ? (
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Fecha de crédito *
                  <input type="date" value={fechaPagoCredito} onChange={(event) => setFechaPagoCredito(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm" />
                </label>
              ) : null}
            </div>
            {clientAttempted && !isPaymentValid ? <p className="text-xs font-semibold text-red-500">Indica la fecha de pago del crédito.</p> : null}
          </div>
        </div>
        <div className="flex justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>Atrás</Button>
          <Button type="button" onClick={() => navigateTo(3)}>Siguiente: Confirmar</Button>
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h3 className="text-lg font-bold">Paso 3: Confirmar y registrar</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <h4 className="text-xs font-black uppercase text-[var(--color-text-secondary)]">Servicio</h4>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt>Bloques</dt><dd className="font-semibold">{completePieces.length}</dd>
                <dt>Total PT comercial</dt><dd className="font-semibold">{totalPTComercial} PT</dd>
                <dt>Tarifa por PT</dt><dd className="font-semibold">{formatPen(tarifaPorPT)}</dd>
                <dt>Subtotal del corte</dt><dd className="font-semibold">{formatPen(subtotalCorte)}</dd>
              </dl>
              <div className="border-t border-[var(--color-border)] pt-2 text-xs">
                {completePieces.slice(0, 3).map((piece, index) => (
                  <div key={piece.id} className="flex justify-between gap-3 py-0.5">
                    <span>#{index + 1} · {piece.espesor} × {piece.ancho} × {piece.largo}</span>
                    <strong>{piece.ptTotalComercial} PT</strong>
                  </div>
                ))}
                {completePieces.length > 3 ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer font-semibold text-[var(--color-accent)]">Ver los {completePieces.length} bloques</summary>
                    <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                      {completePieces.map((piece, index) => (
                        <div key={piece.id} className="flex justify-between gap-3">
                          <span>#{index + 1} · {piece.espesor} × {piece.ancho} × {piece.largo}</span>
                          <strong>{piece.ptTotalComercial} PT</strong>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              {visibleServiceLines.length > 0 ? (
                <div className="border-t border-[var(--color-border)] pt-2">
                  <h4 className="mb-1 text-xs font-black uppercase text-[var(--color-text-secondary)]">Servicios adicionales</h4>
                  {visibleServiceLines.map((line) => (
                    <div key={String(line.id)} className="flex justify-between gap-3 text-sm">
                      <span>{String(line.nombre)}</span><strong>{formatPen(typeof line.subtotal === "number" ? line.subtotal : 0)}</strong>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1 text-sm"><span>Subtotal</span><strong>{formatPen(subtotalServicios + labor)}</strong></div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <div>
                <h4 className="text-xs font-black uppercase text-[var(--color-text-secondary)]">Cliente</h4>
                <p className="mt-1 text-sm font-semibold">{usarClienteProvisional ? "Cliente pendiente" : selectedClient?.nombre}</p>
                {!usarClienteProvisional && (selectedRuc || selectedDocument) ? <p className="text-xs text-[var(--color-text-secondary)]">{selectedRuc || selectedDocument}</p> : null}
                <p className="text-xs capitalize text-[var(--color-text-secondary)]">{tipoComprobante} · {fecha}</p>
              </div>
              <div className="border-t border-[var(--color-border)] pt-2">
                <h4 className="text-xs font-black uppercase text-[var(--color-text-secondary)]">Pago</h4>
                <p className="mt-1 text-sm capitalize">{displayPaymentValue(modalidadPago)} · {displayPaymentValue(metodoPago)}</p>
                {modalidadPago === "adelanto" ? <p className="text-xs">Adelanto {formatPen(parseDecimal(adelanto))} · Saldo {formatPen(Math.max(0, precioCobrado - parseDecimal(adelanto)))}</p> : null}
                {modalidadPago === "credito" ? <p className="text-xs">Fecha de crédito: {fechaPagoCredito}</p> : null}
              </div>
              {ajusteAlTotal !== 0 ? <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-sm"><span>Ajuste al total</span><strong>{formatPen(ajusteAlTotal)}</strong></div> : null}
              <div className="border-t-2 border-[var(--color-primary)] pt-3 text-center">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-secondary)]">Total a cobrar</p>
                <p className="text-3xl font-black text-[var(--color-primary)]">{formatPen(precioCobrado)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setStep(2)}>Atrás</Button>
          <Button type="submit" size="lg" disabled={!isStepOneValid || !isStepTwoValid || isPending}>
            {isPending ? "Registrando…" : "Registrar servicio"}
          </Button>
        </div>
      </section>

      <input type="hidden" name="tipo_comprobante" value={tipoComprobante} />
      <input type="hidden" name="usarClienteProvisional" value={usarClienteProvisional ? "true" : "false"} />
      <input type="hidden" name="pies_cubicos" value={piesCubicos.toFixed(4)} />
      <input type="hidden" name="costo_cubicaje" value={subtotalCorte.toFixed(2)} />
      <input type="hidden" name="precio_cobrado" value={precioCobrado.toFixed(2)} />
      <input type="hidden" name="lineas_json" value={JSON.stringify(lineasPayload)} />
      <input type="hidden" name="metodo_pago" value={metodoPago} />
      <input type="hidden" name="modalidad_pago" value={modalidadPago} />
      <input type="hidden" name="adelanto" value={adelanto === "" ? "0" : adelanto} />
      {fechaPagoCredito ? <input type="hidden" name="fecha_pago_credito" value={fechaPagoCredito} /> : null}
    </form>
  );
}
