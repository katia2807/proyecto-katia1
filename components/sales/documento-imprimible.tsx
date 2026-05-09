"use client";

import { useEffect } from "react";

type DocumentoImprimibleProps = {
  /** Si es true, dispara window.print() automáticamente al cargar. */
  autoPrint?: boolean;
  children: React.ReactNode;
};

/**
 * Wrapper "estilo papel" para cotizaciones y contratos imprimibles.
 * Aplica estilos optimizados para impresión y permite descargar como PDF
 * desde el diálogo nativo del navegador (Ctrl+P → Guardar como PDF).
 */
export function DocumentoImprimible({ autoPrint = false, children }: DocumentoImprimibleProps) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .doc-paper {
          background: white;
          color: #111;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .doc-paper h1, .doc-paper h2, .doc-paper h3 { color: #111; }
        .doc-paper table { width: 100%; border-collapse: collapse; }
        .doc-paper th, .doc-paper td {
          border: 1px solid #444;
          padding: 6px 8px;
          font-size: 12px;
        }
        .doc-paper th { background: #f4f4f5; text-transform: uppercase; font-size: 10px; }
      `}</style>
      <div className="doc-paper mx-auto my-6 max-w-3xl rounded-xl border border-[var(--color-border)] p-8 shadow">
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print mb-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
        >
          Imprimir / guardar como PDF
        </button>
        {children}
      </div>
    </>
  );
}

export function DocumentoHeader() {
  return (
    <header style={{ borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
        KATIA LIZZET MENESES TAYPE
      </h1>
      <p style={{ fontSize: 12, margin: "4px 0", color: "#444" }}>
        Carpintería &amp; Aserradero · RUC 10739957520
      </p>
      <p style={{ fontSize: 11, margin: 0, color: "#666" }}>
        Lima, Perú · Tel. 987 654 321
      </p>
    </header>
  );
}
