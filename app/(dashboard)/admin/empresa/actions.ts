"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/runtime";

const EMPRESA_LOGOS_BUCKET = "empresa-logos";
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function objectPathFromPublicLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${EMPRESA_LOGOS_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

function isPngBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  const b = new Uint8Array(buf);
  return (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  );
}

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
  firmante_cargo: z.string().trim().min(2, "Ingresa el cargo del firmante."),
});

export async function updateEmpresaConfig(
  _prevState: EmpresaFormState,
  formData: FormData,
): Promise<EmpresaFormState> {
  const context = await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });
  if (!hasSupabaseEnv()) return { error: "La configuración de empresa requiere la conexión publicada. No se guardaron cambios desde la copia local." };

  const parsed = empresaSchema.safeParse({
    nombre: formData.get("nombre"),
    ruc: formData.get("ruc"),
    telefono: formData.get("telefono"),
    direccion: formData.get("direccion"),
    firmante: formData.get("firmante"),
    firmante_cargo: formData.get("firmante_cargo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos e intenta de nuevo." };
  }

  const supabase = getSupabaseServerClient();
  const { error: existingError } = await supabase
    .from("configuracion_empresa")
    .select("logo_url,margen_ganancia_default_pct")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (existingError) return { error: "No se pudo consultar la configuración anterior. No se guardaron cambios." };

  const payload = {
    organization_id: context.organizationId,
    nombre: parsed.data.nombre,
    ruc: parsed.data.ruc,
    telefono: parsed.data.telefono,
    direccion: parsed.data.direccion,
    firmante: parsed.data.firmante,
    firmante_cargo: parsed.data.firmante_cargo,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from("configuracion_empresa")
    .upsert(payload, { onConflict: "organization_id" })
    .select("organization_id").maybeSingle();

  if (error || !saved) {
    return { error: "No se pudo guardar la configuracion. Intenta de nuevo." };
  }

  revalidatePath("/admin/empresa");
  revalidatePath("/cotizacion");

  return { success: "Datos de empresa actualizados correctamente." };
}

export type EmpresaLogoFormState = {
  error?: string;
  success?: string;
};

export async function uploadEmpresaLogo(
  _prevState: EmpresaLogoFormState,
  formData: FormData,
): Promise<EmpresaLogoFormState> {
  const context = await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });
  if (!hasSupabaseEnv()) return { error: "La configuración de empresa requiere la conexión publicada. No se guardaron cambios desde la copia local." };

  const raw = formData.get("logo");
  if (!(raw instanceof File)) {
    return { error: "Selecciona un archivo PNG." };
  }

  if (raw.size > LOGO_MAX_BYTES) {
    return { error: "El archivo supera 2 MB. Usa un PNG mas liviano." };
  }

  if (raw.type !== "image/png") {
    return { error: "Solo se aceptan imagenes PNG." };
  }

  const buffer = await raw.arrayBuffer();
  if (!isPngBuffer(buffer)) {
    return { error: "El archivo no parece un PNG valido." };
  }

  const supabase = getSupabaseServerClient();
  const { data: row, error: readError } = await supabase
    .from("configuracion_empresa")
    .select("logo_url")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (readError) return { error: "No se pudo consultar el logo anterior. No se hicieron cambios." };
  const oldPath = objectPathFromPublicLogoUrl(
    typeof row?.logo_url === "string" ? row.logo_url : null,
  );

  const storagePath = `${context.organizationId}/${randomUUID()}.png`;
  const { error: upErr } = await supabase.storage
    .from(EMPRESA_LOGOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (upErr) {
    return { error: "No se pudo subir el logo. Intenta de nuevo." };
  }


  const { data: publicData } = supabase.storage.from(EMPRESA_LOGOS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;

  const { data: updatedRow, error: dbErr } = await supabase
    .from("configuracion_empresa")
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("organization_id", context.organizationId)
    .select("id")
    .maybeSingle();

  if (dbErr || !updatedRow) {
    await supabase.storage.from(EMPRESA_LOGOS_BUCKET).remove([storagePath]);
    return {
      error: dbErr
        ? "No se pudo guardar la URL del logo. Intenta de nuevo."
        : "No hay registro de empresa. Guarda primero los datos del emisor abajo.",
    };
  }

  if (oldPath?.startsWith(`${context.organizationId}/`)) await supabase.storage.from(EMPRESA_LOGOS_BUCKET).remove([oldPath]);

  revalidatePath("/admin/empresa");
  revalidatePath("/cotizacion");

  return { success: "Logo actualizado. Se mostrara en los PDFs de cotizacion y ventas." };
}

export async function clearEmpresaLogo(): Promise<EmpresaLogoFormState> {
  const context = await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });
  if (!hasSupabaseEnv()) return { error: "La configuración de empresa requiere la conexión publicada. No se guardaron cambios desde la copia local." };

  const supabase = getSupabaseServerClient();
  const { data: row, error: readError } = await supabase
    .from("configuracion_empresa")
    .select("logo_url")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (readError) return { error: "No se pudo consultar el logo anterior. No se hicieron cambios." };
  const path = objectPathFromPublicLogoUrl(
    typeof row?.logo_url === "string" ? row.logo_url : null,
  );

  const { data: cleared, error } = await supabase
    .from("configuracion_empresa")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("organization_id", context.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "No se pudo quitar el logo. Intenta de nuevo." };
  }

  if (!cleared) {
    return { error: "No hay registro de empresa. Guarda primero los datos del emisor." };
  }

  if (path?.startsWith(`${context.organizationId}/`)) await supabase.storage.from(EMPRESA_LOGOS_BUCKET).remove([path]);

  revalidatePath("/admin/empresa");
  revalidatePath("/cotizacion");

  return { success: "Se quito el logo. Los PDFs usaran el icono generico." };
}
