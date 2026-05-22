import { AccountSettingsForm } from "@/components/auth/account-settings-form";
import { AccountTutorialButton } from "@/components/account-tutorial-button";
import { EmpresaLogoUpload } from "@/components/admin/empresa-logo-upload";
import { EmpresaSettingsForm } from "@/components/admin/empresa-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfiguracionTabs } from "@/components/configuracion/configuracion-tabs";
import { requireAuthContext } from "@/lib/auth";
import { getEmpresaConfig } from "@/lib/company-config";
import { getServiciosEspecialesTarifaRows } from "@/lib/data";
import { TarifasSettingsForm } from "@/components/configuracion/tarifas-settings-form";

export const dynamic = "force-dynamic";

type ConfiguracionPageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ConfiguracionPage({ searchParams }: ConfiguracionPageProps) {
  const params = await searchParams;
  const activeTab = firstParam(params?.tab) || "cuenta";

  const context = await requireAuthContext({ allowedRoles: ["owner_admin"] });
  const [empresa, tarifas] = await Promise.all([
    getEmpresaConfig(),
    getServiciosEspecialesTarifaRows(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Configuración</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Cuenta, empresa, seguridad y preferencias en un solo lugar.
        </p>
      </div>

      <ConfiguracionTabs activeTab={activeTab} />

      {/* ── CUENTA ── */}
      {activeTab === "cuenta" ? (
        <div className="space-y-6">
          <Card>
            <CardTitle>Credenciales de acceso</CardTitle>
            <CardDescription>
              Correo y nombre visible enlazados a tu cuenta. Para cambiar contraseña se requiere la actual.
            </CardDescription>
            <div className="mt-4">
              <AccountSettingsForm email={context.email ?? ""} fullName={context.fullName ?? ""} />
            </div>
          </Card>

          <Card>
            <CardTitle>Tour de bienvenida</CardTitle>
            <CardDescription>
              Reinicia el tour guiado del sistema para volver a recorrer las funciones principales.
            </CardDescription>
            <div className="mt-4">
              <AccountTutorialButton />
            </div>
          </Card>

          <Card>
            <CardTitle>Seguridad de cuenta</CardTitle>
            <CardDescription>
              El acceso usa el correo y contraseña configurados en el sistema. Para recuperar acceso,
              contacta al administrador del proyecto.
            </CardDescription>
          </Card>
        </div>
      ) : null}

      {/* ── EMPRESA ── */}
      {activeTab === "empresa" ? (
        <div className="space-y-6">
          <Card>
            <CardTitle>Logo en documentos</CardTitle>
            <CardDescription>
              Solo owner_admin puede subir o quitar el logo. Aparece en cotizaciones y documentos internos.
            </CardDescription>
            <div className="mt-4">
              <EmpresaLogoUpload empresa={empresa} />
            </div>
          </Card>

          <Card>
            <CardTitle>Datos del emisor</CardTitle>
            <CardDescription>
              Nombre, teléfono, dirección y firmante. Solo owner_admin puede editar.
            </CardDescription>
            <div className="mt-4">
              <EmpresaSettingsForm empresa={empresa} />
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── PREFERENCIAS ── */}
      {activeTab === "preferencias" ? (
        <div className="space-y-6">
          <Card>
            <CardTitle>Tema visual</CardTitle>
            <CardDescription>
              El tema oscuro o claro se puede cambiar desde el ícono en la barra superior en cualquier momento.
              La preferencia se guarda automáticamente.
            </CardDescription>
            <div className="mt-4 flex items-center gap-3 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] px-4 py-3">
              <span className="text-sm text-[var(--katia-text-secondary)]">
                Usa el ícono ☀️ / 🌙 en la barra superior derecha para cambiar el tema.
              </span>
            </div>
          </Card>

          <Card>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>
              Las notificaciones del sistema aparecen en el ícono de campana en la barra superior.
              Se generan automáticamente por eventos críticos: stock bajo, cobros vencidos, etc.
            </CardDescription>
          </Card>

          <Card>
            <CardTitle>Idioma</CardTitle>
            <CardDescription>
              El sistema opera completamente en español. Moneda: Soles peruanos (S/).
            </CardDescription>
          </Card>
        </div>
      ) : null}

      {/* ── TARIFAS ── */}
      {activeTab === "tarifas" ? (
        <div className="space-y-6">
          <Card>
            <CardTitle>Tarifas de servicios especiales</CardTitle>
            <CardDescription>
              {tarifas.length} servicios disponibles en el formulario de aserradero.
            </CardDescription>
            <div className="mt-4">
              <TarifasSettingsForm inicialTarifas={tarifas} />
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
