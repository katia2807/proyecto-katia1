import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";
export default async function ReporteAntifraudePage() {
  await requirePageAccess("/reportes");
  redirect("/reportes?tab=antifraude");
}
