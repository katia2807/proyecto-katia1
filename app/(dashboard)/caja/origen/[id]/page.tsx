import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ReintentarButton } from "@/components/inicio/reintentar-button";
import { requireAuthContext } from "@/lib/auth";
import { getCajaOrigen } from "@/lib/caja-origen-data";
import { safeCajaHref } from "@/lib/caja-origen-navigation";
import { canAccessPath } from "@/lib/permissions";

type PageProps = { params: Promise<{ id: string }>; searchParams?: Promise<{ volver?: string | string[] }> };

export default async function CajaOrigenPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const context = await requireAuthContext();
  const volver = safeCajaHref((await searchParams)?.volver);
  const origen = await getCajaOrigen(id, context.organizationId);
  const restringido = origen.estado === "encontrado" && !canAccessPath(context.role, context.uiRole, origen.href);
  if (origen.estado === "encontrado" && !restringido) redirect(origen.href);
  const mensaje = restringido ? "Tu rol permite consultar Caja, pero no abrir esta operación. Solicita ayuda a una persona con acceso a Ventas o Cotizaciones."
    : origen.estado === "error" ? "No se pudo cargar la operación relacionada. Puedes volver a intentarlo o regresar a Caja con tus filtros."
    : origen.estado === "sin-vinculo" ? "Este movimiento no tiene una venta o cotización enlazada. Puedes consultar sus datos y notas en Caja."
    : origen.estado === "movimiento-no-disponible" ? "El movimiento ya no está disponible en esta empresa. Regresa a Caja para consultar el historial actualizado."
    : "La operación relacionada ya no está disponible. El movimiento conserva sus datos y notas en Caja.";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href={volver} className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[var(--katia-primary)] focus-visible:outline-2 focus-visible:outline-offset-2">
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver a Caja
      </Link>
      <Card className="space-y-3">
        <CardTitle>{restringido ? "Acceso limitado" : "Operación relacionada no disponible"}</CardTitle>
        <CardDescription>{mensaje}</CardDescription>
        {origen.estado === "error" && <ReintentarButton />}
      </Card>
    </div>
  );
}
