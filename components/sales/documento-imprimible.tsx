"use client";

import { useEffect } from "react";
import { EmpresaLogoMark } from "@/components/sales/empresa-logo-mark";
import type { EmpresaConfig } from "@/lib/company-config";
import { PrintSelector } from "@/components/ui/print-selector";

type DocumentoImprimibleProps = {
  /** Si es true, dispara window.print() automáticamente al cargar. */
  autoPrint?: boolean;
  children: React.ReactNode;
  id?: string;
  docType?: "cotizacion" | "contrato";
  currentFormat?: "a4" | "ticket" | "cotizacion" | "contrato";
};

/**
 * Wrapper "estilo papel" para cotizaciones y contratos imprimibles.
 * Aplica estilos optimizados para impresión y permite descargar como PDF
 * desde el diálogo nativo del navegador (Ctrl+P → Guardar como PDF).
 */
export function DocumentoImprimible({
  autoPrint = false,
  children,
  id,
  docType,
  currentFormat,
}: DocumentoImprimibleProps) {
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
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
          >
            🖨️ Imprimir / guardar como PDF
          </button>
          {id && docType && (
            <PrintSelector
              id={id}
              docType={docType}
              currentFormat={currentFormat || docType}
            />
          )}
        </div>
        {children}
      </div>
    </>
  );
}


type DocumentoHeaderProps = {
  empresa: EmpresaConfig;
};

export function DocumentoHeader({ empresa }: DocumentoHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        borderBottom: "2px solid #111",
        paddingBottom: 12,
        marginBottom: 16,
      }}
    >
      <EmpresaLogoMark empresa={empresa} print />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          {empresa.nombre}
        </h1>
        <p style={{ fontSize: 12, margin: "4px 0", color: "#444" }}>
          Carpinteria &amp; Aserradero · RUC {empresa.ruc}
        </p>
        <p style={{ fontSize: 11, margin: 0, color: "#666" }}>
          {empresa.direccion} · Tel. {empresa.telefono}
        </p>
      </div>
    </header>
  );
}
