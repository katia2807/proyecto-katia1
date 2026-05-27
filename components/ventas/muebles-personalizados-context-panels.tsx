"use client";

import { submitAprobarCotizacionForm, submitCreateCotizacionForm, createClienteCotizacionRapida } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { NotasSelector } from "@/components/sales/notas-selector";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { Field, SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { liteClientesToCompleto, MOCK_COTIZACIONES_APROBACION } from "@/lib/combobox-mocks";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FormActionProp = Exclude<ComponentProps<"form">["action"], string | undefined>;

type ClienteOpt = { id: string; nombre: string };
type AprobableOpt = { id: string; label: string };

type MueblesPersonalizadosContextPanelsProps = {
  clientes: ClienteOpt[];
  opcionesAprobacion: AprobableOpt[];
  mockData?: boolean;
};



function CrearCotizacionRapidaFormFields({
  clienteOptions,
  formAction,
}: {
  clienteOptions: { value: string; label: string }[];
  formAction: FormActionProp;
}) {
  const [localClientes, setLocalClientes] = useState(clienteOptions);
  const [clienteId, setClienteId] = useState("");
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newClientNombre, setNewClientNombre] = useState("");
  const [newClientTelefono, setNewClientTelefono] = useState("");
  const [newClientDocumento, setNewClientDocumento] = useState("");
  const [newClientRuc, setNewClientRuc] = useState("");
  const [newClientError, setNewClientError] = useState<string | null>(null);
  const [newClientLoading, setNewClientLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setLocalClientes(clienteOptions);
  }, [clienteOptions]);

  async function handleSaveNewClient(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!newClientNombre.trim()) {
      setNewClientError("El nombre del cliente es obligatorio.");
      return;
    }

    setNewClientLoading(true);
    setNewClientError(null);

    try {
      const res = await createClienteCotizacionRapida({
        nombre: newClientNombre.trim(),
        documento: newClientDocumento.trim(),
        telefono: newClientTelefono.trim(),
        direccion: "",
        tipoPersona: newClientRuc.trim() ? "empresa" : "natural",
      });

      if (res.ok) {
        showToast({
          variant: "success",
          message: `Cliente "${newClientNombre.trim()}" creado correctamente.`,
        });
        const newId = res.id;
        const newOption = { value: newId, label: newClientNombre.trim() };
        setLocalClientes((prev) => [newOption, ...prev]);
        setClienteId(newId);
        setShowNewCliente(false);
        // reset
        setNewClientNombre("");
        setNewClientTelefono("");
        setNewClientDocumento("");
        setNewClientRuc("");
      } else {
        setNewClientError(res.error || "No se pudo crear el cliente.");
      }
    } catch (err) {
      setNewClientError(err instanceof Error ? err.message : "Error inesperado al crear el cliente.");
    } finally {
      setNewClientLoading(false);
    }
  }

  const handleNewClientKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSaveNewClient(e as unknown as React.MouseEvent);
    }
  };

  return (
    <form action={formAction} className="grid gap-3">
      {/* Tipo oculto */}
      <input type="hidden" name="tipo" value="mueble_personalizado" />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm font-medium text-[var(--color-text-primary)]">
          <span>Cliente</span>
          {!showNewCliente && (
            <button
              type="button"
              onClick={() => setShowNewCliente(true)}
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline focus:outline-none"
            >
              + Crear cliente rápido
            </button>
          )}
        </div>
        {!showNewCliente ? (
          <Combobox
            options={localClientes}
            value={clienteId}
            onChange={setClienteId}
            hiddenInputName="cliente_id"
            placeholder="Buscar cliente…"
            inputAriaLabel="Cliente para la cotización"
          />
        ) : (
          <div 
            onKeyDown={handleNewClientKeyDown}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 shadow-inner transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Nuevo Cliente Rápido</span>
              <button
                type="button"
                onClick={() => {
                  setShowNewCliente(false);
                  setNewClientError(null);
                }}
                className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Cancelar
              </button>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Nombre / Razón Social *</label>
                <input
                  type="text"
                  value={newClientNombre}
                  onChange={(e) => setNewClientNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Teléfono (opcional)</label>
                <input
                  type="text"
                  value={newClientTelefono}
                  onChange={(e) => setNewClientTelefono(e.target.value)}
                  placeholder="Ej. 999000000"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Documento / DNI (opcional)</label>
                <input
                  type="text"
                  value={newClientDocumento}
                  onChange={(e) => setNewClientDocumento(e.target.value)}
                  placeholder="Ej. 12345678"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">RUC (opcional)</label>
                <input
                  type="text"
                  value={newClientRuc}
                  onChange={(e) => setNewClientRuc(e.target.value)}
                  placeholder="Ej. 20123456789"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            </div>

            {newClientError && (
              <p className="text-xs font-medium text-red-500">{newClientError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewCliente(false);
                  setNewClientError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={newClientLoading}
                onClick={handleSaveNewClient}
              >
                {newClientLoading ? "Guardando…" : "Guardar Cliente"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="fecha"
          label="Fecha"
          type="date"
          defaultValue={hoy}
          required
        />
        <Field
          name="especie_madera"
          label="Especie de madera"
          placeholder="Ej. Tornillo, Cedro, Caoba..."
          required
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField name="unidad_medida" label="Unidad de medida" defaultValue="cm">
          <option value="cm">Centímetros (cm)</option>
          <option value="in">Pulgadas (in)</option>
          <option value="otro">Otro</option>
        </SelectField>
        <SelectField name="estado" label="Estado" defaultValue="confirmada">
          <option value="confirmada">Confirmada (Lista para producción)</option>
          <option value="borrador">Borrador</option>
        </SelectField>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="precio_calculado"
          label="Precio Calculado (S/)"
          type="number"
          min="0"
          step="0.01"
          required
        />
        <Field
          name="precio_acordado"
          label="Precio Acordado (S/)"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </div>

      <Field
        name="motivo_ajuste"
        label="Motivo del ajuste (opcional)"
        placeholder="Ej. Descuento por volumen, cliente recurrente..."
      />

      <Button>Guardar Cotización</Button>
    </form>
  );
}

function AceptarCotizacionFormFields({
  cotizacionAprOptions,
  formAction,
}: {
  cotizacionAprOptions: { value: string; label: string }[];
  formAction: FormActionProp;
}) {
  const [cotizacionAprId, setCotizacionAprId] = useState("");

  return (
    <form action={formAction} className="grid gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
        <span>Cotización</span>
        <Combobox
          options={cotizacionAprOptions}
          value={cotizacionAprId}
          onChange={setCotizacionAprId}
          hiddenInputName="cotizacion_id"
          placeholder="Buscar cotización confirmada…"
          inputAriaLabel="Cotización para pasar a orden"
        />
      </label>
      <Field
        name="notas"
        label="Notas para el taller"
        placeholder="Acabado, materiales, fechas estimadas…"
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="adelanto"
          label="Adelanto cobrado (S/) — opcional"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
        />
        <SelectField name="metodo_adelanto" label="Medio del adelanto" defaultValue="efectivo">
          <option value="efectivo">Efectivo</option>
          <option value="yape">Yape</option>
          <option value="banco">Banco</option>
          <option value="otro">Otro</option>
        </SelectField>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Si dejas el adelanto en 0, solo se crea la orden. Si pones un monto &gt; 0, se asienta como
        ingreso en caja con la categoría
        <strong> adelanto_mueble_personalizado</strong>.
      </p>
      <Button>Aceptar cotización</Button>
    </form>
  );
}

export function MueblesPersonalizadosContextPanels({
  clientes,
  opcionesAprobacion,
  mockData = false,
}: MueblesPersonalizadosContextPanelsProps) {
  const { showToast } = useToast();
  const router = useRouter();

  const [openCreate, setOpenCreate] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [stateCreate, actionCreate] = useActionState(submitCreateCotizacionForm, mutationFormInitialState);

  const [openApr, setOpenApr] = useState(false);
  const [aprKey, setAprKey] = useState(0);
  const [stateApr, actionApr] = useActionState(submitAprobarCotizacionForm, mutationFormInitialState);

  useEffect(() => {
    if (stateCreate.success && stateCreate.message) {
      showToast({ variant: "success", message: stateCreate.message });
      setOpenCreate(false);
      setCreateKey((k) => k + 1);
      router.refresh();
      window.location.reload();
    } else if (stateCreate.error) {
      showToast({ variant: "error", message: stateCreate.error });
    }
  }, [stateCreate, showToast, router]);

  useEffect(() => {
    if (stateApr.success && stateApr.message) {
      showToast({ variant: "success", message: stateApr.message });
      setOpenApr(false);
      setAprKey((k) => k + 1);
      router.refresh();
      window.location.reload();
    } else if (stateApr.error) {
      showToast({ variant: "error", message: stateApr.error });
    }
  }, [stateApr, showToast, router]);

  const clienteOptions = useMemo(() => {
    return clientes.map((c) => ({
      value: c.id,
      label: c.nombre,
    }));
  }, [clientes]);

  const cotizacionAprOptions = useMemo(() => {
    const src = mockData ? MOCK_COTIZACIONES_APROBACION : opcionesAprobacion;
    return src.map((o) => ({
      value: o.id,
      label: o.label,
    }));
  }, [mockData, opcionesAprobacion]);

  return (
    <>
      {/* Botón principal: ir al cotizador inteligente */}
      <Link href="/cotizacion">
        <Button type="button" variant="primary">
          🧠 Cotizador inteligente
        </Button>
      </Link>

      {/* Botón 2: Formulario rápido de cotización simple */}
      <ContextActionPanel
        triggerLabel="Cotización rápida"
        title="Nueva cotización rápida"
        description="Registro simplificado: solo cliente, especie, precio calculado y acordado. Para cotizaciones con muebles diseñados externamente."
        open={openCreate}
        onOpenChange={(next) => {
          setOpenCreate(next);
          if (!next) setCreateKey((k) => k + 1);
        }}
      >
        <CrearCotizacionRapidaFormFields key={createKey} clienteOptions={clienteOptions} formAction={actionCreate} />
      </ContextActionPanel>

      {/* Botón 3: Aprobar cotización → crear orden de producción + registrar adelanto */}
      <ContextActionPanel
        triggerLabel="Aprobar → Orden + Adelanto"
        title="Aprobar cotización confirmada"
        description="En un solo paso: crea la orden de producción y registra el adelanto en caja. Solo aplica a cotizaciones con estado 'Confirmada'."
        open={openApr}
        onOpenChange={(next) => {
          setOpenApr(next);
          if (!next) setAprKey((k) => k + 1);
        }}
      >
        <AceptarCotizacionFormFields key={aprKey} cotizacionAprOptions={cotizacionAprOptions} formAction={actionApr} />
      </ContextActionPanel>
    </>
  );
}
