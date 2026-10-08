import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";

const TASKS = [
  { title: "Encontrar una venta", description: "Abre el historial, busca por cliente o producto y revisa el detalle antes de cambiar algo.", href: "/ventas#historial-ventas", action: "Ir a Ventas" },
  { title: "Revisar el dinero", description: "Elige Empresa o Personal. Filtra por fecha y medio de pago para ver los movimientos que necesitas.", href: "/caja", action: "Ir a Caja" },
  { title: "Consultar el stock", description: "Alertas muestra qué reponer. Productos reúne el catálogo y Kardex explica las entradas y salidas.", href: "/inventario?tab=alertas", action: "Ir a Inventario" },
  { title: "Revisar una cotización", description: "Busca primero en el historial. Para preparar una nueva, revisa cliente, conceptos y total antes de guardar.", href: "/cotizacion", action: "Ir a Cotizaciones" },
  { title: "Ver qué atender primero", description: "Centro de Mando reúne las prioridades y explica el motivo. Abre la operación indicada para revisarla.", href: "/gerencial", action: "Ir a Centro de Mando" },
  { title: "Descargar información", description: "En Reportes elige el período y exporta los datos para consultarlos fuera del programa.", href: "/reportes", action: "Ir a Reportes" },
];

const QUESTIONS = [
  { title: "¿Dónde está el menú?", answer: "Usa el botón de menú de la cabecera. En una pantalla pequeña se oculta para liberar espacio; puedes cerrarlo con «Cerrar», tocando fuera o con Escape." },
  { title: "¿Cómo cambio entre claro y oscuro?", answer: "Pulsa el botón de sol o luna de la cabecera. La elección se recuerda en ese navegador." },
  { title: "¿Por qué no veo una opción?", answer: "Cada cuenta ve las opciones que permite su rol. Si necesitas otra, consulta con quien administra el programa." },
  { title: "¿El Excel sirve para recuperar todo?", answer: "El Excel sirve para consultar información. La recuperación completa también necesita la base de datos y los adjuntos; se prepara desde el procedimiento de Respaldo." },
];

export default async function AyudaPage() {
  const context = await requireAuthContext();
  const tasks = TASKS.filter((task) => canAccessPath(context.role, context.uiRole, task.href.split(/[?#]/)[0]));
  const canOpenBackup = canAccessPath(context.role, context.uiRole, "/admin/respaldo");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Ayuda rápida</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">Elige lo que necesitas. Cada resumen te lleva a su apartado.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tasks.map((task) => (
          <Link key={task.href} href={task.href} className="rounded-[var(--katia-radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--katia-primary)]">
            <Card className="h-full transition-colors hover:border-[var(--katia-border-emphasis)]">
              <CardTitle>{task.title}</CardTitle>
              <CardDescription className="mt-2 leading-5">{task.description}</CardDescription>
              <p className="mt-3 text-xs font-medium text-[var(--katia-primary)]">{task.action} →</p>
            </Card>
          </Link>
        ))}
      </div>
      <section aria-labelledby="quick-help-questions">
        <h3 id="quick-help-questions" className="mb-3 text-base font-semibold">Dudas habituales</h3>
        <div className="space-y-2">
          {QUESTIONS.map((question) => (
            <details key={question.title} className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{question.title}</summary>
              <p className="mt-2 text-sm leading-6 text-[var(--katia-text-secondary)]">{question.answer}</p>
            </details>
          ))}
        </div>
        {canOpenBackup ? <Link href="/admin/respaldo" className="mt-3 inline-block text-xs font-medium text-[var(--katia-primary)]">Consultar el procedimiento de Respaldo →</Link> : null}
      </section>
    </div>
  );
}
