import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth";
import { buildNavHrefAllowlist } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();
  const displayName = context.fullName?.trim() || "Usuario";
  const navAllowlist = buildNavHrefAllowlist(context.role, context.uiRole);

  return (
    <AppShell
      navAllowlist={navAllowlist}
      uiRole={context.uiRole}
      userRole={context.role}
      userName={displayName}
    >
      {children}
    </AppShell>
  );
}
