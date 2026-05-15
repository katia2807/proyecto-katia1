import Link from "next/link";
import { ImportReviewer } from "@/components/admin/import-reviewer";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function ImportarPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Importar documentos</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Extrae datos de PDF, Excel o documentos y exige revision humana antes de guardar.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold underline">
          Volver al inicio
        </Link>
      </div>

      <ImportReviewer />

      <Card>
        <CardTitle>Regla de seguridad</CardTitle>
        <CardDescription>
          Este flujo nunca guarda automaticamente. Los datos ambiguos se resaltan en amarillo hasta corregir fecha, monto
          o medio de pago.
        </CardDescription>
      </Card>
    </div>
  );
}
