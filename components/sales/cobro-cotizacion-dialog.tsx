"use client";

import { useEffect, useRef, useState } from "react";
import { consultarCobroCotizacionUnificada, registrarCobroCotizacionUnificada } from "@/app/actions";
import { parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";
import { medioSugeridoCotizacion, mediosCobroCotizacion, type MedioCobroCotizacion } from "@/lib/cotizacion-pago";
import { formatPen } from "@/lib/utils";

export function CobroCotizacionDialog({ cotizacion, onClose, onSuccess }: {
  cotizacion: { id: string; correlativo: string | null; total: number; detalle: unknown };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [medio, setMedio] = useState<MedioCobroCotizacion>(() =>
    medioSugeridoCotizacion(parseCotizacionDetalle(cotizacion.detalle).condiciones_pago));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState<{ total: number; cobrado: number; saldo: number } | null>(null);
  const [consultando, setConsultando] = useState(true);
  const submitting = useRef(false);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let vigente = true;
    setConsultando(true);
    setResumen(null);
    consultarCobroCotizacionUnificada(cotizacion.id).then(result => {
      if (!vigente) return;
      if (!result.ok) { setError(result.error); return; }
      if (result.total !== Number(cotizacion.total)) { setError("El total cambió. Actualiza la cotización antes de cobrar."); return; }
      setResumen(result);
      if (result.saldo <= 0) setError("Ya se registró el total en Caja. Revisa la cotización antes de continuar.");
    }).catch(() => { if (vigente) setError("No pudimos comprobar los cobros anteriores. Actualiza antes de continuar."); })
      .finally(() => { if (vigente) setConsultando(false); });
    return () => { vigente = false; };
  }, [cotizacion.id, cotizacion.total]);

  async function registrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || consultando || !resumen || resumen.saldo <= 0) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await registrarCobroCotizacionUnificada(cotizacion.id, { medio, totalEsperado: resumen.total, saldoEsperado: resumen.saldo });
      if (!result.ok) { setError(result.error); return; }
      onSuccess();
    } catch {
      setError("No pudimos confirmar el cobro. Actualiza la cotización antes de volver a intentarlo.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="cobro-cotizacion-titulo"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-primary)] shadow-xl backdrop:bg-black/50"
    >
      <form onSubmit={registrar} className="space-y-4">
        <div>
          <h2 id="cobro-cotizacion-titulo" className="text-lg font-bold">{resumen && resumen.cobrado > 0 ? "Confirmar saldo pendiente" : "Confirmar cobro total"}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Cotización {cotizacion.correlativo ?? cotizacion.id.slice(0, 8)}</p>
        </div>
        {consultando ? <p role="status">Comprobando cobros anteriores…</p> : resumen ? (
          <div>
            {resumen.cobrado > 0 ? <p className="text-sm text-[var(--color-text-secondary)]">Total {formatPen(resumen.total)} · Ya registrado {formatPen(resumen.cobrado)}</p> : null}
            <p className="text-2xl font-bold">{formatPen(resumen.saldo)}</p>
          </div>
        ) : null}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Confirma solo el dinero recibido ahora. Los adelantos ya registrados se descuentan del importe; las condiciones previstas de la propuesta no cuentan como dinero cobrado.
        </p>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Medio por el que recibiste el dinero</span>
          <select value={medio} onChange={(event) => setMedio(event.target.value as MedioCobroCotizacion)} disabled={busy}
            className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
            {Object.entries(mediosCobroCotizacion).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <p className="text-xs text-[var(--color-text-secondary)]">Se guardará únicamente el saldo pendiente y la cotización quedará cobrada.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={busy || consultando || !resumen || resumen.saldo <= 0} className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Registrando…" : "Registrar cobro"}</button>
        </div>
      </form>
    </dialog>
  );
}
