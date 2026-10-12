import { createHash } from 'node:crypto';
import { z } from 'zod';
import { hasSupabaseEnv } from '@/lib/runtime';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mensajeOperacionFinanciera } from '@/lib/ventas-pago';
import type { demoCreateCotizacionUnificada } from '@/lib/demo-store';

export const cotizacionUnificadaIdentidadSchema = z.object({
  id: z.uuid().optional(),
  submissionId: z.uuid().optional(),
  clienteId: z.uuid(),
  tipoCliente: z.enum(['natural', 'empresa']),
  fecha: z.iso.date(),
  estadoFlujo: z.enum(['pendiente', 'lista_produccion']),
}).refine(data => Boolean(data.id || data.submissionId), {
  message: 'Vuelve a abrir la cotización antes de guardarla.',
});

type Actor = { organizationId: string; userId: string };
type Datos = Parameters<typeof demoCreateCotizacionUnificada>[0];

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

/** La clave identifica el envío inicial, no una coincidencia entre dos presupuestos. */
export async function registrarCotizacionUnificada(actor: Actor, clave: string, datos: Datos): Promise<string> {
  if (hasSupabaseEnv()) {
    const { organization_id: _org, ...documento } = datos;
    void _org;
    const { data, error } = await getSupabaseServerClient().rpc('registrar_cotizacion_unificada_segura', {
      p_org: actor.organizationId, p_actor: actor.userId, p_clave: clave, p_datos: documento,
    });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
    if (typeof data !== 'string') throw new Error('No se pudo confirmar el guardado. Reintenta sin cerrar la cotización.');
    return data;
  }
  const d = await import('@/lib/demo-store');
  const { correlativo: _correlativo, ...contenido } = datos;
  void _correlativo;
  const firma = createHash('sha256').update(JSON.stringify(canonical(contenido))).digest('hex');
  const id = d.demoEjecutarSolicitud(clave, actor.organizationId, 'cotizacion_unificada', firma, () => {
    if (!d.demoClientesRows().some(c => c.id === datos.cliente_id && c.organization_id === actor.organizationId)) {
      throw new Error('Cliente no encontrado en esta empresa.');
    }
    return d.demoCreateCotizacionUnificada(datos).id;
  });
  if (!d.demoGetCotizacionUnificada(id)) throw new Error('La cotización de este envío ya fue eliminada. Abre una nueva.');
  return id;
}
