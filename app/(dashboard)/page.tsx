import Link from "next/link";
import { requireAuthContext } from "@/lib/auth";
import { getInicioResumenData } from "@/lib/inicio-resumen-data";
import { InicioResumenView } from "@/components/inicio/inicio-resumen";
import { isInicioResumenPreview } from "@/lib/inicio-resumen-preview";
type Props={searchParams?:Promise<{mensaje?:string|string[];vista?:string|string[]}>};
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]??"":value??"";
export default async function DashboardPage({searchParams}:Props) {
  const context=await requireAuthContext(),params=await searchParams;
  if(isInicioResumenPreview() && first(params?.vista)==="actual") {
    const {default:InicioAnterior}=await import("@/components/inicio/inicio-anterior");
    return <InicioAnterior searchParams={Promise.resolve({mensaje:params?.mensaje,vista:"actual"})} />;
  }
  const data=await getInicioResumenData(context);
  return <>{isInicioResumenPreview()?<div className="mb-4 text-xs text-[var(--katia-text-secondary)]">Inicio conectado al almacén local de pruebas · <Link className="underline" href="/?vista=actual">Comparar con Inicio anterior</Link></div>:null}<InicioResumenView data={data} noAccess={first(params?.mensaje)==="no-acceso"} /></>;
}
