import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ReintentarButton } from "@/components/inicio/reintentar-button";
import type { CajaResumen as Resumen, CajaVista } from "@/lib/caja-resumen-data";
import { formatDate, formatPen } from "@/lib/utils";

export function CajaResumen({ resumen, vista }: { resumen: Resumen | null; vista: CajaVista }) {
  const personal = vista === "personal";
  const nombre = personal ? "personal" : "de la empresa";
  const periodo = !resumen ? "Período no disponible" : resumen.desde && resumen.hasta
    ? `Todo el historial · Del ${formatDate(resumen.desde)} al ${formatDate(resumen.hasta)}`
    : "Todo el historial · Aún sin movimientos";
  const indicadores = [
    { label: "Ingresos", monto: resumen?.ingresos, color: "text-[var(--katia-success)]", hint: "Dinero que entró" },
    { label: "Gastos", monto: resumen?.gastos, color: "text-[var(--katia-danger)]", hint: "Dinero que salió" },
    { label: "Saldo registrado", monto: resumen?.saldo, color: resumen && resumen.saldo < 0 ? "text-[var(--katia-danger)]" : "text-[var(--katia-text-primary)]", hint: "Ingresos menos gastos" },
  ];

  return (
    <section aria-label={`Resumen ${nombre}`} className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-[var(--katia-text-primary)]">Resumen {nombre}</h3>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">{periodo}</p>
        <p className="mt-1 text-xs text-[var(--katia-text-secondary)]">
          {personal ? "Solo movimientos personales, separados de la empresa." : "Incluye todos los medios de pago. Los movimientos personales se contabilizan por separado."}
        </p>
      </div>
      {!resumen && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p>No se pudo cargar Caja completa. Vuelve a intentarlo para consultar los importes y los movimientos.</p>
          <ReintentarButton />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {indicadores.map(item => (
          <Card key={item.label} className="space-y-2">
            <CardTitle className="text-sm">{item.label}</CardTitle>
            <p className={`text-2xl font-semibold tabular-nums ${resumen ? item.color : "text-[var(--katia-text-secondary)]"}`}>
              {item.monto == null ? "No disponible" : formatPen(item.monto)}
            </p>
            <CardDescription className="text-xs">{item.hint}</CardDescription>
          </Card>
        ))}
      </div>
      {resumen && resumen.transferencias > 0 && (
        <p className="text-xs text-[var(--katia-text-secondary)]">Las transferencias entre medios de pago quedan en el historial y no suman ingresos ni gastos.</p>
      )}
    </section>
  );
}
