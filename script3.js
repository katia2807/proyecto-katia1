const fs = require('fs');
let file = fs.readFileSync('app/actions.ts', 'utf8');

// Add demoUpdateClienteEstado to imports
file = file.replace(/  demoDeleteCotizacionMueblePersonalizada,\n  demoDeleteCotizacionUnificada,/g, '  demoDeleteCotizacionMueblePersonalizada,\n  demoDeleteCotizacionUnificada,\n  demoUpdateClienteEstado,');

// Modify deleteCotizacionMueblePersonalizada
const checkClienteState = `    const { data: row, error: selErr } = await supabase
      .from("cotizaciones_mueble")
      .select("id, tipo, cliente_id")
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    if (selErr) {
      return { ok: false, error: selErr.message };
    }
    if (!row) {
      return { ok: false, error: "Cotización no encontrada." };
    }
    if (row.tipo !== "mueble_personalizado") {
      return {
        ok: false,
        error: "Solo se pueden eliminar cotizaciones de mueble personalizado desde este listado.",
      };
    }
    const { data: cliente } = await supabase.from("clientes").select("estado").eq("id", row.cliente_id).maybeSingle();
    if (cliente && cliente.estado === "activo") {
      return { ok: false, error: "El cliente está activo. Cambie su estado manualmente." };
    }`;

file = file.replace(/    const \{ data: row, error: selErr \} = await supabase\n      \.from\("cotizaciones_mueble"\)\n      \.select\("id, tipo"\)\n      \.eq\("id", id\)\n      \.eq\("organization_id", DEFAULT_ORG_ID\)\n      \.maybeSingle\(\);\n    if \(selErr\) \{\n      return \{ ok: false, error: selErr\.message \};\n    \}\n    if \(\!row\) \{\n      return \{ ok: false, error: "Cotización no encontrada\." \};\n    \}\n    if \(row\.tipo \!== "mueble_personalizado"\) \{\n      return \{\n        ok: false,\n        error: "Solo se pueden eliminar cotizaciones de mueble personalizado desde este listado\.",\n      \};\n    \}/g, checkClienteState);

const updateClienteEstadoFn = `
export async function updateClienteEstado(formData: FormData) {
  await requireMutationAccess(ventasRoles);
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !["activo", "inactivo", "moroso"].includes(estado)) {
    throw new Error("Datos inválidos.");
  }
  if (!hasSupabaseEnv()) {
    demoUpdateClienteEstado(id, estado as "activo" | "inactivo" | "moroso");
  } else {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("clientes")
      .update({ estado })
      .eq("id", id)
      .eq("organization_id", DEFAULT_ORG_ID);
    if (error) {
      throw new Error(error.message);
    }
  }
  revalidatePath("/ventas/clientes");
  revalidatePath(\`/ventas/clientes/\${id}\`);
}
`;

file = file + updateClienteEstadoFn;

fs.writeFileSync('app/actions.ts', file);
