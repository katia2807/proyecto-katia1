"use client";

import { submitCreateVentaMuebleTerminadoForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { liteClientesToCompleto, MOCK_MUEBLES_CATALOGO_VENTA } from "@/lib/combobox-mocks";
import type { ZonaEntregaRow } from "@/lib/demo-store";
import { formatPen } from "@/lib/utils";
import { createCliente } from "@/app/actions";
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

/** Mini formulario para crear un cliente nuevo sin salir del panel. */
function NuevoClienteInlinePanel({
  onCreated,
  onCancel,
  temporal = false,
}: {
  onCreated: (id: string, nombre: string) => void;
  onCancel: () => void;
  temporal?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    // Marcar si es temporal para que la action lo guarde con la flag
    if (temporal) formData.set("es_temporal", "true");
    try {
      const result = await createCliente(formData);
      // createCliente debe retornar { id, nombre } — ajustar si tu action devuelve diferente
      if (result && typeof result === "object" && "id" in result) {
        onCreated(result.id as string, (result as { nombre?: string }).nombre ?? formData.get("nombre") as string);
      } else {
        onCancel();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {temporal ? "Cliente temporal" : "Nuevo cliente"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Cancelar
        </button>
      </div>
      {temporal && (
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Se guarda igual en la base de datos como cliente normal, pero marcado como &quot;temporal&quot; para diferenciarlo en reportes.
        </p>
      )}
      <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field
          name="nombre"
          label="Nombre *"
          placeholder={temporal ? "Ej: Cliente mostrador" : "Nombre completo o razón social"}
          required
          className="sm:col-span-2"
        />
        <Field name="documento" label="DNI / Documento" placeholder="12345678" />
        <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
        <Field name="ruc" label="RUC (opcional)" placeholder="20123456789" />
        <Field name="direccion" label="Dirección (opcional)" placeholder="Av. / Jr. / Referencia" />
        <SelectField name="tipo_persona" label="Tipo" defaultValue="">
          <option value="">Sin especificar</option>
          <option value="natural">Persona natural</option>
          <option value="empresa">Empresa</option>
        </SelectField>
        {error ? (
          <p className="sm:col-span-2 text-xs text-red-500">{error}</p>
        ) : null}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Guardando…" : "Guardar cliente"}
          </Button>
        </div>
      </form>
    </div>
  );
}

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

  const muebleOptions = useMemo(() => {
    const src: MuebleOpt[] = (mockData && muebles.length === 0)
      ? [...MOCK_MUEBLES_CATALOGO_VENTA].map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        precio_lista: m.precio_lista,
        stock_disponible: m.stock_disponible,
      }))
      : muebles;
    return src.map((m) => ({
      value: m.id,
      label: `${m.codigo} — ${m.nombre}`,
      sublabel: `${formatPen(Number(m.precio_lista))}${Number(m.stock_disponible) <= 0 ? " · sin stock" : ""
        }`,
    }));
  }, [mockData, muebles]);

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
