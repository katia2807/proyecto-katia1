import { redirect } from "next/navigation";

/**
 * Alias histórico: el módulo se renombró a "Muebles personalizados" y vive en
 * `/ventas/muebles-personalizados`. Cualquier link viejo (incluyendo el menú
 * lateral hasta que se actualice) redirige sin pérdida.
 */
export default function MueblesCorteAliasPage() {
  redirect("/ventas/muebles-personalizados");
}
