"use client";

import Link from "next/link";
import { useState } from "react";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { TRow } from "@/components/ui/table";
import { formatPen, formatDate } from "@/lib/utils";

type ReporteDetalle = {
  fecha?: string;
  monto: number | string;
  categoria?: string;
  modulo?: string;
  descripcion?: string;
  label?: string;
  usuario?: string | null;
  href?: string;
};

export function ReporteFila({ children, detalle }: { children: React.ReactNode; detalle: ReporteDetalle }) {
  const [open, setOpen] = useState(false);
  const modulo = detalle.modulo || "sin modulo";

  return (
    <>
      <TRow className="cursor-pointer hover:bg-[var(--bg-surface)]" onClick={() => setOpen(true)}>
        {children}
      </TRow>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={detalle.label ?? "Detalle del reporte"}
        description="Origen, fecha, usuario y trazabilidad del dato."
        fullPageHref={detalle.href}
      >
        <div className="space-y-3">
          <DetailField label="Modulo origen" value={modulo.replace(/_/g, " ")} />
          {detalle.fecha ? <DetailField label="Fecha" value={formatDate(detalle.fecha)} /> : null}
          <DetailField label="Usuario que registro" value={detalle.usuario ?? "Sistema / no registrado"} />
          <DetailField label="Monto" value={formatPen(Number(detalle.monto))} />
          {detalle.categoria ? <DetailField label="Categoria" value={detalle.categoria.replace(/_/g, " ")} /> : null}
          {detalle.descripcion ? <DetailField label="Detalle" value={detalle.descripcion} /> : null}
          {detalle.href ? (
            <Link href={detalle.href} className="inline-flex text-sm font-semibold text-[var(--color-accent)] underline">
              Ver en {modulo.replace(/_/g, " ")}
            </Link>
          ) : null}
        </div>
      </DetailDrawer>
    </>
  );
}
