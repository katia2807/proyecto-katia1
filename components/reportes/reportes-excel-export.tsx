"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

type ReportesExcelExportProps = {
  canExport: boolean;
};

export function ReportesExcelExport({ canExport }: ReportesExcelExportProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null);

  if (canExport) {
    return (
      <a href="/api/export/reportes-excel">
        <Button type="button">Descargar Excel multi-hoja</Button>
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() =>
          setPermissionError(
            "No tienes permiso para descargar este Excel. Solo cuentas de dueña (owner_admin) o gerencia pueden exportarlo.",
          )
        }
      >
        Descargar Excel multi-hoja
      </Button>
      {permissionError ? (
        <p role="alert" className="max-w-md text-sm font-medium text-[var(--color-danger)]">
          {permissionError}
        </p>
      ) : null}
    </div>
  );
}
