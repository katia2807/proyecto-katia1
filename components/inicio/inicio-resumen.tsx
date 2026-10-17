import Link from "next/link";
import { IconAlertTriangle, IconArmchair, IconArrowUpRight, IconBuildingWarehouse, IconCalendarClock, IconCash, IconChartBar, IconCheck, IconChevronDown, IconFileText, IconInfoCircle, IconShoppingBag, IconReceipt, IconUsers, IconWallet } from "@tabler/icons-react";
import { formatDate, formatPen } from "@/lib/utils";
import { GERENCIAL_LABELS } from "@/lib/gerencial-tables";
import type { InicioResumen, InicioTopic } from "@/lib/inicio-resumen-model";
import { ReintentarButton } from "@/components/inicio/reintentar-button";
import styles from "./inicio-resumen.module.css";
import { InicioSaludo } from "./inicio-saludo";
const pendingTopics = {
  creditos: { label: "Créditos", icon: IconCash },
  contratos: { label: "Alquileres", icon: IconCalendarClock },
  borradores: { label: "Borradores", icon: IconFileText },
  produccion: { label: "Pedidos", icon: IconArmchair },
  mora: { label: "En mora", icon: IconAlertTriangle },
  penalidades: { label: "Penalidades", icon: IconReceipt },
  stock: { label: "Reponer", icon: IconBuildingWarehouse },
  alertas: { label: "Alertas", icon: IconInfoCircle },
};

