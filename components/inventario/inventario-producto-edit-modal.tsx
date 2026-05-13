"use client";

import { updateInventarioProducto } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef } from "react";

type ProductoEnriched = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  activo: boolean;
  stock_actual: number;
  stock_minimo: number;
  valor_stock: number;
  ultimo_movimiento: string | null;
};

type SaveState = { ok: boolean; err: string | null };

async function saveProductoAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  try {
    await updateInventarioProducto(formData);
    return { ok: true, err: null };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export function InventarioProductoEditModal({
  product,
  open,
  onOpenChange,
  canMutate,
  formatDate,
}: {
  product: ProductoEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canMutate: boolean;
  formatDate: (iso: string) => string;
}) {
  const router = useRouter();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(saveProductoAction, { ok: false, err: null });

  useEffect(() => {
    if (state.ok && product) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state.ok, product, onOpenChange, router]);

  const desc =
    product != null
      ? `Stock ${product.stock_actual} · Valorización S/ ${product.valor_stock.toFixed(2)} · Último mov. ${
          product.ultimo_movimiento ? formatDate(product.ultimo_movimiento) : "—"
        } · ${product.activo ? "Activo" : "Inactivo"}.`
      : "Seleccioná un producto en la lista.";

  return (
    <ContextActionPanel
      omitTrigger
      presentation="drawer"
      open={open && Boolean(product)}
      onOpenChange={onOpenChange}
      title="Editar producto"
      description={desc}
      triggerLabel="Editar producto"
    >
      {product ? (
        <>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{product.nombre}</p>
          <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
            Revisá código y stock mínimo antes de guardar; los cambios aplican al catálogo en vivo.
          </p>
          <form key={product.id} ref={formRef} id={formId} action={formAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={product.id} />
            <Field name="codigo" label="Código" defaultValue={product.codigo} required disabled={!canMutate} />
            <Field name="nombre" label="Nombre" defaultValue={product.nombre} required disabled={!canMutate} />
            <Field name="categoria" label="Categoría" defaultValue={product.categoria} required disabled={!canMutate} />
            <Field name="unidad" label="Unidad" defaultValue={product.unidad} required disabled={!canMutate} />
            <div className="sm:col-span-2">
              <Field
                name="stock_minimo"
                label="Stock mínimo"
                type="number"
                min="0"
                step="0.01"
                defaultValue={String(product.stock_minimo)}
                required
                disabled={!canMutate}
              />
            </div>
          </form>
          {state.err ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {state.err}
            </p>
          ) : null}
          {!canMutate ? (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Tu rol no puede guardar cambios en inventario.</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form={formId} variant="secondary" disabled={!canMutate || pending || !product}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </>
      ) : null}
    </ContextActionPanel>
  );
}
