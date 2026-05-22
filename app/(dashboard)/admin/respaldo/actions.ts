"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function resetDatabaseAction(confirmacion: string) {
  // 1. Validar autenticación y rol de administrador (owner_admin)
  const context = await requireAuthContext({
    allowedRoles: ["owner_admin"],
    redirectTo: null,
  });

  if (!context) {
    return { ok: false, error: "No autorizado. Sesión no encontrada o rol insuficiente." };
  }

  // 2. Validar frase de confirmación
  if (confirmacion !== "LIMPIAR") {
    return { ok: false, error: "Frase de confirmación incorrecta. Escribe LIMPIAR." };
  }

  const { organizationId, userId } = context;

  // 3. Inicializar cliente de Supabase (que usa service role para eludir RLS en borrados masivos)
  const supabase = getSupabaseServerClient();

  // 4. Tablas en el orden exacto solicitado (respetando foreign keys)
  const tables = [
    "inventario_movimientos",
    "ventas_madera_cortada",
    "ordenes_produccion",
    "movimientos_caja",
    "ventas_mueble_terminado",
    "cotizaciones_unificadas",
    "registros_generales",
    "alertas_operativas",
    "servicios_aserradero",
    "clientes",
    "choferes",
    "proveedores",
    "muebles_catalogo",
    "inventario_productos",
    "correlativos"
  ] as const;

  try {
    // 5. Ejecutar DELETE por cada tabla para la organización del usuario
    for (const table of tables) {
      const orgColumn = table === "correlativos" ? "org_id" : "organization_id";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(orgColumn, organizationId);

      if (error) {
        throw new Error(`Error al limpiar la tabla "${table}": ${error.message}`);
      }
    }

    // 6. Registrar la acción en audit_logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: auditError } = await supabase.from("audit_logs" as any).insert({
      organization_id: organizationId,
      user_id: userId,
      user_name: context.fullName || null,
      accion: "DATABASE_RESET",
      modulo: "database",
      entidad_id: null,
      detalles: {
        timestamp: new Date().toISOString(),
        tablas_limpiadas: tables,
        ejecutado_por: context.fullName || userId
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (auditError) {
      console.error("Error al registrar audit_logs:", auditError);
      // No arrojamos excepción aquí para no deshacer la eliminación de datos operativos
      // si solo falla el log complementario.
    }

    // Revalidar las rutas del dashboard para forzar la actualización de los componentes
    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Error durante reset de base de datos:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado al limpiar la base de datos.";
    return {
      ok: false,
      error: errorMessage
    };
  }
}