function PendingLink({ label, title, count, href, icon: Icon, urgent = 0 }: {
  label: string;
  title: string;
  count: number;
  href: string;
  icon: typeof IconCash;
  urgent?: number;
}) {
  const description = label + ": " + count + (count === 1 ? " pendiente." : " pendientes.")
    + (title !== label ? " " + title + "." : "")
    + (urgent > 0 ? " Incluye casos prioritarios: " + urgent + "." : "");
  return (
    <Link className={styles.pendingLink} href={href} aria-label={description} title={description}>
      <Icon className={styles.pendingIcon} size={19} stroke={1.7} aria-hidden="true" />
      <span className={styles.pendingName}>{label}</span>
      <strong className={styles.pendingCount}>
        {count}
        {urgent > 0 ? <IconAlertTriangle className={styles.pendingUrgent} size={13} aria-hidden="true" /> : null}
      </strong>
    </Link>
  );
}
const topicIcons={cobros:IconCash,alquileres:IconCalendarClock,stock:IconBuildingWarehouse};
function Topic({topic,index,today}:{topic:InicioTopic;index:number;today:string}) {
  const Icon=topicIcons[topic.id as keyof typeof topicIcons]??IconInfoCircle;
  return <details className={styles.priority} data-tone={topic.tone}>
    <summary><span className={styles.rank}>{index+1}</span><span className={styles.prioritySymbol}><Icon size={23} aria-hidden="true" /></span><span className={styles.priorityCopy}><span className={styles.tag}>{topic.tag}</span><strong>{topic.title}</strong><span>{topic.items.length} {topic.id==="stock"?"productos":"casos"} por revisar</span></span><span className={styles.priorityValue}><strong>{topic.amount!==null?formatPen(topic.amount):topic.items.length}</strong><span>{topic.amount!==null?"saldo según Caja":"por revisar"}</span></span><IconChevronDown className={styles.chevron} size={17} aria-hidden="true" /></summary>
    <div className={styles.caseList}>{topic.items.slice(0,5).map(item=><div key={item.id} className={styles.caseRow}><span><strong>{item.subject}</strong><small>{item.date?(item.date<today?"Venció: ":"Fecha: ")+formatDate(item.date):item.reason}</small></span><Link className={styles.caseLink} href={item.href}>{item.amount!==null?formatPen(item.amount):item.action}<IconArrowUpRight size={13} aria-hidden="true" /></Link></div>)}<div className={styles.caseFooter}><span>{topic.items.length>5?"Mostrando 5 de "+topic.items.length+" casos.":"Abrir no da el pendiente por resuelto."}</span><Link href={topic.href}>{topic.action}<IconArrowUpRight size={15} aria-hidden="true" /></Link></div></div>
  </details>;
}
export function InicioResumenView({data,noAccess=false}:{data:InicioResumen;noAccess?:boolean}) {
  const shortcuts=[
    {show:data.access.sales,label:"Vender",detail:"Abrir Ventas",href:"/ventas",icon:IconShoppingBag,tone:"neutral"},
    {show:data.access.quotes,label:"Cotizar",detail:"Preparar un precio",href:"/cotizacion",icon:IconFileText,tone:"violet"},
    {show:data.access.cash,label:"Caja",detail:"Ver movimientos",href:"/caja?vista=empresa#movimientos-caja",icon:IconWallet,tone:"green"},
    {show:data.access.inventory,label:"Inventario",detail:"Ver existencias",href:"/inventario?tab=productos",icon:IconBuildingWarehouse,tone:"amber"},
  ].filter(link=>link.show);
  const missing=[...data.unavailable.map(table=>GERENCIAL_LABELS[table]),...data.extraUnavailable];
  const money=(value:number|null)=>value===null?"No disponible":formatPen(value);
  const others=data.other.length+Number((data.advances??0)>0);
  return <div className={styles.root} data-inicio-resumen="true">
    {noAccess?<div role="alert" className={styles.warning}><strong>No tienes acceso a esta sección.</strong><span>Tu cuenta conserva los apartados permitidos.</span></div>:null}
    <header className={styles.header}><InicioSaludo today={data.today} />{data.access.analysis?<Link className={styles.analysisLink} href="/gerencial"><IconChartBar size={19} aria-hidden="true" />Ver Centro de Mando<IconArrowUpRight size={16} aria-hidden="true" /></Link>:null}</header>
    {!data.complete?<div className={styles.warning} role="status"><div><strong>Verificación incompleta</strong><p>{missing.length?"No se pudo comprobar: "+missing.join(", ")+".":"No se pudo comprobar el saldo de Caja."} Los pendientes conocidos siguen visibles.</p></div><ReintentarButton /></div>:null}
    <div className={styles.topGrid}>
      {data.hasPriorityAccess?<section className={styles.priorities} aria-labelledby="prioridades-inicio"><div className={styles.sectionHeader}><div className={styles.sectionTitle}><h3 id="prioridades-inicio">Necesita atención</h3>{data.primary.length>0?<span className={styles.count}>{data.primary.length} temas</span>:null}</div><details className={styles.explanation}><summary aria-label="Cómo se ordenan las prioridades"><IconInfoCircle size={18} aria-hidden="true" /></summary><p>Primero compromisos vencidos, después los de hoy y las existencias. Se usan los criterios de Centro de Mando; abrir no resuelve una operación.</p></details></div><div className={styles.priorityList}>{data.primary.map((topic,index)=><Topic key={topic.id} topic={topic} index={index} today={data.today} />)}{data.primary.length===0?<div className={styles.empty}>{data.emptyVerified?<IconCheck size={24} aria-hidden="true" />:<IconInfoCircle size={24} aria-hidden="true" />}<p>{data.emptyVerified?"Sin pendientes urgentes en la información comprobada.":data.complete?"Revisa los otros pendientes y fechas por confirmar.":"Falta información para comprobar todos los pendientes."}</p></div>:null}</div></section>:<section className={styles.priorities}><h3 className={styles.simpleTitle}>{data.access.cash?"Tu información de Caja":"Inicio"}</h3><p className={styles.metricHint}>{data.access.cash?"Las cifras disponibles para tu cuenta aparecen abajo.":"Los apartados disponibles dependen de los permisos de tu cuenta."}</p></section>}
      {shortcuts.length>0?<aside className={styles.shortcuts} aria-labelledby="accesos-inicio"><div className={styles.shortcutHeading}><h3 id="accesos-inicio">¿Qué necesitas hacer?</h3><span>Tus apartados habituales</span></div><div className={styles.shortcutGrid}>{shortcuts.map(link=><Link key={link.href} href={link.href} className={styles.shortcut} data-tone={link.tone}><span className={styles.shortcutIcon}><link.icon size={23} aria-hidden="true" /></span><strong>{link.label}</strong><span>{link.detail}</span></Link>)}</div></aside>:null}
    </div>
    {data.access.cash||data.access.analysis||data.access.rentals?<section className={styles.figures} aria-labelledby="cifras-inicio"><div className={styles.figuresHeading}><h3 id="cifras-inicio">Resumen del negocio</h3></div><div className={styles.metricGrid}>
      {data.access.cash?<article className={styles.metric}><div className={styles.metricLabel}><span>Saldo registrado en Caja</span><IconWallet size={20} aria-hidden="true" /></div><p className={styles.metricNumber}>{money(data.cashBalance)}</p><p className={styles.metricHint}>Historial completo de empresa, igual que en Caja</p><Link className={styles.metricAction} href="/caja?vista=empresa">Ver movimientos<IconArrowUpRight size={13} aria-hidden="true" /></Link></article>:null}
      {data.access.analysis?<article className={styles.metric}><div className={styles.metricLabel}><span>Créditos por cobrar</span><IconCash size={20} aria-hidden="true" /></div><p className={styles.metricNumber}>{money(data.creditTotal)}</p><p className={styles.metricHint}>Saldos según los cobros vinculados en Caja</p>{data.creditTotal!==null?<><div className={styles.collectionBar} role="img" aria-label={"Del total por cobrar, "+money(data.overdue)+" vencido; "+money(data.inTime)+" en plazo y "+money(data.undated)+" sin fecha."}><span style={{width:data.creditTotal>0?Math.min(100,(data.overdue??0)/data.creditTotal*100)+"%":"0%"}} /></div><div className={styles.collectionLegend}><span>Vencido <b>{money(data.overdue)}</b></span><span>En plazo <b>{money(data.inTime)}</b></span>{(data.undated??0)>0?<span>Sin fecha <b>{money(data.undated)}</b></span>:null}</div></>:null}{data.unverifiedQuotes>0?<p className={styles.metricFootnote}>{data.unverifiedQuotes} cotizaciones marcadas en mora requieren revisión aparte; su importe no confirma un saldo.</p>:null}<details className={styles.metricDetails}><summary>Qué incluye <IconChevronDown size={13} aria-hidden="true" /></summary><p>Operaciones registradas como crédito en madera, muebles, alquileres y aserradero, descontando cobros vinculados. Las propuestas y los saldos de adelantos se revisan en sus apartados.</p></details><Link className={styles.metricAction} href="/gerencial?tab=hoy">Revisar cobros<IconArrowUpRight size={13} aria-hidden="true" /></Link></article>:null}
      {data.access.rentals ? (
        <article className={styles.metric} aria-labelledby="alquileres-inicio">
          <div className={styles.metricLabel}>
            <span id="alquileres-inicio">Alquileres</span>
            <IconCalendarClock size={20} aria-hidden="true" />
          </div>
          <p className={styles.metricNumber}>{data.rentals?.active ?? "No disponible"}</p>
          <p className={styles.metricHint} title="Contratos registrados como abiertos, incluidos los vencidos que aún no se han cerrado.">
            {data.rentals?.active === 1 ? "Contrato activo" : "Contratos activos"}
          </p>
          {data.rentals !== null ? (
            <>
              <div className={styles.rentalUpcoming}>
                <strong>{data.rentals.endingSoon}</strong>
                <span>Vencen en los próximos 7 días</span>
              </div>
              {data.rentals.undated > 0 ? (
                <p className={styles.metricFootnote}>{data.rentals.undated} sin fecha de término</p>
              ) : null}
            </>
          ) : null}
          <Link className={styles.metricAction} href="/ventas/alquiler-mixer">
            Ver contratos<IconArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </article>
      ) : null}
    </div></section>:null}
    {others > 0 ? (
      <nav className={styles.pendingIndicators} aria-label="Otros pendientes">
        {data.other.map(topic => {
          const display = pendingTopics[topic.id as keyof typeof pendingTopics]
            ?? { label: topic.title, icon: IconInfoCircle };
          return (
            <PendingLink
              key={topic.id}
              label={display.label}
              title={topic.title}
              count={topic.items.length}
              href={topic.href}
              icon={display.icon}
              urgent={topic.items.filter(item => item.priority === "alta").length}
            />
          );
        })}
        {(data.advances ?? 0) > 0 ? (
          <PendingLink
            label="Adelantos"
            title="Adelantos pendientes"
            count={data.advances!}
            href="/personal?adelantos=pendiente#adelantos-pendientes"
            icon={IconUsers}
          />
        ) : null}
      </nav>
    ) : null}
    <p className={styles.footer}>Información consultada al abrir o actualizar la pantalla. Los registros y operaciones se gestionan en sus apartados habituales.</p>
  </div>;
}
