"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type EmpresaFormState = {
  error?: string;
  success?: string;
};

const empresaSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresa el nombre de la empresa."),
  ruc: z.string().trim().min(8, "Ingresa un RUC valido."),
  telefono: z.string().trim().min(6, "Ingresa un telefono valido."),
  direccion: z.string().trim().min(4, "Ingresa la direccion de la empresa."),
  firmante: z.string().trim().min(2, "Ingresa el nombre del firmante."),
});

export async function updateEmpresaConfig(
  _prevState: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });

  const parsed = empresaSchema.safeParse({
    nombre: formData.get("nombre"),
    ruc: formData.get("ruc"),
    telefono: formData.get("telefono"),
    direccion: formData.get("direccion"),
    firmante: formData.get("firmante"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos e intenta de nuevo." };
  }

  const supabase = getSupabaseServerClient();
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    nombre: parsed.data.nombre,
    ruc: parsed.data.ruc,
    telefono: parsed.data.telefono,
    direccion: parsed.data.direccion,
    firmante: parsed.data.firmante,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("configuracion_empresa")
    .upsert(payload, { onConflict: "organization_id" });

  if (error) {
    return { error: "No se pudo guardar la configuracion. Intenta de nuevo." };
  }

  revalidatePath("/admin/empresa");
  revalidatePath("/cotizacion");

  return { success: "Datos de empresa actualizados correctamente." };
}
