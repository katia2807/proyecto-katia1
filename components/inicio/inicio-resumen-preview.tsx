import Link from "next/link";
import { IconArrowDownLeft, IconArrowRight, IconArrowUpRight, IconBuildingWarehouse, IconCalendarClock, IconCash, IconChartBar, IconCheck, IconChevronDown, IconClock, IconFileText, IconInfoCircle, IconShoppingBag, IconWallet } from "@tabler/icons-react";
import { requireAuthContext } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";
import styles from "./inicio-resumen-preview.module.css";

// Escenario ilustrativo independiente del almacén: no representa cifras del negocio.
const priorities = [
  {
    id: "cobros", title: "Hay pagos que ya vencieron", subtitle: "2 clientes · vencieron el 14 y 15 de octubre",
    value: formatPen(3250), caption: "por cobrar vencido", tag: "Vencido", tone: "danger", icon: IconCash,
    href: "/gerencial?tab=hoy", action: "Revisar cobros",
    cases: [{ name: "Cliente de ejemplo A", detail: "Venció el 14 oct", value: "S/ 1,450.00" }, { name: "Cliente de ejemplo B", detail: "Venció el 15 oct", value: "S/ 1,800.00" }],
  },
  {
    id: "alquiler", title: "Un alquiler debía terminar ayer", subtitle: "Mixer · el contrato sigue abierto",
    value: "1 contrato", caption: "por revisar", tag: "Vencido", tone: "warning", icon: IconCalendarClock,
    href: "/ventas/alquiler-mixer", action: "Revisar alquileres",
    cases: [{ name: "Contrato de ejemplo MX-025", detail: "Término pactado: 15 oct", value: "Abierto" }],
  },
  {
    id: "stock", title: "Hay productos que necesitan reposición", subtitle: "1 sin existencias · 1 por debajo del mínimo",
    value: "2 productos", caption: "por revisar", tag: "Stock crítico", tone: "warning", icon: IconBuildingWarehouse,
    href: "/inventario?tab=alertas#alertas-stock", action: "Revisar existencias",
    cases: [{ name: "Tablón de cedro", detail: "Mínimo: 5 piezas", value: "0 piezas" }, { name: "Tornillo de 2 pulgadas", detail: "Mínimo: 6 cajas", value: "4 cajas" }],
  },
];

const shortcuts = [
  { label: "Vender", detail: "Abrir Ventas", href: "/ventas", icon: IconShoppingBag, tone: "neutral" },
  { label: "Cotizar", detail: "Preparar un precio", href: "/cotizacion", icon: IconFileText, tone: "violet" },
  { label: "Caja", detail: "Ver movimientos", href: "/caja?vista=empresa#movimientos-caja", icon: IconWallet, tone: "green" },
  { label: "Inventario", detail: "Ver existencias", href: "/inventario?tab=productos", icon: IconBuildingWarehouse, tone: "amber" },
];

