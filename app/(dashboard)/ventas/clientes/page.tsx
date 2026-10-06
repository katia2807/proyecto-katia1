import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Table, TH, THead } from "@/components/ui/table";
import { ClientesMasterDetail } from "@/components/ventas/clientes-master-detail";
import { NuevoClienteInline } from "@/components/ventas/nuevo-cliente-inline";
import { RegistrarChoferInline, ChoferRowWrapper } from "@/components/ventas/registrar-chofer-inline";
import { RegistrarProveedorInline, ProveedorRowWrapper } from "@/components/ventas/registrar-proveedor-inline";
import {
  getChoferesRows,
  getChoferTiposVehiculo,
  getClientesRows,
  getProveedoresRows,
  getProveedorTipos,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { getClienteHistorial, resumenClientes } from "@/lib/clientes-data";
import { CLIENTE_ESTADOS, clientesHref, coincideCliente, filtrosClientes } from "@/lib/clientes-model";

type PageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    q?: string | string[];
    tipo?: string | string[];
    estado?: string | string[];
  }>;
};

const TABS = [
  { id: "compradores", label: "Compradores y clientes" },
  { id: "base_datos",  label: "Choferes / Proveedores" },
] as const;

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filtros = filtrosClientes(params);
  const { tab, q, tipo, estado } = filtros;

  const [clientes, historial, choferes, proveedores, tiposChofer, tiposProveedor] =
    await Promise.all([
      getClientesRows(),
      getClienteHistorial(),
      getChoferesRows(),
      getProveedoresRows(),
      getChoferTiposVehiculo(),
      getProveedorTipos(),
    ]);
  const totales = resumenClientes(historial);
  const cobros = clientes.reduce((acc, c) => acc + (totales.get(c.id)?.cobrosVencidos ?? 0), 0);

  const filtrados = clientes
    .filter((c) => coincideCliente(c, filtros))
    .sort((a, b) => (totales.get(b.id)?.total ?? 0) - (totales.get(a.id)?.total ?? 0));

  const clientesDetalle = filtrados.map((c) => {
    const t = totales.get(c.id);
    return {
      ...c,
      operaciones: t?.operaciones ?? 0,
      facturado: t?.total ?? 0,
      importesPorDefinir: t?.importesPorDefinir ?? 0,
      pedidosActivos: t?.pedidosActivos ?? 0,
      pagosPendientes: t?.cobrosVencidos ?? 0,
    };
  });

  const tabCounts: Record<string, number> = {
    compradores: clientes.length,
    base_datos:  choferes.length + proveedores.length,
  };

  const tabHref = (id: "compradores" | "base_datos") => clientesHref({ ...filtros, tab: id });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
            Clientes y Base de datos
          </h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            Compradores, choferes contratados y proveedores de la empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "compradores" && <NuevoClienteInline />}
          <Link href="/ventas">
            <Button type="button" variant="ghost" size="sm">← Ventas</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            className={cn(
              "flex flex-shrink-0 items-center gap-1.5 rounded-[calc(var(--katia-radius-md)-2px)] px-4 py-1.5 text-sm font-medium transition-all duration-150",
              tab === t.id
                ? "bg-[var(--katia-primary-soft)] text-[var(--katia-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                : "text-[var(--katia-text-secondary)] hover:bg-[var(--katia-glass-bg)] hover:text-[var(--katia-text-primary)]",
            )}
          >
            {t.label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              tab === t.id
                ? "bg-[var(--katia-primary)] text-white"
                : "bg-[var(--katia-surface-raised)] text-[var(--katia-text-tertiary)]",
            )}>
              {tabCounts[t.id] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {/* ── COMPRADORES ── */}
      {tab === "compradores" && (
        <>
          {cobros > 0 && (
            <div className="flex items-center gap-2 rounded-[var(--katia-radius-md)] border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 px-3 py-2 text-xs font-semibold text-[var(--katia-danger)]">
              ⚠ {cobros} cobro(s) vencido(s) — revisa el estado de cada cliente.
            </div>
          )}
          <Card>
            <CardTitle>Buscar y filtrar</CardTitle>
            <form className="mt-3 grid items-end gap-3 sm:grid-cols-2 md:grid-cols-4" method="get">
              <input type="hidden" name="tab" value="compradores" />
              <Field name="q" label="Búsqueda" defaultValue={q} placeholder="Nombre, DNI, RUC, teléfono…" />
              <SelectField name="tipo" label="Tipo" defaultValue={tipo}>
                <option value="">Todos los tipos</option>
                <option value="empresa">Empresa</option>
                <option value="natural">Persona natural</option>
              </SelectField>
              <SelectField name="estado" label="Estado" defaultValue={estado}>
                <option value="">Todos los estados</option>
                {Object.entries(CLIENTE_ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
              <Button type="submit">Filtrar</Button>
            </form>
          </Card>
          {clientesDetalle.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <p className="text-base font-medium text-[var(--katia-text-primary)]">
                {q || tipo || estado ? "Sin resultados para los filtros" : "Aún no hay compradores"}
              </p>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Compradores ({clientesDetalle.length})</CardTitle>
                <p className="text-xs text-[var(--katia-text-tertiary)]">Clic en una fila para ver el detalle</p>
              </div>
              <div className="mt-4">
                <ClientesMasterDetail clientes={clientesDetalle} volver={clientesHref(filtros)} />
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── BASE DE DATOS ── */}
      {tab === "base_datos" && (
        <div className="space-y-6">

          {/* Choferes */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Choferes contratados</CardTitle>
                <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
                  Transportistas que realizan entregas a domicilio o en obra.
                </p>
              </div>
              <RegistrarChoferInline tiposExistentes={tiposChofer} />
            </div>
            {choferes.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 py-8 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--katia-text-tertiary)]" aria-hidden>
                  <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                <p className="text-sm text-[var(--katia-text-secondary)]">
                  No hay choferes registrados. Agrégalos con el botón de arriba.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]" role="region" tabIndex={0} aria-label="Choferes registrados">
                <Table>
                  <THead><tr><TH>Nombre</TH><TH>Teléfono</TH><TH>Placa</TH><TH>Tipo vehículo</TH><TH>Estado</TH><TH className="w-20">Acción</TH></tr></THead>
                  <tbody>
                    {choferes.map((c) => (
                      <ChoferRowWrapper key={c.id} c={c} tiposExistentes={tiposChofer} />
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>

          {/* Proveedores */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Proveedores</CardTitle>
                <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
                  Empresas y personas que suministran materia prima, insumos y servicios.
                </p>
              </div>
              <RegistrarProveedorInline tiposExistentes={tiposProveedor} />
            </div>
            {proveedores.length === 0 ? (
              <div className="mt-6 flex flex-col items-center justify-center gap-2 py-8 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--katia-text-tertiary)]" aria-hidden>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p className="text-sm text-[var(--katia-text-secondary)]">
                  No hay proveedores registrados. Agrégalos con el botón de arriba.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]" role="region" tabIndex={0} aria-label="Proveedores registrados">
                <Table>
                  <THead><tr><TH>Nombre / Razón social</TH><TH>Documento / RUC</TH><TH>Teléfono</TH><TH>Tipo</TH><TH>Registrado</TH><TH className="w-20">Acción</TH></tr></THead>
                  <tbody>
                    {proveedores.map((p) => (
                      <ProveedorRowWrapper key={p.id} p={p} tiposExistentes={tiposProveedor} />
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>

        </div>
      )}

    </div>
  );
}
