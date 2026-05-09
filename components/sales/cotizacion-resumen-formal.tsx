import { cn, formatDate, formatPen } from "@/lib/utils";
import type { LineaFormal } from "@/lib/cotizacion-unificada-lineas";
import type { EmpresaConfig } from "@/lib/company-config";

function LogoKatia() {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-900/40 bg-gradient-to-br from-amber-100 to-amber-200"
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="h-10 w-10 text-amber-900/90">
        <path
          fill="currentColor"
          d="M24 4l18 10v20L24 44 6 34V14L24 4zm0 4.5L10.5 15.5v17L24 39.5l13.5-7v-17L24 8.5z"
          opacity="0.85"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          d="M14 22c3-4 7-6 10-6s7 2 10 6M16 28c2.5 3 5 4.5 8 4.5s5.5-1.5 8-4.5"
        />
      </svg>
    </div>
  );
}

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
          --doc-border: ${embedded ? "var(--color-border)" : "#222"};
          --doc-head-bg: ${embedded ? "var(--color-primary-soft)" : "#f4f4f5"};
          --doc-muted: ${embedded ? "var(--color-text-secondary)" : "#666"};
          --doc-muted-strong: ${embedded ? "var(--color-text-secondary)" : "#444"};
          --doc-note: ${embedded ? "var(--color-text-primary)" : "#333"};
        }
        .doc-formal table { width: 100%; border-collapse: collapse; }
        .doc-formal th, .doc-formal td {
          border: 1px solid var(--doc-border);
          padding: 8px 10px;
          font-size: 12px;
          vertical-align: top;
        }
        .doc-formal th {
          background: var(--doc-head-bg);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.04em;
        }
        .doc-formal .titulo-item {
          font-weight: 800;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .doc-formal ul { margin: 4px 0 0 16px; padding: 0; }
        .doc-formal li { margin: 2px 0; font-size: 11px; color: var(--doc-note); }
      `}</style>

      <header className={cn("mb-6 flex flex-wrap items-start gap-4 pb-4", embedded ? "border-b border-[var(--color-border)]" : "border-b-2 border-[#111]")}>
        <LogoKatia />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-lg font-extrabold leading-tight tracking-tight">{empresa.nombre}</p>
          <p className={cn("mt-1 text-xs", embedded ? "text-[var(--color-text-secondary)]" : "text-[#444]")}>
            Carpinteria & Aserradero · RUC {empresa.ruc}
          </p>
          <p className={cn("mt-0.5 text-[11px]", embedded ? "text-[var(--color-text-secondary)]" : "text-[#666]")}>
            {empresa.direccion} · Tel. {empresa.telefono}
          </p>
        </div>
      </header>

      <h2 className="mb-6 text-center text-base font-bold uppercase tracking-wide underline decoration-2 underline-offset-4">
        Cotización {correlativoLabel}
      </h2>

      <div className="mb-4 space-y-1 text-sm">
        <p>
          <span className="font-semibold">Nombres:</span> {nombreCliente || "—"}
        </p>
        <p>
          <span className="font-semibold">FECHA:</span> {formatDate(fechaISO)}
        </p>
        {documentoCliente ? (
          <p>
            <span className="font-semibold">{docLabel}:</span> {documentoCliente}
          </p>
        ) : null}
      </div>

      <p className="mb-2 text-sm font-bold uppercase">Descripción</p>

      <table className="mb-6 w-full">
        <thead>
          <tr>
            <th className="w-10 text-center">Item</th>
            <th className="w-14 text-center">Cant</th>
            <th>Descripción</th>
            <th className="w-24 text-right">P. unit</th>
            <th className="w-28 text-right">P. total</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={5} className={cn("text-center text-xs", embedded ? "text-[var(--color-text-secondary)]" : "text-[#666]")}>
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
          <tr>
            <td colSpan={4} className="text-right font-bold uppercase">
              Total
            </td>
            <td className="text-right text-base font-black">{formatPen(total)}</td>
          </tr>
        </tfoot>
      </table>

      <section className={cn("mt-4 pt-4 text-sm", embedded ? "border-t border-[var(--color-border)]" : "border-t border-[#ddd]")}>
        <p className="font-bold">NOTA:</p>
        {notasLineas.length > 0 ? (
          <ul className={cn("mt-2 list-disc space-y-1 pl-5", embedded ? "text-[var(--color-text-primary)]" : "text-[#333]")}>
            {notasLineas.map((n, ni) => (
              <li key={ni}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className={cn("mt-1 text-xs", embedded ? "text-[var(--color-text-secondary)]" : "text-[#888]")}>
            {embedded
              ? "Agregá condiciones, exclusiones o plazos en el campo de notas debajo."
              : "Sin notas adicionales."}
          </p>
        )}
        <p className={cn("mt-4 text-[11px]", embedded ? "text-[var(--color-text-secondary)]" : "text-[#666]")}>
          Documento generado por el sistema interno. Vigencia sujeta a acuerdo comercial.
        </p>
      </section>
    </div>
  );
}
