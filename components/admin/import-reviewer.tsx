"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";

type ExtractedRow = {
  fecha: string;
  proveedor: string;
  categoria: string;
  monto: string;
  medio: "efectivo" | "banco" | "yape" | "otro";
  descripcion: string;
  ambiguo: boolean;
};

function detectMedio(text: string): ExtractedRow["medio"] {
  const q = text.toLowerCase();
  if (q.includes("efectivo")) return "efectivo";
  if (q.includes("transferencia") || q.includes("banco") || q.includes("bcp") || q.includes("bbva") || q.includes("interbank")) return "banco";
  if (q.includes("yape")) return "yape";
  return "otro";
}

function extractRows(raw: string): ExtractedRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 30).map((line) => {
    const monto = line.match(/(?:s\/\.?|soles)?\s*(\d+(?:[.,]\d{1,2})?)/i)?.[1]?.replace(",", ".") ?? "";
    const fecha = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/)?.[1] ?? "";
    const medio = detectMedio(line);
    return {
      fecha,
      proveedor: "",
      categoria: line.toLowerCase().includes("madera") ? "compra_madera" : "gasto_operativo",
      monto,
      medio,
      descripcion: line,
      ambiguo: !fecha || !monto || medio === "otro",
    };
  });
}

export function ImportReviewer() {
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const ambiguous = useMemo(() => rows.some((row) => row.ambiguo), [rows]);

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text().catch(() => "");
    setRows(extractRows(text || file.name));
    setReviewed(false);
  }

  return (
    <Card>
      <CardTitle>Lector inteligente con revision humana</CardTitle>
      <CardDescription>
        Sube PDF, Excel o documento. Primero se muestra una tabla editable; nada se guarda sin confirmar.
      </CardDescription>
      <div className="mt-4 space-y-4">
        <input
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)]"
        />
        {rows.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Proveedor</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Monto</th>
                    <th className="p-2 text-left">Medio</th>
                    <th className="p-2 text-left">Descripcion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.descripcion}-${index}`} className={row.ambiguo ? "bg-amber-500/15" : ""}>
                      <td className="p-2"><Field label="Fecha" value={row.fecha} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, fecha: e.target.value, ambiguo: false } : r))} /></td>
                      <td className="p-2"><Field label="Proveedor" value={row.proveedor} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, proveedor: e.target.value } : r))} /></td>
                      <td className="p-2"><Field label="Categoria" value={row.categoria} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, categoria: e.target.value } : r))} /></td>
                      <td className="p-2"><Field label="Monto" value={row.monto} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, monto: e.target.value, ambiguo: false } : r))} /></td>
                      <td className="p-2">
                        <SelectField label="Medio" value={row.medio} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, medio: e.target.value as ExtractedRow["medio"], ambiguo: false } : r))}>
                          <option value="efectivo">efectivo</option>
                          <option value="banco">banco</option>
                          <option value="yape">yape</option>
                          <option value="otro">otro</option>
                        </SelectField>
                      </td>
                      <td className="p-2"><Field label="Descripcion" value={row.descripcion} onChange={(e) => setRows((prev) => prev.map((r, i) => i === index ? { ...r, descripcion: e.target.value } : r))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setReviewed(true)}>
                Marcar revision completa
              </Button>
              <Button type="button" disabled={!reviewed || ambiguous}>
                Confirmar e importar
              </Button>
              {ambiguous ? <p className="text-sm text-amber-700 dark:text-amber-300">Corrige los campos amarillos antes de importar.</p> : null}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
