"use server";
import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/runtime";
export async function resetDatabaseAction(confirmacion: string) {
  const context = await requireAuthContext({ allowedRoles:["owner_admin"],redirectTo:null });
  if (confirmacion !== "LIMPIAR") return {ok:false,error:"Frase de confirmación incorrecta. Escribe LIMPIAR."};
  if (!hasSupabaseEnv()) return {ok:false,error:"Esta limpieza solo corresponde a la base de producción."};
  // Una transacción: nunca volver al borrado por tablas.
  const {error} = await getSupabaseServerClient().rpc("limpiar_datos_operativos_atomico",{p_organization_id:context.organizationId,p_user_id:context.userId,p_user_name:context.fullName});
  if (error) return {ok:false,error:"No se pudo confirmar la limpieza. Comprueba el estado de los datos y que la actualización de base de datos esté instalada antes de reintentar."};
  revalidatePath("/","layout");
  return {ok:true};
}
