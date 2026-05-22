"use client";

import {
  deleteMuebleCatalogo,
  submitCreateMuebleCatalogoForm,
  submitToggleMuebleCatalogoForm,
  submitUpdateMuebleCatalogoForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { formatPen } from "@/lib/utils";
import { IconCamera, IconChevronDown, IconChevronUp, IconPhoto } from "@tabler/icons-react";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

type MuebleRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_lista: number | string;
  foto_url: string | null;
  activo: boolean;
};

type Props = {
  muebles: MuebleRow[];
  canMutate: boolean;
};

function MuebleEditableRow({ row, canMutate }: { row: MuebleRow; canMutate: boolean }) {
  const { showToast } = useToast();
  const [stateEdit, actionEdit] = useActionState(submitUpdateMuebleCatalogoForm, mutationFormInitialState);
  const [stateToggle, actionToggle] = useActionState(submitToggleMuebleCatalogoForm, mutationFormInitialState);

  const [confirmGuardar, setConfirmGuardar] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Control del formulario expandido
  const [formExpanded, setFormExpanded] = useState(false);

  // Preview local de la foto (puede cambiar antes de guardar)
  const [fotoPreview, setFotoPreview] = useState<string>(row.foto_url ?? "");

  const editFormRef = useRef<HTMLFormElement>(null);
  const toggleFormRef = useRef<HTMLFormElement>(null);
  const editConfirmedRef = useRef(false);
  const toggleConfirmedRef = useRef(false);

  useEffect(() => {
    if (stateEdit.success && stateEdit.message) {
      showToast({ variant: "success", message: stateEdit.message });
      setFormExpanded(false);
    } else if (stateEdit.error) {
      showToast({ variant: "error", message: stateEdit.error });
    }
  }, [stateEdit, showToast]);

  useEffect(() => {
    if (stateToggle.success && stateToggle.message) {
      showToast({ variant: "success", message: stateToggle.message });
    } else if (stateToggle.error) {
      showToast({ variant: "error", message: stateToggle.error });
    }
  }, [stateToggle, showToast]);

  async function handleEliminar() {
    setDeleting(true);
    const res = await deleteMuebleCatalogo(row.id);
    setDeleting(false);
    if (!res.ok) {
      showToast({ variant: "error", message: res.error });
      return false;
    }
    showToast({ variant: "success", message: "Mueble eliminado del catálogo." });
  }

  const esImagen = fotoPreview && /\.(png|jpe?g|webp|gif)$/i.test(fotoPreview);

  return (
    <Card id={`mueble-catalogo-${row.id}`} className="overflow-hidden p-0">
      {/* ── Imagen principal ── */}
      <div className="relative w-full bg-[var(--color-primary-soft)]" style={{ aspectRatio: "16/9" }}>
        {esImagen ? (
          <Image
            src={fotoPreview}
            alt={row.nombre}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)]">
            <IconPhoto className="size-10 opacity-30" aria-hidden />
            <span className="text-xs opacity-50">Sin foto</span>
          </div>
        )}

        {/* Badge activo/inactivo */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow ${
            row.activo ? "bg-emerald-500 text-white" : "bg-slate-600 text-slate-200"
          }`}
        >
          {row.activo ? "Activo" : "Inactivo"}
        </span>

        {/* Botón de editar foto rápido */}
        {canMutate && (
          <button
            type="button"
            onClick={() => setFormExpanded((v) => !v)}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/75"
            title={formExpanded ? "Cerrar edición" : "Editar / cambiar foto"}
          >
            <IconCamera className="size-3.5" aria-hidden />
            {esImagen ? "Cambiar foto" : "Agregar foto"}
          </button>
        )}
      </div>

      {/* ── Info del mueble ── */}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {row.codigo}
            </p>
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{row.nombre}</p>
            {row.descripcion ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{row.descripcion}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-sm font-bold text-[var(--color-text-primary)]">
            {formatPen(Number(row.precio_lista))}
          </p>
        </div>

        {/* Botón expandir formulario */}
        {canMutate && (
          <button
            type="button"
            onClick={() => setFormExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
          >
            {formExpanded ? (
              <>
                <IconChevronUp className="size-3.5" aria-hidden /> Cerrar edición
              </>
            ) : (
              <>
                <IconChevronDown className="size-3.5" aria-hidden /> Editar datos / foto
              </>
            )}
          </button>
        )}

        {/* ── Formulario colapsable ── */}
        {formExpanded && (
          <form
            ref={editFormRef}
            action={actionEdit}
            className="grid gap-3 border-t border-[var(--color-border)] pt-3"
            onSubmit={(e) => {
              if (editConfirmedRef.current) {
                editConfirmedRef.current = false;
                return;
              }
              e.preventDefault();
              setConfirmGuardar(true);
            }}
          >
            <input type="hidden" name="id" value={row.id} />
            <Field
              name="precio_lista"
              label="Precio sugerido (S/)"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={String(row.precio_lista)}
            />
            <Field
              name="descripcion"
              label="Descripción"
              placeholder="Material, medidas, acabado..."
              defaultValue={row.descripcion ?? ""}
            />

            {/* FotoUpload extendido con callback de preview */}
            <FotoUploadWithPreview
              bucket="muebles"
              name="foto_url"
              label="Foto del mueble"
              defaultUrl={row.foto_url ?? ""}
              onUrlChange={setFotoPreview}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" disabled={!canMutate}>
                Guardar cambios
              </Button>
              <button
                type="button"
                onClick={() => setFormExpanded(false)}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-soft)]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* ── Activar / Desactivar / Eliminar ── */}
        <form
          ref={toggleFormRef}
          action={actionToggle}
          onSubmit={(e) => {
            if (toggleConfirmedRef.current) {
              toggleConfirmedRef.current = false;
              return;
            }
            e.preventDefault();
            setConfirmToggle(true);
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="activo" value={row.activo ? "false" : "true"} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant={row.activo ? "danger" : "secondary"} disabled={!canMutate}>
              {row.activo ? "Desactivar" : "Activar"}
            </Button>
            {canMutate ? (
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={() => setConfirmEliminar(true)}
              >
                Eliminar
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {/* Dialogs de confirmación */}
      <ConfirmDialog
        open={confirmGuardar}
        onOpenChange={setConfirmGuardar}
        title="¿Guardar cambios?"
        tone="neutral"
        confirmVariant="primary"
        confirmLabel="Guardar"
        onConfirm={() => {
          setConfirmGuardar(false);
          editConfirmedRef.current = true;
          editFormRef.current?.requestSubmit();
        }}
      >
        <p>Se actualizará el precio, descripción o foto de <strong>{row.nombre}</strong>.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={row.activo ? "¿Desactivar este mueble?" : "¿Activar este mueble?"}
        tone={row.activo ? "caution" : "neutral"}
        confirmVariant={row.activo ? "danger" : "primary"}
        confirmLabel={row.activo ? "Desactivar" : "Activar"}
        onConfirm={() => {
          setConfirmToggle(false);
          toggleConfirmedRef.current = true;
          toggleFormRef.current?.requestSubmit();
        }}
      >
        {row.activo ? (
          <p>
            <strong>{row.nombre}</strong> dejará de mostrarse en cotizaciones y ventas de mueble terminado.
            Podés volver a activarlo cuando quieras.
          </p>
        ) : (
          <p>
            <strong>{row.nombre}</strong> volverá a estar disponible en cotizaciones y ventas.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmEliminar}
        onOpenChange={setConfirmEliminar}
        title="¿Eliminar este mueble?"
        tone="caution"
        confirmVariant="danger"
        confirmLabel="Eliminar permanentemente"
        onConfirm={handleEliminar}
      >
        <p>
          Se eliminará <strong>{row.nombre}</strong> ({row.codigo}) del catálogo de forma permanente.
          Esta acción no se puede deshacer.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

// ── FotoUpload extendido con callback onUrlChange ─────────────────────────────
function FotoUploadWithPreview({
  bucket,
  name,
  label,
  defaultUrl = "",
  onUrlChange,
}: {
  bucket: "muebles" | "caja" | "compras" | "comprobantes";
  name: string;
  label: string;
  defaultUrl?: string;
  onUrlChange?: (url: string) => void;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [estado, setEstado] = useState<"idle" | "subiendo" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string>("");

  useEffect(() => {
    setUrl(defaultUrl);
  }, [defaultUrl]);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEstado("subiendo");
    setMensaje("");
    try {
      const fd = new FormData();
      fd.append("bucket", bucket);
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      setUrl(json.url);
      onUrlChange?.(json.url);
      setEstado("ok");
      setMensaje("Foto guardada.");
    } catch (err) {
      setEstado("error");
      setMensaje(
        err instanceof Error && err.message
          ? "No se pudo subir la imagen. Intenta de nuevo."
          : "Ocurrió un problema, intenta de nuevo.",
      );
    }
  }

  const esImagen = url && /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <div className="space-y-2">
      <label className="space-y-1">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)] cursor-pointer"
        />
      </label>
      <input type="hidden" name={name} value={url} />
      {estado === "subiendo" ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Subiendo imagen…</p>
      ) : null}
      {estado === "error" ? (
        <p className="text-xs text-red-400">{mensaje}</p>
      ) : null}
      {estado === "ok" ? (
        <p className="text-xs text-emerald-400">{mensaje}</p>
      ) : null}
      {url && esImagen ? (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Image
            src={url}
            alt="Preview"
            width={400}
            height={225}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
            unoptimized
          />
          <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--color-text-secondary)]">
            <span>{estado === "ok" ? "✅ Nueva foto lista para guardar" : "Foto actual"}</span>
            <a href={url} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] underline">
              Abrir
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MueblesCatalogoSection({ muebles, canMutate }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmCrear, setConfirmCrear] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  const createConfirmedRef = useRef(false);
  const [stateCreate, actionCreate] = useActionState(submitCreateMuebleCatalogoForm, mutationFormInitialState);

  useEffect(() => {
    if (stateCreate.success && stateCreate.message) {
      showToast({ variant: "success", message: stateCreate.message });
      setOpen(false);
      setFormKey((k) => k + 1);
    } else if (stateCreate.error) {
      showToast({ variant: "error", message: stateCreate.error });
    }
  }, [stateCreate, showToast]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Catalogo de muebles</CardTitle>
          <CardDescription>
            Aquí se da de alta y se mantiene el catálogo de muebles terminados. Ventas y cotizaciones solo eligen ítems
            que existan acá (no hay alta de catálogo en el módulo de ventas).
          </CardDescription>
        </div>

      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {muebles.map((row) => (
          <MuebleEditableRow key={row.id} row={row} canMutate={canMutate} />
        ))}
        {muebles.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            Aun no hay muebles en el catalogo.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