export async function InicioResumenPreview() {
  const context = await requireAuthContext();
  const can = (href: string) => canAccessPath(context.role, context.uiRole, href.split(/[?#]/)[0]);
  const items = priorities.filter(item => can(item.href));
  const quickLinks = shortcuts.filter(item => can(item.href));

  return (
    <div className={styles.root} data-inicio-resumen-preview="true">
      <div className={styles.previewBar}>
        <span><span className={styles.previewDot} /> Propuesta de Inicio <span className={styles.previewSeparator}>/</span> Datos de ejemplo</span>
        <Link href="/?vista=actual">Comparar con Inicio actual <IconArrowRight size={14} aria-hidden="true" /></Link>
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>VIERNES, 16 DE OCTUBRE DE 2026 · EJEMPLO</p>
          <h2>Tu negocio, de un vistazo</h2>
          <p>Lo importante primero. El detalle, cuando lo necesites.</p>
        </div>
        {can("/gerencial") ? <Link className={styles.analysisLink} href="/gerencial"><IconChartBar size={19} aria-hidden="true" /> Ver Centro de Mando <IconArrowUpRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <div className={styles.topGrid}>
        <section className={styles.priorities} aria-labelledby="prioridades-inicio">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}><h3 id="prioridades-inicio">Qué conviene atender primero</h3><span className={styles.count}>{items.length} temas</span></div>
            <details className={styles.explanation}>
              <summary aria-label="Cómo se ordenan las prioridades"><IconInfoCircle size={18} aria-hidden="true" /></summary>
              <p>Primero lo vencido; después, lo que puede detener una venta. Abrir un tema permite revisarlo, no lo da por resuelto.</p>
            </details>
          </div>
          <div className={styles.priorityList}>
            {items.map((item, index) => (
              <details key={item.id} className={styles.priority} data-tone={item.tone}>
                <summary>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.prioritySymbol}><item.icon size={23} stroke={1.7} aria-hidden="true" /></span>
                  <span className={styles.priorityCopy}><span className={styles.tag}>{item.tag}</span><strong>{item.title}</strong><span>{item.subtitle}</span></span>
                  <span className={styles.priorityValue}><strong>{item.value}</strong><span>{item.caption}</span></span>
                  <IconChevronDown className={styles.chevron} size={17} aria-hidden="true" />
                </summary>
                <div className={styles.caseList}>
                  {item.cases.map(row => <div key={row.name} className={styles.caseRow}><span><strong>{row.name}</strong><small>{row.detail}</small></span><b>{row.value}</b></div>)}
                  <div className={styles.caseFooter}><span>Casos ilustrativos de la propuesta.</span><Link href={item.href}>{item.action}<IconArrowUpRight size={15} aria-hidden="true" /></Link></div>
                </div>
              </details>
            ))}
            {items.length === 0 ? <div className={styles.empty}><IconCheck size={22} aria-hidden="true" /><p>Los accesos disponibles dependen de tu cuenta.</p></div> : null}
          </div>
        </section>

        <aside className={styles.shortcuts} aria-labelledby="accesos-inicio">
          <div className={styles.shortcutHeading}><h3 id="accesos-inicio">¿Qué necesitas hacer?</h3><span>Tus apartados habituales</span></div>
          <div className={styles.shortcutGrid}>
            {quickLinks.map(link => <Link key={link.href} href={link.href} className={styles.shortcut} data-tone={link.tone}><span className={styles.shortcutIcon}><link.icon size={23} stroke={1.65} aria-hidden="true" /></span><strong>{link.label}</strong><span>{link.detail}</span></Link>)}
          </div>
          <p className={styles.shortcutNote}>Los mismos apartados, a un clic.</p>
        </aside>
      </div>

      {can("/caja") ? <section aria-labelledby="cifras-inicio" className={styles.figures}>
        <div className={styles.figuresHeading}><h3 id="cifras-inicio">Las cifras, en contexto</h3><span>Caja de empresa · ejemplo al 16 oct</span></div>
        <div className={styles.metricGrid}>
          <article className={styles.metric}>
            <div className={styles.metricLabel}><span>Saldo en caja</span><IconWallet size={20} aria-hidden="true" /></div>
            <p className={styles.metricNumber}>{formatPen(12480)}</p>
            <p className={styles.metricHint}>Acumulado hasta el 16 de octubre</p>
            <details className={styles.metricDetails}><summary>De dónde sale <IconChevronDown size={13} aria-hidden="true" /></summary><dl><div><dt>Saldo al empezar octubre</dt><dd>{formatPen(6230)}</dd></div><div><dt>Entradas del mes</dt><dd>+ {formatPen(18400)}</dd></div><div><dt>Salidas del mes</dt><dd>− {formatPen(12150)}</dd></div></dl></details>
          </article>
          <article className={styles.metric}>
            <div className={styles.metricLabel}><span>Por cobrar</span><IconCash size={20} aria-hidden="true" /></div>
            <p className={styles.metricNumber}>{formatPen(8420)}</p>
            <div className={styles.collectionBar} role="img" aria-label="De los 8,420 soles pendientes, 3,250 están vencidos y 5,170 están en plazo"><span /></div>
            <div className={styles.collectionLegend}><span><i /> Vencido <b>{formatPen(3250)}</b></span><span>En plazo <b>{formatPen(5170)}</b></span></div>
            <p className={styles.metricFootnote}>Lo vencido ya está incluido en el total.</p>
          </article>
          <article className={styles.metric}>
            <div className={styles.metricLabel}><span>Diferencia de caja del mes</span><IconChartBar size={20} aria-hidden="true" /></div>
            <p className={styles.metricNumber}>+ {formatPen(6250)}</p>
            <p className={styles.metricHint}>Del 1 al 16 de octubre</p>
            <div className={styles.cashFlow}><span><IconArrowDownLeft size={15} aria-hidden="true" /> Entró <b>{formatPen(18400)}</b></span><span><IconArrowUpRight size={15} aria-hidden="true" /> Salió <b>{formatPen(12150)}</b></span></div>
            <p className={styles.metricFootnote}>Dinero recibido menos dinero pagado.</p>
          </article>
        </div>
      </section> : null}

      <footer className={styles.footer}>
        <span><IconClock size={16} aria-hidden="true" /> Resumen en Inicio. Análisis y seguimiento en Centro de Mando.</span>
        {can("/gerencial") ? <Link href="/gerencial?tab=pasado">Ver resultados y tendencias <IconArrowRight size={15} aria-hidden="true" /></Link> : null}
      </footer>
    </div>
  );
}
