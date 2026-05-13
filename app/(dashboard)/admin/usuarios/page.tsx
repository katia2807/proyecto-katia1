import Link from "next/link";
import { redirect } from "next/navigation";
import {
  InviteOrganizationUserForm,
  SetOrganizationUserActiveFormClient,
  UpdateOrganizationUserForm,
} from "@/components/admin/usuarios-admin-forms";
import { requireAuthContext } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/runtime";
import { canManageOrganizationUsers } from "@/lib/permissions";
import type { UiRoleSlug } from "@/lib/permissions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { listOrganizationUsers, type OrgUserRow } from "./actions";

function selectUiRole(row: OrgUserRow): UiRoleSlug {
  if (row.ui_role === "owner_admin" || row.ui_role === "operaciones" || row.ui_role === "readonly") {
    return row.ui_role;
  }
  if (row.role === "owner_admin") return "owner_admin";
  if (row.role === "partner_readonly") return "readonly";
  return "operaciones";
}

export default async function AdminUsuariosPage() {
  const ctx = await requireAuthContext();
  if (!canManageOrganizationUsers(ctx.role, ctx.uiRole)) {
    redirect("/");
  }

  const { data: users, error: listError } = await listOrganizationUsers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Usuarios de la organización</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Invita correos nuevos, ajusta nombre y rol funcional, o desactiva cuentas sin borrar datos.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold underline">
          ← Volver al inicio
        </Link>
      </div>

      {listError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {listError}
        </div>
      ) : null}

      {!hasSupabaseEnv() ? (
        <Card>
          <CardTitle>Supabase no configurado</CardTitle>
          <CardDescription>
            La gestión de usuarios con invitaciones por correo requiere variables de entorno de Supabase
            (URL, anon y service role).
          </CardDescription>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle>Invitar usuario</CardTitle>
            <CardDescription>
              Se envía un correo de invitación de Supabase. El rol &quot;Dueña&quot; no está disponible al
              crear usuarios nuevos.
            </CardDescription>
            <InviteOrganizationUserForm />
          </Card>

          <Card>
            <CardTitle>Usuarios ({users.length})</CardTitle>
            <CardDescription>
              Rol mostrado según <code className="text-xs">ui_role</code> y, si falta, el rol interno en base
              de datos.
            </CardDescription>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <th className="py-2 pr-3 font-medium">Correo</th>
                    <th className="py-2 pr-3 font-medium">Nombre y rol</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 font-medium">Cuenta</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => {
                    const effective = selectUiRole(row);
                    const inactive = Boolean(row.deactivated_at);
                    return (
                      <tr
                        key={row.user_id}
                        className={
                          inactive
                            ? "border-b border-[var(--color-border)] opacity-60"
                            : "border-b border-[var(--color-border)]"
                        }
                      >
                        <td className="max-w-[200px] py-3 pr-3 align-top break-all">{row.email ?? "—"}</td>
                        <td className="py-3 pr-3 align-top">
                          <UpdateOrganizationUserForm row={row} effectiveRole={effective} />
                        </td>
                        <td className="py-3 pr-3 align-middle">
                          {inactive ? (
                            <span className="rounded-full bg-[var(--color-danger)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]">
                              Inactivo
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              Activo
                            </span>
                          )}
                        </td>
                        <td className="py-3 align-top">
                          {inactive ? (
                            <SetOrganizationUserActiveFormClient
                              userId={row.user_id}
                              active
                              label="Reactivar"
                              variant="secondary"
                            />
                          ) : (
                            <SetOrganizationUserActiveFormClient
                              userId={row.user_id}
                              active={false}
                              label="Desactivar"
                              variant="danger"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!listError && users.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  No hay perfiles en esta organización todavía. Invita al primer usuario arriba.
                </p>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
