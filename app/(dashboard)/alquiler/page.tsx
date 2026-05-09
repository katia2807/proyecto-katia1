import { redirect } from "next/navigation";

/**
 * Alias histórico: el módulo de alquiler de Bomba Mixer vive ahora en
 * `/ventas/alquiler-mixer` como contrato extendido. Mantenemos el redirect
 * para no romper enlaces, marcadores o el menú lateral hasta que se actualice.
 */
export default function AlquilerAliasPage() {
  redirect("/ventas/alquiler-mixer");
}
