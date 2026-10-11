import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hasSupabaseEnv } from '@/lib/runtime';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mensajeOperacionFinanciera } from '@/lib/ventas-pago';
type Actor = {
    userId: string;
    organizationId: string;
};
export type TipoOperacion = 'compra_inventario' | 'venta_madera' | 'venta_mueble' | 'venta_madera_cortada';
export type TipoAnulacion = Exclude<TipoOperacion, 'compra_inventario'> | 'aserradero' | 'alquiler';
type Fila = Record<string, unknown>;
export type OperacionIntegral = {
    tipo: TipoOperacion;
    clave: string;
    documento: Fila;
    lineas?: Fila[];
    stock?: Fila[];
    caja?: Fila | null;
};
export function claveOperacion(data: FormData, requerida = false) {
    const value = data.get('submission_id');
    if (!value && requerida) throw new Error('Actualiza la página y vuelve a abrir el formulario antes de guardar.');
    if (!value)
        return randomUUID();
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success)
        throw new Error('Identificador de solicitud inválido. Abre el formulario nuevamente.');
    return parsed.data;
}
export async function nombreClienteOperacion(id: string, organizationId: string) {
    if (!hasSupabaseEnv()) {
        const d = await import('@/lib/demo-store');
        const cliente = d.demoClientesRows().find(c => c.id === id && c.organization_id === organizationId);
        if (!cliente)
            throw new Error('Cliente no encontrado en esta empresa.');
        return cliente.nombre;
    }
    const { data, error } = await getSupabaseServerClient().from('clientes').select('nombre').eq('id', id).eq('organization_id', organizationId).maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data)
        throw new Error('Cliente no encontrado en esta empresa.');
    return data.nombre as string;
}
const modulo = (tipo: TipoOperacion) => ({ compra_inventario: 'inventario', venta_madera: 'ventas_madera',
    venta_mueble: 'ventas_muebles_terminados', venta_madera_cortada: 'ventas_madera_cortada' })[tipo];
// Orden estable; el correlativo nuevo de un reintento no cambia su contenido comercial.
function canonical(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
    return value;
}
export async function registrarOperacionIntegral(actor: Actor, input: OperacionIntegral): Promise<string> {
    const { tipo, clave, documento, caja = null, stock = [], lineas = [] } = input;
    if (hasSupabaseEnv()) {
        const { data, error } = await getSupabaseServerClient().rpc('registrar_operacion_integral', {
            p_org: actor.organizationId, p_actor: actor.userId, p_tipo: tipo, p_clave: clave,
            p_documento: documento, p_lineas: lineas, p_stock: stock, p_caja: caja,
        });
        if (error)
            throw new Error(mensajeOperacionFinanciera(error));
        if (typeof data !== 'string')
            throw new Error('No se pudo confirmar el registro. Reintenta sin cerrar el formulario.');
        return data;
    }
    const d = await import('@/lib/demo-store');
    const content = { documento: Object.fromEntries(Object.entries(documento).filter(([k]) => k !== 'id' && k !== 'correlativo')), caja, stock, lineas };
    const firma = createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
    return d.demoEjecutarSolicitud(clave, actor.organizationId, tipo, firma, () => {
        d.demoComprobarPeriodoAbierto(actor.organizationId, String(documento.fecha));
        if (tipo !== 'compra_inventario' && !d.demoClientesRows().some(c => c.id === documento.cliente_id && c.organization_id === actor.organizationId))
            throw new Error('Cliente no encontrado en esta empresa.');
        for (const item of stock) {
            const producto = d.demoInventarioProductosRows().find(p => p.id === item.producto_id && p.organization_id === actor.organizationId);
            if (!producto)
                throw new Error('Producto de inventario no encontrado.');
            if (!Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0)
                throw new Error('Cantidad de inventario inválida.');
            if (tipo !== 'compra_inventario' && Number(item.cantidad) > producto.stock_actual)
                throw new Error('Stock insuficiente. Actualiza las existencias antes de registrar.');
        }
        let id: string;
        if (tipo === 'compra_inventario') {
            if (stock.length !== 1)
                throw new Error('La compra requiere un producto.');
            id = d.demoCreateInventarioMovimiento({ ...stock[0], organization_id: actor.organizationId, fecha: documento.fecha, tipo: 'entrada_compra' } as Parameters<typeof d.demoCreateInventarioMovimiento>[0]).id;
        }
        else {
            const row = { ...documento, organization_id: actor.organizationId, confirmaIngreso: false };
            if (tipo === 'venta_madera')
                id = d.demoCreateVenta(row as Parameters<typeof d.demoCreateVenta>[0]).id;
            else if (tipo === 'venta_mueble')
                id = d.demoCreateVentaMuebleTerminado(row as Parameters<typeof d.demoCreateVentaMuebleTerminado>[0]).id;
            else
                id = d.demoCreateVentaMaderaCortada({ ...row, adelanto: Number(caja?.monto ?? 0) } as unknown as Parameters<typeof d.demoCreateVentaMaderaCortada>[0], { registrarMovimientos: false }).id;
            for (const item of stock)
                d.demoCreateInventarioMovimiento({ ...item, organization_id: actor.organizationId,
                    fecha: documento.fecha, tipo: 'salida_venta', referencia: `${tipo === 'venta_madera' ? 'venta' : 'venta_madera_cortada'}:${id}` } as Parameters<typeof d.demoCreateInventarioMovimiento>[0]);
        }
        if (caja)
            d.demoCreateCaja({ ...caja, organization_id: actor.organizationId, referencia_id: id, modulo_origen: modulo(tipo) } as Parameters<typeof d.demoCreateCaja>[0]);
        return id;
    });
}
export async function anularOperacionIntegral(actor: Actor, tipo: TipoAnulacion, id: string): Promise<void> {
    if (!z.uuid().safeParse(id).success)
        throw new Error('Identificador inválido.');
    if (hasSupabaseEnv()) {
        const { error } = await getSupabaseServerClient().rpc('anular_operacion_integral', { p_org: actor.organizationId, p_actor: actor.userId, p_tipo: tipo, p_id: id });
        if (error)
            throw new Error(mensajeOperacionFinanciera(error));
        return;
    }
    const d = await import('@/lib/demo-store');
    d.demoAnularOperacionIntegral(actor.organizationId, tipo, id);
}
