import Link from "next/link";
import { CajaContextPanels } from "@/components/caja/caja-context-panels";
import { CajaMasterDetail } from "@/components/caja/caja-master-detail";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getCajaRows } from "@/lib/data";
import { canMutateCaja } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";

type CajaPageProps = {
  searchParams?: Promise<{ vista?: string | string[] }>;
};

function normalizeVista(value: string | string[] | undefined): "todos" | "personal" | "empresa" {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "personal" || v === "empresa") return v;
  return "todos";
}

export default async function CajaPage({ searchParams }: CajaPageProps) {
  const vista = normalizeVista((await searchParams)?.vista);
  const allRows = await getCajaRows();
  const role = await getCurrentUserRole();
  const canMutate = canMutateCaja(role);

  const rows = allRows.filter((r) => {
    if (vista === "personal") return r.es_personal === true;
    if (vista === "empresa") return r.es_personal !== true;
    return true;
  });

  const totalEmpresa = allRows
    .filter((r) => !r.es_personal)
    .reduce((acc, r) => acc + (r.tipo === "ingreso" ? Number(r.monto) : -Number(r.monto)), 0);
  const totalPersonal = allRows.filter((r) => r.es_personal).reduce((acc, r) => acc + Number(r.monto), 0);

  const tabs: { value: typeof vista; label: string; hint: string }[] = [
    { value: "todos", label: "Todos", hint: `${allRows.length} movimientos` },
    { value: "empresa", label: "Empresa", hint: `Saldo neto ${formatPen(totalEmpresa)}` },
    { value: "personal", label: "Personal", hint: `Total ${formatPen(totalPersonal)} separado` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Caja</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Registro de ingresos y egresos. Saldo empresa:{" "}
          <span className={totalEmpresa >= 0 ? "font-semibold text-[var(--katia-success)]" : "font-semibold text-[var(--katia-danger)]"}>
            {formatPen(totalEmpresa)}
          </span>
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Nuevo movimiento con notas opcionales, medio, origen y comprobante.</CardDescription>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2">
            <CajaContextPanels />
          </div>
        ) : (
          <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
            Tu rol tiene vista de caja, pero no permisos para registrar movimientos.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const activo = tab.value === vista;
          const href = tab.value === "todos" ? "/caja" : `/caja?vista=${tab.value}`;
          return (
            <Link key={tab.value} href={href}>
              <button
                className={`rounded-xl border px-3 py-2 text-left ${
                  activo
                    ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]/40"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{tab.hint}</p>
              </button>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardTitle>Movimientos ({rows.length})</CardTitle>
        <CardDescription>
          {vista === "personal"
            ? "Solo gastos personales de la jefa, separados de la utilidad empresarial."
            : vista === "empresa"
              ? "Movimientos que si afectan la utilidad neta del taller."
              : "Vista combinada de personal y empresa."}
        </CardDescription>
        <div className="mt-4">
          <CajaMasterDetail rows={rows} userRole={role} />
        </div>
      </Card>
    </div>
  );
}
