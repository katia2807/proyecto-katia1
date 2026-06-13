"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type SheetResult = {
  sheet: string;
  inserted: number;
  skipped: number;
  errors: string[];
};

type ImportResponse =
  | { ok: true; results: SheetResult[] }
  | { ok: false; error: string };

export function ImportExcelPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("archivo", file);

    try {
      const res = await fetch("/admin/respaldo/import", { method: "POST", body: fd });
      const json: ImportResponse = await res.json();
      setResult(json);
    } catch {
      setResult({ ok: false, error: "Error de conexión. Inténtalo de nuevo." });
    } finally {
      setLoading(false);
    }
  }

  const totalInserted = result && result.ok ? result.results.reduce((s, r) => s + r.inserted, 0) : 0;
  const totalErrors   = result && result.ok ? result.results.reduce((s, r) => s + r.errors.length, 0) : 0;

  return (
    <Card>
      <CardTitle>Importar datos desde Excel</CardTitle>
      <CardDescription className="leading-relaxed">
        Sube el archivo <strong>.xlsx</strong> exportado desde Katia o un Excel externo de inventario. El sistema detecta
        hojas y columnas comunes como producto, descripción, cantidad, stock, costo o precio; si no hay categoría, la
        clasifica automáticamente como muebles, materiales, servicios o sin clasificar.
      </CardDescription>

      <div className="mt-3 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3 text-xs text-[var(--katia-text-secondary)]">
        <strong className="text-[var(--katia-text-primary)]">Formatos reconocidos:</strong>{" "}
        <span className="inline-flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {["👥 Compradores", "🚛 Choferes", "🏭 Proveedores", "📦 Inventario Katia", "Excel externo"].map((h) => (
            <span key={h} className="rounded bg-[var(--katia-primary)]/10 px-1.5 py-0.5 font-semibold text-[var(--katia-primary)]">
              {h}
            </span>
          ))}
        </span>
        <p className="mt-2">
          Para Excel externo, usa encabezados como Producto, Descripción, Cantidad, Stock, Costo, Precio, Categoría o
          Unidad. Si falta Código, Katia usa el nombre del producto.
        </p>
      </div>

      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--katia-text-secondary)]">Archivo Excel (.xlsx)</span>
          <input
            ref={inputRef}
            type="file"
            name="archivo"
            accept=".xlsx,.xls"
            required
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? null);
              setResult(null);
            }}
            className="block w-full text-sm text-[var(--katia-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--katia-primary)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white cursor-pointer"
          />
        </label>

        {fileName ? (
          <p className="text-xs text-[var(--katia-text-secondary)]">
            Archivo seleccionado: <span className="font-semibold text-[var(--katia-text-primary)]">{fileName}</span>
          </p>
        ) : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Importando..." : "↑ Importar archivo"}
        </Button>
      </form>

      {result ? (
        <div className="mt-4 space-y-3">
          {result.ok ? (
            <>
              <div
                className={`rounded-[var(--katia-radius-md)] border px-4 py-3 text-sm font-semibold ${
                  totalErrors > 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                }`}
              >
                {totalErrors > 0
                  ? `✓ Importación completada con ${totalErrors} error${totalErrors > 1 ? "es" : ""}. ${totalInserted} registros nuevos.`
                  : `✓ Importación exitosa. ${totalInserted} registros nuevos importados.`}
              </div>

              <div className="space-y-2">
                {result.results.map((r) => (
                  <div
                    key={r.sheet}
                    className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--katia-text-primary)]">{r.sheet}</span>
                      <div className="flex gap-3 text-xs">
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700">
                          +{r.inserted} nuevos
                        </span>
                        {r.skipped > 0 ? (
                          <span className="rounded bg-slate-500/15 px-2 py-0.5 font-semibold text-[var(--katia-text-secondary)]">
                            {r.skipped} omitidos
                          </span>
                        ) : null}
                        {r.errors.length > 0 ? (
                          <span className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-red-600">
                            {r.errors.length} errores
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {r.errors.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {r.errors.map((err, i) => (
                          <li key={i} className="text-xs text-red-500">
                            • {err}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-[var(--katia-radius-md)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
              ✕ {result.error}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
