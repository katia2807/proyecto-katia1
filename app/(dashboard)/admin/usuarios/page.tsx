import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/runtime";
import { canManageOrganizationUsers } from "@/lib/permissions";
import type { UiRoleSlug } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import {
  createOrganizationUserForm,
  listOrganizationUsers,
  setOrganizationUserActiveForm,
  updateOrganizationUserForm,
  type OrgUserRow,
} from "./actions";

function selectUiRole(row: OrgUserRow): UiRoleSlug {
  if (row.ui_role === "owner_admin" || row.ui_role === "operaciones" || row.ui_role === "readonly") {
    return row.ui_role;
  }
  if (row.role === "owner_admin") return "owner_admin";
  if (row.role === "partner_readonly") return "readonly";
  return "operaciones";
}

function roleLabel(slug: UiRoleSlug): string {
  switch (slug) {
    case "owner_admin":
      return "Dueña (total)";
    case "operaciones":
      return "Operaciones";
    case "readonly":
      return "Solo lectura";
    default:
      return slug;
  }
}

export default async function AdminUsuariosPage() {
  const ctx = await requireAuthContext();
  if (!canManageOrganizationUsers(ctx.role, ctx.uiRole)) {
    redirect("/");
  }

  const users = await listOrganizationUsers();

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
            <form action={createOrganizationUserForm} className="mt-4 grid gap-3 md:grid-cols-2">
              <Field name="full_name" label="Nombre completo" required placeholder="Nombre y apellido" />
              <Field
                name="email"
                label="Correo"
                type="email"
                required
                autoComplete="email"
                placeholder="correo@ejemplo.com"
              />
              <SelectField name="ui_role" label="Rol" required defaultValue="operaciones">
                <option value="operaciones">{roleLabel("operaciones")}</option>
                <option value="readonly">{roleLabel("readonly")}</option>
              </SelectField>
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto">
                  Enviar invitación
                </Button>
              </div>
            </form>
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
                          <form
                            action={updateOrganizationUserForm}
                            className="grid max-w-lg gap-3 sm:grid-cols-2 sm:items-end"
                          >
                            <input type="hidden" name="user_id" value={row.user_id} />
                            <Field
                              name="full_name"
                              label="Nombre"
                              defaultValue={row.full_name ?? ""}
                              required
                            />
                            <SelectField name="ui_role" label="Rol" defaultValue={effective}>
                              <option value="owner_admin">{roleLabel("owner_admin")}</option>
                              <option value="operaciones">{roleLabel("operaciones")}</option>
                              <option value="readonly">{roleLabel("readonly")}</option>
                            </SelectField>
                            <div className="flex flex-col gap-1 sm:col-span-2">
                              <Button type="submit" variant="secondary" className="w-fit">
                                Guardar cambios
                              </Button>
                              {!row.ui_role ? (
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                  Perfil sin <code className="text-[11px]">ui_role</code> en BD (mapeo legado).
                                </span>
                              ) : null}
                            </div>
                          </form>
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
                            <form action={setOrganizationUserActiveForm}>
                              <input type="hidden" name="user_id" value={row.user_id} />
                              <input type="hidden" name="active" value="true" />
                              <Button type="submit" variant="secondary" className="!h-9 !px-3 !text-xs">
                                Reactivar
                              </Button>
                            </form>
                          ) : (
                            <form action={setOrganizationUserActiveForm}>
                              <input type="hidden" name="user_id" value={row.user_id} />
                              <input type="hidden" name="active" value="false" />
                              <Button type="submit" variant="danger" className="!h-9 !px-3 !text-xs">
                                Desactivar
                              </Button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                  No hay usuarios listados o aún no hay perfiles en esta organización.
                </p>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
