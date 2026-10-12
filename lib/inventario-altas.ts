import { createHash } from 'node:crypto';
import { hasSupabaseEnv } from '@/lib/runtime';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mensajeOperacionFinanciera } from '@/lib/ventas-pago';

type Actor = { userId: string; organizationId: string };
type Tipo = 'producto_inventario' | 'movimiento_inventario';
type Datos = Record<string, unknown>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, canonical(val)]));
  return value;
}

/** Producto y carga inicial, o movimiento manual: una confirmación por envío. No registra dinero. */
export async function registrarAltaInventario(actor: Actor, tipo: Tipo, clave: string, datos: Datos) {
  if (hasSupabaseEnv()) {
    const { data, error } = await getSupabaseServerClient().rpc('registrar_alta_inventario_segura', {
      p_org: actor.organizationId, p_actor: actor.userId, p_tipo: tipo, p_clave: clave, p_datos: datos,
    });
    if (error) throw new Error(mensajeOperacionFinanciera(error));
    if (typeof data !== 'string') throw new Error('No se pudo confirmar el guardado. Reintenta sin cerrar el formulario.');
    return data;
  }
  const d = await import('@/lib/demo-store');
  const firma = createHash('sha256').update(JSON.stringify(canonical(datos))).digest('hex');
  const id = d.demoEjecutarSolicitud(clave, actor.organizationId, tipo, firma, () => {
    if (tipo === 'producto_inventario') {
      let codigo = String(datos.codigo);
      if (datos.codigo_automatico === true) {
        if (!/^[A-Z]{3}-[A-Z]{3}-[0-9]{4}-###$/.test(codigo)) throw new Error('Código sugerido inválido. Revisa el nombre del producto.');
        const prefix = codigo.slice(0, -3);
        let sequence = BigInt(0);
        for (const p of d.demoInventarioProductosRows()) {
          if (p.organization_id !== actor.organizationId || !p.codigo.startsWith(prefix)) continue;
          const suffix = p.codigo.slice(prefix.length);
          if (/^[0-9]+$/.test(suffix)) sequence = BigInt(suffix) > sequence ? BigInt(suffix) : sequence;
        }
        codigo = prefix + String(sequence + BigInt(1)).padStart(3, '0');
      }
      if (d.demoInventarioProductosRows().some(p => p.organization_id === actor.organizationId && p.codigo === codigo)) {
        throw new Error('Ya existe un producto con este código. Usa otro código o abre el producto existente.');
      }
      const { stock_inicial, fecha, codigo_automatico: _automatico, ...producto } = datos;
      void _automatico;
      producto.codigo = codigo;
      const newId = d.demoCreateInventarioProducto({ ...producto, id: clave, organization_id: actor.organizationId } as Parameters<typeof d.demoCreateInventarioProducto>[0]);
      if (Number(stock_inicial) > 0) d.demoCreateInventarioMovimiento({ organization_id: actor.organizationId,
        producto_id: newId, fecha: String(fecha), tipo: 'entrada_compra', cantidad: Number(stock_inicial),
        costo_unitario: datos.costo_unitario == null ? null : Number(datos.costo_unitario), referencia: 'Carga inicial de inventario' });
      return newId;
    }
    return d.demoCreateInventarioMovimiento({ ...datos, organization_id: actor.organizationId } as Parameters<typeof d.demoCreateInventarioMovimiento>[0]).id;
  });
  const existe = tipo === 'producto_inventario'
    ? d.demoInventarioProductosRows().some(p => p.id === id && p.organization_id === actor.organizationId)
    : d.demoInventarioMovimientosRows().some(m => m.id === id && m.organization_id === actor.organizationId);
  if (!existe) throw new Error('Este envío ya se guardó y después se eliminó. Abre un formulario nuevo.');
  return id;
}
