"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { IconHelpCircle, IconX } from "@tabler/icons-react";

const tipsByPath: { match: string; title: string; tips: string[] }[] = [
  {
    match: "/inventario",
    title: "Tips de inventario",
    tips: ["Usa filtros combinados para acotar por codigo, categoria y stock.", "Selecciona varios productos para acciones en lote.", "En Alertas, Reponer abre compras con el producto elegido."],
  },
  {
    match: "/cotizacion",
    title: "Tips de cotizacion",
    tips: ["Primero revisa cotizaciones existentes; luego crea o edita.", "Al aprobar una cotizacion puedes iniciar produccion.", "Los cobros quedan conectados con Caja."],
  },
  {
    match: "/caja",
    title: "Tips de caja",
    tips: ["Cada fila abre el detalle completo.", "Separa movimientos personales para no mezclar utilidad.", "Agrega notas claras para auditoria."],
  },
  {
    match: "/ventas/clientes",
    title: "Tips de clientes",
    tips: ["Haz clic en una fila para ver la vista 360.", "Los pedidos activos y pagos pendientes aparecen en el detalle.", "Gestiona estado antes de eliminar clientes activos."],
  },
  {
    match: "/reportes",
    title: "Tips de reportes",
    tips: ["Reportes queda para auditoria y exportacion.", "Cada fila indica origen del dato.", "El analisis de decision vive en Panel Gerencial."],
  },
];

export function FloatingHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const content = useMemo(() => {
    return tipsByPath.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`)) ?? {
      title: "Tips de esta pagina",
      tips: ["Revisa la lista, abre el detalle y edita desde un solo lugar.", "Usa la busqueda global para saltar a clientes, productos o cotizaciones.", "Los estados vacios muestran el siguiente paso recomendado."],
    };
  }, [pathname]);

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-[var(--color-border)] bg-[var(--bg-card)] p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{content.title}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar ayuda">
              <IconX className="size-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
            {content.tips.slice(0, 4).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Abrir ayuda contextual"
        onClick={() => setOpen((value) => !value)}
        className="flex size-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--accent-primary)] text-white shadow-xl"
      >
        <IconHelpCircle className="size-6" />
      </button>
    </div>
  );
}
