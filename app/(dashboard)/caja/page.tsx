import Link from "next/link";
import { createCajaMovimiento, repetirGastosMesAnterior } from "@/app/actions";
import { voidFormAction } from "@/lib/void-form-action";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getCajaRows } from "@/lib/data";
import { canMutateCaja } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

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
  const totalPersonal = allRows
    .filter((r) => r.es_personal)
    .reduce((acc, r) => acc + Number(r.monto), 0);

  const tabs: { value: typeof vista; label: string; hint: string }[] = [
    { value: "todos", label: "Todos", hint: `${allRows.length} movimientos` },
    {
      value: "empresa",
      label: "Empresa",
      hint: `Saldo neto ${formatPen(totalEmpresa)}`,
    },
    {
      value: "personal",
      label: "Personal (jefa)",
      hint: `Total ${formatPen(totalPersonal)} (no afecta utilidad)`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Caja chica</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Ingresos, egresos, transferencias y pagos por Yape. Separa lo personal de la dueña para no
          ensuciar la utilidad empresarial.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Abre solo lo que necesitas en el momento.</CardDescription>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2">
            <ContextActionPanel
            triggerLabel="Registrar movimiento"
            title="Nuevo movimiento de caja"
            description="Ingreso, egreso o transferencia en un panel puntual."
          >
            <form action={createCajaMovimiento} className="grid gap-3 md:grid-cols-2">
              <Field name="fecha" type="date" label="Fecha" required />
              <SelectField name="tipo" label="Tipo" required defaultValue="ingreso">
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="transferencia">Transferencia</option>
              </SelectField>
              <SelectField name="medio" label="Medio" required defaultValue="efectivo">
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="banco">Banco</option>
                <option value="otro">Otro</option>
              </SelectField>
              <Field name="categoria" label="Categoría" placeholder="Ingresos por venta" required />
              <Field name="monto" label="Monto (S/)" type="number" min="0" step="0.01" required />
              <Field name="descripcion" label="Descripción" placeholder="Detalle opcional" />
              <div className="md:col-span-2">
                <FotoUpload
                  bucket="caja"
                  name="url_comprobante"
                  label="Adjuntar comprobante (PNG/JPG/PDF, opcional)"
                />
              </div>
              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name="es_personal" value="on" />
                <span>
                  Marcar como <strong>gasto personal de la jefa</strong> (no impacta utilidad)
                </span>
              </label>
              <div className="md:col-span-2">
                <PendingSubmitButton idleText="Registrar movimiento" />
              </div>
            </form>
          </ContextActionPanel>

            <ContextActionPanel
              presentation="dialog"
              triggerLabel="Repetir mes anterior"
              title="Replicar gastos recurrentes"
              description="Copia los egresos del mes pasado al mes actual con la misma fecha y monto."
            >
              <form action={voidFormAction(repetirGastosMesAnterior)} className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Útil para gastos fijos: luz, alquiler, planilla, internet, etc. Cada copia se
                  marca con el sufijo <em>(recurrente)</em>.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="incluir_personal" value="on" />
                  <span>Incluir también gastos personales de la jefa</span>
                </label>
                <PendingSubmitButton idleText="Generar copias del mes anterior" />
              </form>
            </ContextActionPanel>
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
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
              ? "Movimientos que sí afectan la utilidad neta del taller."
              : "Vista combinada de personal y empresa."}
        </CardDescription>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Tipo</TH>
                <TH>Medio</TH>
                <TH>Categoría</TH>
                <TH>Marca</TH>
                <TH>Comprobante</TH>
                <TH className="text-right">Monto</TH>
              </TRow>
            </THead>
            <tbody>
              {rows.map((row) => (
                <TRow key={row.id}>
                  <TD>{formatDate(row.fecha)}</TD>
                  <TD className="capitalize">{row.tipo}</TD>
                  <TD className="capitalize">{row.medio}</TD>
                  <TD>
                    {row.categoria}
                    {row.descripcion ? (
                      <p className="text-xs text-[var(--color-text-secondary)]">{row.descripcion}</p>
                    ) : null}
                  </TD>
                  <TD>
                    {row.es_personal ? (
                      <Badge variant="warning">Personal</Badge>
                    ) : (
                      <Badge variant="neutral">Empresa</Badge>
                    )}
                  </TD>
                  <TD>
                    {row.url_comprobante ? (
                      <Link
                        href={row.url_comprobante}
                        target="_blank"
                        className="text-xs text-[var(--color-accent)] underline"
                      >
                        Ver
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                    )}
                  </TD>
                  <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                </TRow>
              ))}
              {rows.length === 0 ? (
                <TRow>
                  <TD colSpan={7} className="text-center text-[var(--color-text-secondary)]">
                    Sin movimientos en esta vista.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
