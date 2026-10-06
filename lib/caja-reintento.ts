import type { Database } from "@/lib/supabase/types";

type CajaRow = Database["public"]["Tables"]["movimientos_caja"]["Row"];
type CajaEnvio = Pick<CajaRow, "id" | "organization_id" | "fecha" | "tipo" | "medio" | "categoria" | "monto" | "descripcion" | "es_personal" | "url_comprobante" | "tipo_comprobante">;
type CajaGuardada = CajaEnvio & Pick<CajaRow, "modulo_origen" | "referencia_id" | "voided_at"> & { deleted_at?: string | null };

export const CAJA_REINTENTO_CONFLICTO = "Este envío ya fue registrado con otros datos o dejó de estar disponible. Actualiza Caja y revísalo antes de registrar otro movimiento.";

/** Un reintento confirma el registro original; nunca actualiza sus datos. */
export function cajaReintentoCoincide(guardada: CajaGuardada, envio: CajaEnvio): boolean {
  return !guardada.deleted_at && !guardada.voided_at && guardada.modulo_origen === "caja" && guardada.referencia_id === null
    && guardada.id === envio.id && guardada.organization_id === envio.organization_id
    && guardada.fecha === envio.fecha && guardada.tipo === envio.tipo && guardada.medio === envio.medio
    && guardada.categoria === envio.categoria && Number(guardada.monto) === envio.monto
    && (guardada.descripcion ?? "") === (envio.descripcion ?? "") && guardada.es_personal === envio.es_personal
    && (guardada.url_comprobante ?? "") === (envio.url_comprobante ?? "")
    && (guardada.tipo_comprobante ?? "ninguno") === envio.tipo_comprobante;
}
