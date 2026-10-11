import { createHash } from 'node:crypto';
import { hasSupabaseEnv } from '@/lib/runtime';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mensajeOperacionFinanciera } from '@/lib/ventas-pago';
import type { demoCreateCotizacion } from '@/lib/demo-store';

type Actor = { userId: string; organizationId: string };
type Datos = Omit<Parameters<typeof demoCreateCotizacion>[0], 'organization_id' | 'id'>;

/** El mismo envío guarda una cotización; aceptar el presupuesto no es recibir dinero. */
export async function registrarCotizacionRapida(actor: Actor, clave: string, datos: Datos): Promise<string> {
  if (hasSupabaseEnv()) {
    const { data, error } = await getSupabaseServerClient().rpc('registrar_cotizacion_rapida_segura', {
      p_org: actor.organizationId, p_actor: actor.userId, p_clave: clave, p_datos: datos,
    });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
    if (typeof data !== 'string') throw new Error('No se pudo confirmar la cotización. Reintenta sin cerrar el formulario.');
    return data;
  }
  const d = await import('@/lib/demo-store');
  const contenido = Object.fromEntries(Object.entries(datos).filter(([key]) => key !== 'correlativo').sort(([a], [b]) => a.localeCompare(b)));
  const firma = createHash('sha256').update(JSON.stringify(contenido)).digest('hex');
  const id = d.demoEjecutarSolicitud(clave, actor.organizationId, 'cotizacion_rapida', firma, () => {
    if (!d.demoClientesRows().some(c => c.id === datos.cliente_id && c.organization_id === actor.organizationId)) {
      throw new Error('Cliente no encontrado en esta empresa.');
    }
    return d.demoCreateCotizacion({ ...datos, id: clave, organization_id: actor.organizationId }).id;
  });
  if (!d.demoCotizacionesRows().some(c => c.id === id && c.organization_id === actor.organizationId)) {
    throw new Error('La cotización de este envío ya fue eliminada. Abre un formulario nuevo.');
  }
  return id;
}
