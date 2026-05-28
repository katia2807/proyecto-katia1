"use client";

import { useState, useTransition } from "react";
import { updateMargenGananciaPredeterminado, updateServicioEspecialTarifa } from "@/app/actions";
import { formatPen } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ServicioEspecialTarifaRow = {
  id: string;
  codigo: string;
  nombre: string;
  tarifa_por_pieza: number;
  activo: boolean;
};

type TarifasSettingsFormProps = {
  inicialTarifas: ServicioEspecialTarifaRow[];
  margenGananciaDefaultPct: number;
};

function parseDecimalInput(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function TarifasSettingsForm({ inicialTarifas, margenGananciaDefaultPct }: TarifasSettingsFormProps) {
  const [tarifas, setTarifas] = useState<ServicioEspecialTarifaRow[]>(inicialTarifas);
  const [margenInput, setMargenInput] = useState(String(margenGananciaDefaultPct));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState<string>("");
  const [editTarifa, setEditTarifa] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = (t: ServicioEspecialTarifaRow) => {
    setEditingId(t.id);
    setEditNombre(t.nombre);
    setEditTarifa(String(t.tarifa_por_pieza));
    setSuccess(null);
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditNombre("");
    setEditTarifa("");
  };

  const handleSave = async () => {
    if (!editingId) return;
    const cleanNombre = editNombre.trim();
    const cleanTarifa = parseDecimalInput(editTarifa);

    if (!cleanNombre) {
      setError("El nombre del servicio no puede estar vacío.");
      return;
    }

    if (isNaN(cleanTarifa) || cleanTarifa < 0) {
      setError("La tarifa debe ser un número válido mayor o igual a 0.");
      return;
    }

    setSuccess(null);
    setError(null);

    startTransition(async () => {
      try {
        await updateServicioEspecialTarifa(editingId, cleanNombre, cleanTarifa);
        
        // Update local state
        setTarifas((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? { ...t, nombre: cleanNombre, tarifa_por_pieza: cleanTarifa }
              : t
          )
        );
        
        setSuccess("Tarifa actualizada correctamente.");
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar la tarifa.");
      }
    });
  };

  const handleSaveMargen = async () => {
    const cleanMargen = parseDecimalInput(margenInput);
    if (isNaN(cleanMargen) || cleanMargen < 0) {
      setError("El margen debe ser un numero valido mayor o igual a 0.");
      return;
    }

    setSuccess(null);
    setError(null);

    startTransition(async () => {
      try {
        const res = await updateMargenGananciaPredeterminado(margenInput);
        setMargenInput(String(res.margenGananciaDefaultPct));
        setSuccess("Margen de ganancia actualizado correctamente.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar el margen.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Alert Notification Success/Error */}
      {success && (
        <div className="rounded-xl border border-[var(--color-success,#10b981)] bg-[color-mix(in_srgb,var(--color-success,#10b981)_10%,var(--color-surface,#ffffff))] px-4 py-2.5 text-sm text-[var(--color-success,#10b981)] flex items-center justify-between transition-all duration-200">
          <span>{success}</span>
          <button 
            type="button"
            onClick={() => setSuccess(null)} 
            className="text-xs font-bold opacity-60 hover:opacity-100 transition-opacity px-2"
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[var(--color-danger,#ef4444)] bg-[color-mix(in_srgb,var(--color-danger,#ef4444)_10%,var(--color-surface,#ffffff))] px-4 py-2.5 text-sm text-[var(--color-danger,#ef4444)] flex items-center justify-between transition-all duration-200">
          <span>{error}</span>
          <button 
            type="button"
            onClick={() => setError(null)} 
            className="text-xs font-bold opacity-60 hover:opacity-100 transition-opacity px-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--katia-border-subtle,#e2e8f0)] bg-[var(--katia-bg-elevated,#ffffff)] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div>
            <p className="text-sm font-bold text-[var(--katia-text-primary,#0f172a)]">
              Margen de ganancia predeterminado (%)
            </p>
            <p className="mt-1 text-xs text-[var(--katia-text-secondary,#64748b)]">
              Se usa para calcular el precio sugerido interno en cotizaciones. No aparece en boletas, facturas ni PDFs del cliente.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--katia-text-secondary,#64748b)]">
            Margen (%)
            <input
              type="text"
              inputMode="decimal"
              className="h-10 rounded-[var(--katia-radius-sm,6px)] border border-[var(--katia-border-subtle,#e2e8f0)] bg-[var(--katia-bg-base,#ffffff)] px-3 text-sm text-[var(--katia-text-primary,#0f172a)] outline-none focus:border-[var(--katia-primary,#3b82f6)] focus:ring-1 focus:ring-[var(--katia-primary,#3b82f6)]"
              value={margenInput}
              onChange={(e) => setMargenInput(e.target.value)}
              disabled={isPending}
              placeholder="30"
            />
          </label>
          <Button type="button" variant="primary" onClick={handleSaveMargen} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar margen"}
          </Button>
        </div>
      </div>

      {/* Grid of Special Services Rates */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tarifas.map((t) => {
          const isEditing = t.id === editingId;
          if (isEditing) {
            return (
              <div
                key={t.id}
                className="rounded-xl border-2 border-[var(--katia-primary,#3b82f6)] bg-[var(--katia-bg-elevated,#f8fafc)] p-4 flex flex-col gap-3 shadow-md shadow-[var(--katia-primary,#3b82f6)]/10 animate-fade-in"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] tracking-wider rounded bg-[var(--katia-primary,#3b82f6)] px-2 py-0.5 text-white font-bold uppercase">
                    {t.codigo}
                  </span>
                  <span className="text-xs text-[var(--katia-text-secondary,#64748b)] italic">
                    Editando...
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--katia-text-secondary,#64748b)] uppercase tracking-wider">
                    Nombre del servicio
                    <input
                      type="text"
                      className="h-9 rounded-[var(--katia-radius-sm,6px)] border border-[var(--katia-border-subtle,#e2e8f0)] bg-[var(--katia-bg-base,#ffffff)] px-2.5 text-xs text-[var(--katia-text-primary,#0f172a)] outline-none focus:border-[var(--katia-primary,#3b82f6)] focus:ring-1 focus:ring-[var(--katia-primary,#3b82f6)] w-full transition-all"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--katia-text-secondary,#64748b)] uppercase tracking-wider">
                    Tarifa por pieza (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9 rounded-[var(--katia-radius-sm,6px)] border border-[var(--katia-border-subtle,#e2e8f0)] bg-[var(--katia-bg-base,#ffffff)] px-2.5 text-xs text-[var(--katia-text-primary,#0f172a)] outline-none focus:border-[var(--katia-primary,#3b82f6)] focus:ring-1 focus:ring-[var(--katia-primary,#3b82f6)] w-full transition-all"
                      value={editTarifa}
                      onChange={(e) => setEditTarifa(e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </label>
                </div>

                <div className="flex gap-2 mt-2 pt-1 border-t border-[var(--katia-border-subtle,#e2e8f0)]">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    {isPending ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleCancel}
                    disabled={isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={t.id}
              className="group relative rounded-xl border border-[var(--katia-border-subtle,#e2e8f0)] bg-[var(--katia-bg-elevated,#ffffff)] p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-[var(--katia-primary,#3b82f6)]/50"
            >
              <div>
                <div className="flex justify-between items-start">
                  <p className="text-xs font-mono uppercase text-[var(--katia-text-secondary,#64748b)] font-bold tracking-wide">
                    {t.codigo}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs font-medium text-[var(--katia-primary,#3b82f6)] hover:underline flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleStartEdit(t)}
                  >
                    ✏️ <span className="hidden sm:inline">Editar</span>
                  </Button>
                </div>
                <p className="text-sm font-semibold text-[var(--katia-text-primary,#0f172a)] mt-2">
                  {t.nombre}
                </p>
              </div>
              <p className="text-base font-bold text-[var(--katia-primary,#3b82f6)] mt-3">
                {formatPen(t.tarifa_por_pieza)}{" "}
                <span className="text-[10px] font-normal text-[var(--katia-text-secondary,#64748b)] lowercase">
                  / pieza
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
