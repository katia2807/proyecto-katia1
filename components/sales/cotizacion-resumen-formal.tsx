import { EmpresaLogoMark } from "@/components/sales/empresa-logo-mark";
import { cn, formatDate, formatPen } from "@/lib/utils";
import type { LineaFormal } from "@/lib/cotizacion-unificada-lineas";
import type { EmpresaConfig } from "@/lib/company-config";

export type CotizacionResumenFormalProps = {
  correlativoLabel: string;
  fechaISO: string;
  nombreCliente: string;
  tipoCliente: "natural" | "empresa";
  documentoCliente: string | null;
  lineas: LineaFormal[];
  notasGenerales: string;
  total: number;
  empresa: EmpresaConfig;
  /** Vista compacta dentro del asistente (sin sombra extra). */
  embedded?: boolean;
};

export function CotizacionResumenFormal({
  correlativoLabel,
  fechaISO,
  nombreCliente,
  tipoCliente,
  documentoCliente,
  lineas,
  notasGenerales,
  total,
  empresa,
  embedded = false,
}: CotizacionResumenFormalProps) {
  const docLabel = tipoCliente === "empresa" ? "RUC" : "DNI";
  const notasLineas = notasGenerales
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const wrapClass = cn(
    "doc-formal",
    embedded
      ? "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text-primary)] shadow-sm sm:p-6"
      : "text-[#111]",
  );

  return (
    <div className={wrapClass}>
      <style>{`
        .doc-formal {
          --doc-border: ${embedded ? "var(--color-border)" : "#ccc"};
          --doc-head-bg: ${embedded ? "var(--color-primary-soft)" : "#f4f4f5"};
          --doc-muted: ${embedded ? "var(--color-text-secondary)" : "#666"};
          --doc-muted-strong: ${embedded ? "var(--color-text-secondary)" : "#444"};
          --doc-note: ${embedded ? "var(--color-text-primary)" : "#333"};
        }
        .doc-formal table { width: 100%; border-collapse: collapse; }
        .doc-formal th, .doc-formal td {
          border: 1px solid var(--doc-border);
          padding: 9px 12px;
          font-size: 12px;
          vertical-align: top;
        }
        .doc-formal th {
          background: var(--doc-head-bg);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.06em;
        }
        .doc-formal .titulo-item {
          font-weight: 800;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .doc-formal ul { margin: 4px 0 0 16px; padding: 0; }
        .doc-formal li { margin: 2px 0; font-size: 11px; color: var(--doc-note); }
        .doc-formal .total-row td { padding: 12px; font-size: 15px; background: ${embedded ? "var(--color-primary-soft)" : "#f9f9f9"}; }
      `}</style>

      {/* ── Encabezado empresa ── */}
      <header className={cn("mb-5 flex flex-wrap items-start gap-4 pb-4", embedded ? "border-b border-[var(--color-border)]" : "border-b-2 border-[#111]")}>
        <EmpresaLogoMark empresa={empresa} embedded={embedded} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-lg font-extrabold leading-tight tracking-tight">{empresa.nombre}</p>
          <p className={cn("mt-0.5 text-xs", embedded ? "text-[var(--color-text-secondary)]" : "text-[#444]")}>
            Carpintería &amp; Aserradero · RUC {empresa.ruc}
          </p>
          <p className={cn("mt-0.5 text-[11px]", embedded ? "text-[var(--color-text-secondary)]" : "text-[#666]")}>
            {empresa.direccion} · Tel. {empresa.telefono}
          </p>
        </div>
      </header>

      {/* ── Título del documento ── */}
      <h2 className="mb-5 text-center text-base font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">
        Cotización {correlativoLabel}
      </h2>

      {/* ── Datos del cliente ── */}
      <div className="mb-5 rounded-lg border border-[var(--doc-border)] p-3 text-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--doc-muted)" }}>
          Datos del cliente
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          <p>
            <span className="font-semibold">Nombres: </span>
            {nombreCliente || "—"}
          </p>
          <p>
            <span className="font-semibold">Fecha: </span>
            {formatDate(fechaISO)}
          </p>
          {documentoCliente ? (
            <p>
              <span className="font-semibold">{docLabel}: </span>
              {documentoCliente}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Tabla de ítems ── */}
      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--doc-muted)" }}>
        Descripción
      </p>

      <table className="mb-1 w-full">
        <thead>
          <tr>
            <th className="w-10 text-center">Item</th>
            <th className="w-12 text-center">Cant</th>
            <th>Descripción</th>
            <th className="w-28 text-right">P. Unit.</th>
            <th className="w-28 text-right">P. Total</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-xs" style={{ color: "var(--doc-muted)" }}>
                No hay ítems en esta cotización (marca rubros y completa importes).
              </td>
            </tr>
          ) : (
            lineas.map((row, idx) => (
              <tr key={`${row.titulo}-${idx}`}>
                <td className="text-center font-semibold">{idx + 1}</td>
                <td className="text-center">{row.cantidad}</td>
                <td>
                  <div className="titulo-item">{row.titulo}</div>
                  <ul>
                    {row.bullets.map((b, bi) => (
                      <li key={bi}>{b}</li>
                    ))}
                  </ul>
                </td>
                <td className="text-right whitespace-nowrap">{formatPen(row.precioUnit)}</td>
                <td className="text-right font-semibold whitespace-nowrap">{formatPen(row.precioTotal)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={4} className="text-right font-black uppercase tracking-wide">
              TOTAL
            </td>
            <td className="text-right font-black" style={{ fontSize: 15 }}>
              {formatPen(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Notas ── */}
      <section className={cn("mt-5 pt-4 text-sm", embedded ? "border-t border-[var(--color-border)]" : "border-t border-[#ddd]")}>
        <p className="font-bold uppercase tracking-wide text-xs mb-2" style={{ color: "var(--doc-muted)" }}>
          NOTA:
        </p>
        {notasLineas.length > 0 ? (
          <ul className={cn("list-disc space-y-1 pl-5", embedded ? "text-[var(--color-text-primary)]" : "text-[#333]")}>
            {notasLineas.map((n, ni) => (
              <li key={ni}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className={cn("text-xs italic", embedded ? "text-[var(--color-text-secondary)]" : "text-[#888]")}>
            {embedded
              ? "Agregá condiciones, exclusiones o plazos en el campo de notas debajo."
              : "Sin notas adicionales."}
          </p>
        )}
      </section>
    </div>
  );
}
