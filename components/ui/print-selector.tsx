"use client";

import { useRouter, useSearchParams } from "next/navigation";

type PrintSelectorProps = {
  id: string;
  currentFormat: "a4" | "ticket" | "default" | "cotizacion" | "contrato";
  docType: "boleta" | "factura" | "cotizacion" | "contrato";
  tipoSale?: string;
};

export function PrintSelector({ id, currentFormat, docType, tipoSale }: PrintSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSwitch(format: "a4" | "ticket" | "default" | "cotizacion" | "contrato") {
    const params = new URLSearchParams(searchParams.toString());
    if (tipoSale) {
      params.set("tipo", tipoSale);
    }

    let path = "";
    if (format === "default") {
      path = `/ventas/comprobante/${tipoSale || "madera"}/${id}`;
    } else if (format === "a4") {
      if (docType === "cotizacion") {
        path = `/print/a4/cotizacion/${id}`;
      } else if (docType === "contrato") {
        path = `/print/a4/contrato/${id}`;
      } else {
        path = `/print/a4/${docType}/${id}`;
      }
    } else if (format === "ticket") {
      path = `/print/ticket/${docType}/${id}`;
    } else if (format === "cotizacion") {
      path = `/cotizacion/unificada/${id}/pdf`;
    } else if (format === "contrato") {
      path = `/ventas/alquiler-mixer/${id}/pdf`;
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    router.push(path + query);
  }

  // Determine which options to show
  const showTicket = docType === "boleta" || docType === "factura";

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--color-surface,#1e293b)] p-1.5 border border-[var(--color-border,#334155)] shadow-inner text-xs font-medium">
      <span className="text-[var(--color-text-secondary,#94a3b8)] px-2">Formato de impresión:</span>
      
      {/* Default/Standard Interactive View */}
      {docType !== "cotizacion" && docType !== "contrato" && (
        <button
          type="button"
          onClick={() => handleSwitch("default")}
          className={`px-3 py-1 rounded-lg transition-all ${
            currentFormat === "default"
              ? "bg-[var(--color-primary,#3b82f6)] text-white shadow"
              : "text-[var(--color-text-secondary,#94a3b8)] hover:text-white"
          }`}
        >
          Vista Interactiva
        </button>
      )}

      {/* A4 Format Option */}
      <button
        type="button"
        onClick={() => handleSwitch("a4")}
        className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
          currentFormat === "a4"
            ? "bg-[var(--color-primary,#3b82f6)] text-white shadow"
            : "text-[var(--color-text-secondary,#94a3b8)] hover:text-white"
        }`}
      >
        📄 A4 (EPSON L5190)
      </button>

      {/* Ticket 80mm Option */}
      {showTicket && (
        <button
          type="button"
          onClick={() => handleSwitch("ticket")}
          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
            currentFormat === "ticket"
              ? "bg-[var(--color-primary,#3b82f6)] text-white shadow"
              : "text-[var(--color-text-secondary,#94a3b8)] hover:text-white"
          }`}
        >
          🎫 Ticket Térmico 80mm
        </button>
      )}

      {/* Cotización Standard View Fallback */}
      {docType === "cotizacion" && currentFormat !== "cotizacion" && (
        <button
          type="button"
          onClick={() => handleSwitch("cotizacion")}
          className="px-3 py-1 rounded-lg text-[var(--color-text-secondary,#94a3b8)] hover:text-white"
        >
          Vista Cotización
        </button>
      )}

      {/* Contrato Standard View Fallback */}
      {docType === "contrato" && currentFormat !== "contrato" && (
        <button
          type="button"
          onClick={() => handleSwitch("contrato")}
          className="px-3 py-1 rounded-lg text-[var(--color-text-secondary,#94a3b8)] hover:text-white"
        >
          Vista Contrato
        </button>
      )}
    </div>
  );
}
