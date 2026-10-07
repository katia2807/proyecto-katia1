"use client";

import Link from "next/link";
import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { TRow } from "@/components/ui/table";
import { formatPen, formatDate } from "@/lib/utils";

type ReporteDetalle = {
  fecha?: string;
  monto: number | string | null;
  categoria?: string;
  modulo?: string;
  descripcion?: string;
  label?: string;
  usuario?: string | null;
  href?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatUsuario(u: string | null | undefined): string {
  if (!u) return "Usuario no registrado";
  if (UUID_RE.test(u.trim())) return `Usuario registrado: ${u}`;
  return u;
}

export function ReporteFila({ children, detalle }: { children: React.ReactNode; detalle: ReporteDetalle }) {
  const [open, setOpen] = useState(false);
  const modulo = detalle.modulo || "sin modulo";
  const cells = Children.toArray(children);
  if (isValidElement(cells[0])) {
    const first = cells[0] as ReactElement<{ children?: ReactNode }>;
    cells[0] = cloneElement(first, {}, <button type="button" className="text-left underline decoration-dotted underline-offset-4 focus-visible:outline-2" aria-label={`Abrir detalle ${detalle.label ?? detalle.fecha ?? modulo}`} onClick={event => { event.stopPropagation(); setOpen(true); }}>{first.props.children}</button>);
  }

  return (
    <>
      <TRow className="cursor-pointer hover:bg-[var(--bg-surface)]" onClick={() => setOpen(true)}>
        {cells}
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
          <DetailField label="Usuario que registro" value={formatUsuario(detalle.usuario)} />
          <DetailField label="Monto" value={detalle.monto === null ? "Por comprobar" : formatPen(Number(detalle.monto))} />
          {detalle.categoria ? <DetailField label="Categoria" value={detalle.categoria.replace(/_/g, " ")} /> : null}
          {detalle.descripcion ? <DetailField label="Detalle" value={detalle.descripcion} /> : null}
          {detalle.href ? (
            <Link href={detalle.href} className="inline-flex text-sm font-semibold text-[var(--color-accent)] underline">
              Ver registro relacionado
            </Link>
          ) : null}
        </div>
      </DetailDrawer>
    </>
  );
}
