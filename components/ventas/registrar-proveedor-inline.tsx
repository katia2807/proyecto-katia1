"use client";

import { useState } from "react";
import { createProveedor, updateProveedor } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TRow, TD } from "@/components/ui/table";

export function ProveedorFormFields({
  tiposExistentes = [],
  defaultNombre = "",
  defaultDocumento = "",
  defaultTelefono = "",
  defaultTipoProveedor = "",
  prefixDatalist = "proveedor",
}: {
  tiposExistentes?: string[];
  defaultNombre?: string;
  defaultDocumento?: string;
  defaultTelefono?: string;
  defaultTipoProveedor?: string;
  prefixDatalist?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 w-full">
      <Field
        name="nombre"
        label="Nombre / Razón social *"
        placeholder="Proveedor de madera SAC"
        defaultValue={defaultNombre}
        required
        className="sm:col-span-2"
      />
      <Field
        name="documento"
        label="RUC / DNI"
        placeholder="20123456789"
        defaultValue={defaultDocumento}
      />
      <Field
        name="telefono"
        label="Teléfono"
        placeholder="999 000 000"
        defaultValue={defaultTelefono}
      />
      <div className="sm:col-span-2">
        <Field
          name="tipo_proveedor"
          label="Tipo de proveedor"
          placeholder="Madera, insumos, servicios, etc."
          defaultValue={defaultTipoProveedor}
          list={`${prefixDatalist}-tipos-list`}
        />
        <datalist id={`${prefixDatalist}-tipos-list`}>
          {tiposExistentes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

export function RegistrarProveedorInline({ tiposExistentes = [] }: { tiposExistentes?: string[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createProveedor(formData);
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
        + Registrar proveedor
      </button>
    );
  }

  return (
    <div className="w-full mt-4 rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Nuevo proveedor</p>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]">Cancelar</button>
      </div>
      <form action={handleSubmit} className="flex flex-col gap-3">
        <ProveedorFormFields tiposExistentes={tiposExistentes} prefixDatalist="inline-proveedor" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar proveedor"}</Button>
        </div>
      </form>
    </div>
  );
}

export function EditarProveedorInline({
  proveedor,
  tiposExistentes,
  onClose,
}: {
  proveedor: { id: string; nombre: string; documento: string | null; telefono: string | null; tipo_proveedor: string | null };
  tiposExistentes: string[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await updateProveedor(proveedor.id, formData);
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
      <ProveedorFormFields
        tiposExistentes={tiposExistentes}
        defaultNombre={proveedor.nombre}
        defaultDocumento={proveedor.documento ?? ""}
        defaultTelefono={proveedor.telefono ?? ""}
        defaultTipoProveedor={proveedor.tipo_proveedor ?? ""}
        prefixDatalist="edit-proveedor"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar Cambios"}</Button>
      </div>
    </form>
  );
}

export function ProveedorRowWrapper({
  p,
  tiposExistentes,
}: {
  p: { id: string; nombre: string; documento: string | null; telefono: string | null; tipo_proveedor: string | null; created_at: string };
  tiposExistentes: string[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TRow>
        <TD colSpan={6} className="p-4 bg-[var(--katia-surface-raised)]">
          <div className="text-sm font-bold text-[var(--katia-text-primary)] mb-2">Editar Proveedor: {p.nombre}</div>
          <EditarProveedorInline proveedor={p} tiposExistentes={tiposExistentes} onClose={() => setEditing(false)} />
        </TD>
      </TRow>
    );
  }

  return (
    <TRow>
      <TD className="font-medium">{p.nombre}</TD>
      <TD className="font-mono text-xs">{p.documento ?? "—"}</TD>
      <TD className="font-mono text-xs">{p.telefono ?? "—"}</TD>
      <TD className="text-sm">{p.tipo_proveedor ?? "—"}</TD>
      <TD className="text-xs text-[var(--katia-text-tertiary)]">
        {new Date(p.created_at).toLocaleDateString("es-PE")}
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
