"use client";

import { useState } from "react";
import { createChofer, updateChofer } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TRow, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function RegistrarChoferInline({ tiposExistentes = [] }: { tiposExistentes?: string[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createChofer(formData);
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + Registrar chofer
      </button>
    );
  }

  return (
    <div className="w-full mt-4 rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Nuevo chofer</p>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]">Cancelar</button>
      </div>
      <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field name="nombre" label="Nombre *" placeholder="Nombre completo" required className="sm:col-span-2" />
        <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
        <Field name="placa" label="Placa del vehículo" placeholder="ABC-123" />
        <div className="sm:col-span-2">
          <Field name="tipo_vehiculo" label="Tipo de vehículo" placeholder="Camioneta, moto, etc." list="chofer-tipos-list" />
          <datalist id="chofer-tipos-list">
            {tiposExistentes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        {error && <p className="sm:col-span-2 text-xs text-red-500">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar chofer"}</Button>
        </div>
      </form>
    </div>
  );
}

export function EditarChoferInline({
  chofer,
  tiposExistentes,
  onClose,
}: {
  chofer: { id: string; nombre: string; telefono: string | null; placa: string | null; tipo_vehiculo: string | null; activo: boolean };
  tiposExistentes: string[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await updateChofer(chofer.id, formData);
      onClose();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 p-3 bg-[var(--katia-surface-raised)] rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] mt-2 w-full">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="nombre" label="Nombre *" defaultValue={chofer.nombre} required />
        <Field name="telefono" label="Teléfono" defaultValue={chofer.telefono ?? ""} />
        <Field name="placa" label="Placa" defaultValue={chofer.placa ?? ""} />
        <div>
          <Field name="tipo_vehiculo" label="Tipo de vehículo" defaultValue={chofer.tipo_vehiculo ?? ""} list="edit-chofer-tipos-list" />
          <datalist id="edit-chofer-tipos-list">
            {tiposExistentes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--katia-text-primary)] sm:col-span-2 cursor-pointer mt-1">
          <input type="checkbox" name="activo" defaultChecked={chofer.activo} className="rounded accent-[var(--katia-primary)] w-4 h-4" />
          Chofer Activo
        </label>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar Cambios"}</Button>
      </div>
    </form>
  );
}

export function ChoferRowWrapper({
  c,
  tiposExistentes,
}: {
  c: { id: string; nombre: string; telefono: string | null; placa: string | null; tipo_vehiculo: string | null; activo: boolean };
  tiposExistentes: string[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TRow>
        <TD colSpan={6} className="p-4 bg-[var(--katia-surface-raised)]">
          <div className="text-sm font-bold text-[var(--katia-text-primary)] mb-2">Editar Chofer: {c.nombre}</div>
          <EditarChoferInline chofer={c} tiposExistentes={tiposExistentes} onClose={() => setEditing(false)} />
        </TD>
      </TRow>
    );
  }

  return (
    <TRow>
      <TD className="font-medium">{c.nombre}</TD>
      <TD className="font-mono text-xs">{c.telefono ?? "—"}</TD>
      <TD className="font-mono text-xs font-semibold uppercase">{c.placa ?? "—"}</TD>
      <TD className="text-sm">{c.tipo_vehiculo ?? "—"}</TD>
      <TD>
        <span className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          c.activo
            ? "bg-[var(--katia-success)]/15 text-[var(--katia-success)]"
            : "bg-[var(--katia-text-tertiary)]/10 text-[var(--katia-text-tertiary)]",
        )}>
          {c.activo ? "Activo" : "Inactivo"}
        </span>
      </TD>
      <TD>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-[var(--katia-primary)] hover:underline"
        >
          Editar
        </button>
      </TD>
    </TRow>
  );
}
