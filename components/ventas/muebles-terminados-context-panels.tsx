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
import Link from "next/link";
import { useMemo, useState, useActionState, useEffect } from "react";

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

  // Estado para crear cliente inline
  const [clientesLocales, setClientesLocales] = useState<ClienteOpt[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");

  const [state, formAction] = useActionState(submitCreateVentaMuebleTerminadoForm, mutationFormInitialState);

  function handleSuccess() {
    setOpen(false);
    setFormKey((k) => k + 1);
    setClienteVentaId("");
    setMuebleCatalogoId("");
    setTipoComprobante("nota_venta");
    setModoCliente("buscar");
  }

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      handleSuccess();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast]);

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
        <form key={formKey} action={formAction} className="space-y-4">

          {/* ── TIPO DE COMPROBANTE ── */}
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
            {/* Dato adicional según comprobante */}
            {tipoComprobante === "factura" && (
              <Field
                name="ruc_factura"
                label="RUC del cliente"
                placeholder="20123456789"
                className="mt-3"
                required
              />
            )}
            {tipoComprobante === "boleta" && (
              <Field
                name="dni_boleta"
                label="DNI del cliente (opcional)"
                placeholder="12345678"
                className="mt-3"
              />
            )}
          </div>

          {/* ── CLIENTE ── */}
          <div className="space-y-2">
            {modoCliente === "buscar" ? (
              <>
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

          {/* ── MUEBLE + FECHA + CANTIDAD + PRECIO ── */}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
              <span>Mueble del catálogo</span>
              <Combobox
                options={muebleOptions}
                value={muebleCatalogoId}
                onChange={setMuebleCatalogoId}
                hiddenInputName="mueble_catalogo_id"
                placeholder="Buscar en catálogo…"
                inputAriaLabel="Mueble del catálogo"
              />
            </label>
            <Field name="fecha" label="Fecha" type="date" defaultValue={fechaDefault} required />
            <Field
              name="cantidad"
              label="Cantidad"
              type="number"
              min="1"
              step="1"
              defaultValue="1"
              required
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
            />
          </div>

          {/* ── ENTREGA ── */}
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              Datos de entrega
            </p>
            <div className="mt-2">
              <EntregaFormFields mockData={mockData} choferes={choferes} zonas={zonas} />
            </div>
          </div>

          {/* ── PAGO ── */}
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              Datos de pago
            </p>
            <div className="mt-2">
              <PagoFormFields />
            </div>
          </div>

          <PendingSubmitButton idleText="Confirmar venta" />
        </form>
      </ContextActionPanel>
    </>
  );
}
