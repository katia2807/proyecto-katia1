import { EmpresaLogoUpload } from "@/components/admin/empresa-logo-upload";
import { EmpresaSettingsForm } from "@/components/admin/empresa-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth";
import { getEmpresaConfig } from "@/lib/company-config";

export default async function EmpresaPage() {
  await requireAuthContext({ allowedRoles: ["owner_admin"] });
  const empresa = await getEmpresaConfig();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Datos de empresa</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Estos datos se usan en cotizaciones y contratos PDF para mantener informacion legal
          consistente.
        </p>
      </div>

      <Card>
        <CardTitle>Logo en PDFs</CardTitle>
        <CardDescription>
          Solo <strong>owner_admin</strong> puede subir o quitar el logo. Visible en cotizaciones y documentos
          de ventas.
        </CardDescription>
        <div className="mt-4">
          <EmpresaLogoUpload empresa={empresa} />
        </div>
      </Card>

      <Card>
        <CardTitle>Configuracion de emisor</CardTitle>
        <CardDescription>
          Solo <strong>owner_admin</strong> puede editar nombre, RUC, telefono, direccion y firmante.
        </CardDescription>
        <div className="mt-4">
          <EmpresaSettingsForm empresa={empresa} />
        </div>
      </Card>
    </div>
  );
}
