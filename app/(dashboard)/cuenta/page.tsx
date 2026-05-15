import { AccountSettingsForm } from "@/components/auth/account-settings-form";
import { AccountTutorialButton } from "@/components/account-tutorial-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth";

export default async function CuentaPage() {
  const context = await requireAuthContext({ allowedRoles: ["owner_admin"] });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Cuenta administradora</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Correo y nombre visible enlazados a Supabase Auth y la tabla <code>perfiles</code>. Para cambiar la contraseña se
          solicita la actual.
        </p>
      </div>

      <Card>
        <CardTitle>Credenciales Supabase</CardTitle>
        <CardDescription>
          El inicio de sesión usa el correo y la contraseña del usuario en Supabase Auth. El rol <strong>owner_admin</strong>{" "}
          debe estar asignado en <code>perfiles</code> para esta organización.
        </CardDescription>
        <div className="mt-4">
          <AccountSettingsForm email={context.email ?? ""} fullName={context.fullName ?? ""} />
        </div>
      </Card>

      <Card>
        <CardTitle>Regla de seguridad</CardTitle>
        <CardDescription>
          No hay restablecimiento público de contraseña en esta pantalla más allá del cambio autenticado. Para recuperar
          acceso, usa la recuperación de Supabase Auth en el proyecto o contacta al administrador del proyecto.
        </CardDescription>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Tutorial</CardTitle>
          <CardDescription>Reactiva el banner de primeros pasos en el dashboard.</CardDescription>
        </div>
        <AccountTutorialButton />
      </Card>
    </div>
  );
}
