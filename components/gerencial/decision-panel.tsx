import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CashFlowChart } from "@/components/gerencial/cash-flow-chart";
import { formatDate, formatPen } from "@/lib/utils";
import { etiquetaEstadoCotizacion } from "@/lib/cotizacion-estados";
import { gerencialChange, type GerencialItem, type GerencialModel } from "@/lib/gerencial-model";
import { GERENCIAL_LABELS, gerencialRequiredTables, type GerencialTab } from "@/lib/gerencial-data";

const linkStyle = "inline-flex items-center rounded-lg border border-[var(--katia-border-default)] px-3 py-2 text-sm font-semibold text-[var(--katia-primary)] hover:bg-[var(--katia-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--katia-primary)]";
const number = (value: number | null) => value === null ? "No disponible" : formatPen(value);
const qty = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 2 });

function DecisionMetric({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return <Card className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--katia-text-secondary)]">{label}</p>
    <p className="mt-2 break-words text-2xl font-bold tabular-nums text-[var(--katia-text-primary)]">{value}</p>
    <p className="mt-2 text-sm text-[var(--katia-text-secondary)]">{hint}</p>
    <Link href={href} className="mt-3 inline-block text-sm font-semibold text-[var(--katia-primary)] hover:underline">Ver registros →</Link>
  </Card>;
}

function DecisionItems({ items, empty }: { items: GerencialItem[]; empty: string }) {
  if (items.length === 0) return <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">{empty}</p>;
  return <ul className="mt-4 space-y-3">
    {items.map(item => <li key={item.id} className="min-w-0 rounded-xl border border-[var(--katia-border-default)] bg-[var(--katia-surface-raised)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${item.priority === "alta" ? "bg-[var(--katia-danger)]/10 text-[var(--katia-danger)]" : item.priority === "media" ? "bg-[var(--katia-warning)]/10 text-[var(--katia-warning)]" : "bg-[var(--katia-primary-soft)] text-[var(--katia-primary)]"}`}>{item.priority === "alta" ? "Prioridad alta" : item.priority === "media" ? "Por atender" : "Seguimiento"}</span>
        <p className="text-sm font-semibold text-[var(--katia-text-primary)]">{item.title}</p>
      </div>
      <p className="mt-2 break-words text-sm font-medium text-[var(--katia-text-primary)]">{item.subject}</p>
      <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">{item.reason}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="text-xs text-[var(--katia-text-secondary)]">
          {item.date ? <p>{item.id.startsWith("credito:") ? "Vencimiento del crédito" : item.id.startsWith("alquiler:") ? "Término pactado" : "Fecha de operación"}: {formatDate(item.date)}</p> : null}
          {item.amountLabel ? <p className="mt-1">{item.amountLabel}: <strong className="text-[var(--katia-text-primary)]">{item.amount === null ? item.id.startsWith("credito:") ? "Por comprobar" : "Por definir" : formatPen(item.amount)}</strong></p> : null}
        </div>
        <Link href={item.href} className={linkStyle}>{item.action} →</Link>
      </div>
    </li>)}
  </ul>;
}

