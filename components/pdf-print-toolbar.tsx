"use client";

export function PdfPrintToolbar() {
  return (
    <div className="mt-8 print:hidden">
      <button
        type="button"
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        onClick={() => window.print()}
      >
        Imprimir / guardar como PDF
      </button>
    </div>
  );
}