export function DecisionPanel({ model: m, tab }: { model: GerencialModel; tab: GerencialTab }) {
  const missing = gerencialRequiredTables(tab).filter(t => m.sources[t] === null);
  const partial = missing.length > 0;
  const p = m.periods;
  return <div className="min-w-0 space-y-6">
    <div className="rounded-xl border border-[var(--katia-primary)]/20 bg-[var(--katia-primary-soft)] p-4 text-sm text-[var(--katia-text-primary)]">
      <p className="font-semibold">{tab === "hoy" ? "Qué atender primero" : tab === "pasado" ? "Cómo va el período" : "Qué se aproxima"}</p>
      <p className="mt-1 text-[var(--katia-text-secondary)]">{tab === "hoy" ? `Situación registrada al ${formatDate(p.today)} · calendario de Perú. Abrir una alerta no la resuelve.` : tab === "pasado" ? `Del ${formatDate(p.start)} al ${formatDate(p.today)}, comparado con ${formatDate(p.previousStart)} al ${formatDate(p.previousEnd)}.` : `Compromisos del ${formatDate(p.today)} al ${formatDate(p.nextEnd)}. Las fechas e importes proceden de los registros.`}</p>
    </div>
    {partial ? <div role="alert" className="rounded-xl border border-[var(--katia-warning)]/40 bg-[var(--katia-warning)]/10 p-4 text-sm text-[var(--katia-text-primary)]">
      <p className="font-semibold">Información incompleta: {missing.map(t => GERENCIAL_LABELS[t]).join(", ")}.</p>
      <p className="mt-1">No se pudieron comprobar estas fuentes. Sus cifras no se muestran como cero; las listas solo contienen lo que pudo consultarse. Recarga para volver a intentar.</p>
    </div> : null}

    {tab === "hoy" ? <>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DecisionMetric label="Saldo de empresa" value={number(m.cash.balance)} hint="Ingresos menos gastos de todo el historial hasta hoy. Personal separado." href="/caja?vista=empresa" />
        <DecisionMetric label="Ingresos de hoy" value={number(m.cash.todayIncome)} hint="Dinero registrado hoy en Caja de empresa." href={`/caja?vista=empresa&desde=${p.today}&hasta=${p.today}&tipo=ingreso#movimientos-caja`} />
        <DecisionMetric label="Stock por revisar" value={m.stockLow === null ? "No disponible" : String(m.stockLow.length)} hint="Productos activos en el mínimo o por debajo. Se incluye su movimiento reciente." href="/inventario?tab=alertas#alertas-stock" />
        <DecisionMetric label="Créditos vencidos por revisar" value={sourcesCreditReady(m) ? String(m.actions.filter(a => a.id.startsWith("credito:") && a.date! < p.today).length) : "No disponible"} hint="Seguimiento según fecha de crédito y pagos vinculados. Requiere comprobar pagos externos." href="/gerencial?tab=futuro" />
      </div>
      <Card className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Prioridades del día</CardTitle><CardDescription className="mt-1">{m.actions.length} pendientes identificados{partial ? " en las fuentes disponibles" : ""}. Ordenados por gravedad y fecha.</CardDescription></div><Link href="/gerencial?tab=futuro" className={linkStyle}>Ver próximos compromisos →</Link></div>
        <DecisionItems items={m.actions.slice(0, 8)} empty={partial ? "No se identificaron pendientes en las fuentes disponibles. Falta información para completar la revisión." : "No se identificaron pendientes con los criterios de este panel."} />
        {m.actions.length > 8 ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--katia-primary)]">Ver los {m.actions.length - 8} pendientes restantes</summary><DecisionItems items={m.actions.slice(8)} empty="" /></details> : null}
      </Card>
      <Card className="min-w-0"><CardTitle>Lo que viene en siete días</CardTitle><CardDescription className="mt-1">{m.upcoming.length} compromisos con fecha{partial ? " en las fuentes disponibles" : ""}; {m.undated.length} operaciones necesitan comprobar una fecha.</CardDescription><Link href="/gerencial?tab=futuro" className={`mt-4 ${linkStyle}`}>Preparar próximos compromisos →</Link></Card>
    </> : null}

    {tab === "pasado" ? <>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DecisionMetric label="Ingresos del período" value={number(m.cash.income)} hint={gerencialChange(m.cash.income, m.cash.previousIncome)} href={`/caja?vista=empresa&desde=${p.start}&hasta=${p.today}&tipo=ingreso#movimientos-caja`} />
        <DecisionMetric label="Gastos del período" value={number(m.cash.expense)} hint={gerencialChange(m.cash.expense, m.cash.previousExpense)} href={`/caja?vista=empresa&desde=${p.start}&hasta=${p.today}&tipo=egreso#movimientos-caja`} />
        <DecisionMetric label="Resultado de Caja" value={number(m.cash.result)} hint="Ingresos menos gastos del período. Este cálculo no mide la utilidad del negocio." href="/caja?vista=empresa" />
        <DecisionMetric label="Importes de operaciones" value={number(m.operationsAmount)} hint={m.operationsReady ? `${m.operationsCount} operaciones; ${m.unknownOperations} importes por definir. No representa dinero cobrado.` : "Falta una fuente para comprobar el total de operaciones."} href="/ventas#historial-ventas" />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0"><CardTitle>Qué explica los gastos</CardTitle><CardDescription className="mt-1">Categorías de Caja de empresa en los períodos indicados.</CardDescription>
          {m.sources.movimientos_caja === null ? <p className="mt-4 text-sm">No disponible: falta comprobar Caja.</p> : m.expenseCategories.length === 0 ? <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">Sin gastos registrados en ambos períodos.</p> : <ul className="mt-4 space-y-4">{m.expenseCategories.slice(0, 5).map(c => <li key={c.category} className="border-b border-[var(--katia-border-subtle)] pb-3"><p className="break-words text-sm font-semibold">{c.label}</p><p className="mt-1 text-sm tabular-nums">Ahora {formatPen(c.current)} · antes {formatPen(c.previous)}</p><p className="mt-1 text-xs text-[var(--katia-text-secondary)]">{gerencialChange(c.current, c.previous)}</p><Link className="mt-2 inline-block text-xs font-semibold text-[var(--katia-primary)]" href={`/caja?vista=empresa&tipo=egreso&desde=${p.start}&hasta=${p.today}&buscar=${encodeURIComponent(c.category)}#movimientos-caja`}>Revisar movimientos →</Link></li>)}</ul>}
        </Card>
        <Card className="min-w-0"><CardTitle>Clientes con más importes registrados</CardTitle><CardDescription className="mt-1">Operaciones del período; se excluyen propuestas, borradores y alquileres abiertos.</CardDescription>
          {!m.operationsReady ? <p className="mt-4 text-sm">No disponible: falta comprobar una fuente de operaciones.</p> : m.topClients.length === 0 ? <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">Sin operaciones con importe conocido en este período.</p> : <ul className="mt-4 space-y-3">{m.topClients.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--katia-border-subtle)] p-3"><div className="min-w-0"><Link href={`/ventas/clientes/${encodeURIComponent(c.id)}`} className="break-words text-sm font-semibold text-[var(--katia-primary)]">{c.name}</Link><p className="text-xs text-[var(--katia-text-secondary)]">{c.count} operaciones con importe conocido</p></div><strong className="text-sm tabular-nums">{formatPen(c.amount)}</strong></li>)}</ul>}
        </Card>
      </div>
      <p className="text-xs text-[var(--katia-text-secondary)]">Los importes de operaciones incluyen madera confirmada, muebles terminados, cotizaciones cobradas, alquileres cerrados y aserradero, según su fecha de operación. Los pagos se consultan en Caja. {m.unknownOperations > 0 ? "El total conocido excluye importes por definir." : ""}</p>
      <Card className="min-w-0"><CardTitle>Movimiento de productos en 30 días</CardTitle><CardDescription className="mt-1">Salidas registradas del {formatDate(p.recentStart)} al {formatDate(p.today)}. Cada unidad se compara por separado.</CardDescription>
        {m.inventory === null || m.sources.inventario_movimientos === null ? <p className="mt-4 text-sm">Movimiento no disponible: falta comprobar Inventario.</p> : m.productGroups.length === 0 ? <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">Sin salidas por venta registradas en los últimos 30 días.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{m.productGroups.map(g => <div key={g.unit} className="min-w-0 rounded-xl border border-[var(--katia-border-subtle)] p-4"><h4 className="text-sm font-semibold">Unidad registrada: {g.unit}</h4><ul className="mt-3 space-y-3">{g.rows.map(r => <li key={r.id}><p className="break-words text-sm font-medium">{r.nombre}</p><p className="text-xs text-[var(--katia-text-secondary)]">{qty(r.recent!)} {r.unidad} en salidas · stock {qty(Number(r.stock_actual))} {r.unidad}</p></li>)}</ul></div>)}</div>}
        <p className="mt-4 text-xs text-[var(--katia-text-secondary)]">Valor de stock con costo registrado en compras: {m.stockValues?.valorRegistrado == null ? "No disponible" : formatPen(m.stockValues.valorRegistrado)}. {m.stockValues ? `${m.stockValues.productosSinCosto} productos con stock sin costo disponible; no están incluidos en ese importe.` : "Falta comprobar compras o productos para valorizarlo."}</p>
      </Card>
      <Card className="min-w-0"><CardTitle>Saldo de empresa en los últimos 30 días</CardTitle><CardDescription className="mt-1">Saldo acumulado desde todo el historial, hasta cada fecha; los movimientos personales están separados.</CardDescription><div className="mt-4 min-w-0">{m.sources.movimientos_caja === null ? <p className="text-sm">Gráfico no disponible: falta comprobar Caja.</p> : <CashFlowChart data={m.cashPoints} />}</div></Card>
    </> : null}

    {tab === "futuro" ? <>
      <Card className="min-w-0"><CardTitle>Vencidos o con fecha de hoy</CardTitle><CardDescription className="mt-1">Créditos y terminaciones que requieren comprobar su situación.</CardDescription><DecisionItems items={m.actions.filter(a => a.date !== null && a.date <= p.today && (a.id.startsWith("credito:") || a.id.startsWith("alquiler:")))} empty={partial ? "No se identificaron vencimientos en las fuentes disponibles." : "Sin vencimientos pendientes identificados hasta hoy."} /></Card>
      <Card className="min-w-0"><CardTitle>Próximos siete días</CardTitle><CardDescription className="mt-1">Vencimientos de crédito y términos de contratos con fecha registrada. No son ingresos garantizados.</CardDescription><DecisionItems items={m.upcoming} empty={partial ? "No se identificaron próximas fechas en las fuentes disponibles." : "Sin compromisos identificados en los próximos siete días."} /></Card>
      <Card className="min-w-0"><CardTitle>Operaciones sin fecha por comprobar</CardTitle><CardDescription className="mt-1">Pedidos sin fecha de entrega disponible y contratos o créditos sin fecha registrada.</CardDescription><DecisionItems items={m.undated} empty={partial ? "No se identificaron operaciones sin fecha en las fuentes disponibles." : "Sin operaciones identificadas que necesiten comprobar una fecha."} /></Card>
      <Card className="min-w-0"><CardTitle>Seguimiento de cotizaciones</CardTitle><CardDescription className="mt-1">{m.opportunities.length} cotizaciones activas{partial ? " en las fuentes disponibles" : ""}. Su importe es una propuesta, no una deuda ni un ingreso asegurado.</CardDescription>
        <ul className="mt-4 space-y-3">{m.opportunities.slice(0, 10).map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--katia-border-subtle)] p-4"><div className="min-w-0"><p className="break-words text-sm font-semibold">{c.subject}</p><p className="mt-1 text-xs text-[var(--katia-text-secondary)]">{etiquetaEstadoCotizacion(c.state)} · {formatDate(c.date)} · {c.amount === null ? "Importe por definir" : formatPen(c.amount)}</p></div><Link href={c.href} className={linkStyle}>Revisar cotización →</Link></li>)}</ul>
        {m.opportunities.length === 0 ? <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">{m.sources.cotizaciones_unificadas === null ? "No disponible: falta comprobar Cotizaciones." : "Sin cotizaciones activas registradas."}</p> : null}
        {m.opportunities.length > 10 ? <Link href="/cotizacion#historial-cotizaciones" className={`mt-4 ${linkStyle}`}>Ver historial · se muestran 10 de {m.opportunities.length} →</Link> : null}
      </Card>
    </> : null}
  </div>;
}

function sourcesCreditReady(m: GerencialModel) {
  return [m.sources.movimientos_caja, m.sources.ventas_madera, m.sources.ventas_madera_cortada, m.sources.ventas_mueble_terminado, m.sources.alquileres].every(s => s !== null);
}
