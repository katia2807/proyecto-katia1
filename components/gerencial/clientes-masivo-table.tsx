"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { IconSearch, IconExternalLink, IconTrash, IconUser } from "@tabler/icons-react";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatPen } from "@/lib/utils";
import { deleteCliente } from "@/app/actions";

type ClienteRow = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  estado: string | null;
  tipo_persona: string | null;
  totalFacturado: number;
  totalOperaciones: number;
  cobrosVencidos: number;
};

type Props = {
  clientes: ClienteRow[];
  isOwner: boolean;
};

const ESTADO_COLORS: Record<string, string> = {
  activo: "bg-[var(--katia-success)]/15 text-[var(--katia-success)]",
  inactivo: "bg-[var(--katia-text-tertiary)]/15 text-[var(--katia-text-tertiary)]",
  bloqueado: "bg-[var(--katia-danger)]/15 text-[var(--katia-danger)]",
  potencial: "bg-[var(--katia-warning)]/15 text-[var(--katia-warning)]",
};

export function ClientesMasivoTable({ clientes, isOwner }: Props) {
  const [query, setQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return clientes.filter((c) => {
      const matchQuery =
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        (c.documento ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").includes(q);
      const matchEstado = filterEstado === "todos" || c.estado === filterEstado;
      return matchQuery && matchEstado;
    });
  }, [clientes, query, filterEstado]);

  const totalActivos = clientes.filter((c) => c.estado === "activo").length;
  const totalConDeuda = clientes.filter((c) => c.cobrosVencidos > 0).length;

  return (
    <div className="space-y-4">
      {/* Stats resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
          <p className="text-xs text-[var(--katia-text-tertiary)]">Total clientes</p>
          <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{clientes.length}</p>
        </div>
        <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
          <p className="text-xs text-[var(--katia-text-tertiary)]">Activos</p>
          <p className="mt-1 text-2xl font-bold text-[var(--katia-success)]">{totalActivos}</p>
        </div>
        <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
          <p className="text-xs text-[var(--katia-text-tertiary)]">Con cobro vencido</p>
          <p className={`mt-1 text-2xl font-bold ${totalConDeuda > 0 ? "text-[var(--katia-danger)]" : "text-[var(--katia-text-primary)]"}`}>
            {totalConDeuda}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--katia-text-tertiary)]" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento o teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-overlay)] py-2 pl-9 pr-3 text-sm text-[var(--katia-text-primary)] placeholder-[var(--katia-text-tertiary)] outline-none focus:border-[var(--katia-primary)] focus:ring-1 focus:ring-[var(--katia-primary)]"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-overlay)] px-3 py-2 text-sm text-[var(--katia-text-primary)] outline-none focus:border-[var(--katia-primary)]"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="potencial">Potencial</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
        <p className="text-xs text-[var(--katia-text-tertiary)]">
          {filtered.length} de {clientes.length} cliente(s)
        </p>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--katia-radius-lg)] border border-dashed border-[var(--katia-border-subtle)] px-6 py-10 text-center">
          <IconUser className="mx-auto size-8 text-[var(--katia-text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--katia-text-secondary)]">
            {query || filterEstado !== "todos" ? "Sin resultados para ese filtro." : "No hay clientes registrados."}
          </p>
          <Link
            href="/ventas/clientes"
            className="mt-3 inline-block text-xs font-semibold text-[var(--katia-primary)] hover:underline"
          >
            Agregar primer cliente →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
          <Table>
            <THead>
              <TRow>
                <TH>Nombre</TH>
                <TH>Documento</TH>
                <TH>Teléfono</TH>
                <TH>Estado</TH>
                <TH className="text-right">Facturado</TH>
                <TH className="text-right">Ops.</TH>
                <TH className="text-right">Deuda</TH>
                <TH className="text-right">Acciones</TH>
              </TRow>
            </THead>
            <tbody>
              {filtered.map((c) => (
                <TRow key={c.id}>
                  <TD>
                    <span className="font-medium text-[var(--katia-text-primary)]">{c.nombre}</span>
                    {c.tipo_persona === "empresa" ? (
                      <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] bg-[var(--katia-primary)]/10 text-[var(--katia-primary)]">
                        Empresa
                      </span>
                    ) : null}
                  </TD>
                  <TD className="font-mono text-xs">{c.documento ?? "—"}</TD>
                  <TD className="text-xs">{c.telefono ?? "—"}</TD>
                  <TD>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ESTADO_COLORS[c.estado ?? ""] ?? "bg-[var(--katia-text-tertiary)]/10 text-[var(--katia-text-tertiary)]"
                      }`}
                    >
                      {c.estado ?? "sin estado"}
                    </span>
                  </TD>
                  <TD className="text-right font-mono text-sm font-semibold">
                    {c.totalFacturado > 0 ? formatPen(c.totalFacturado) : "—"}
                  </TD>
                  <TD className="text-right text-sm">{c.totalOperaciones > 0 ? c.totalOperaciones : "—"}</TD>
                  <TD className="text-right text-sm">
                    {c.cobrosVencidos > 0 ? (
                      <span className="font-semibold text-[var(--katia-danger)]">{c.cobrosVencidos}</span>
                    ) : (
                      <span className="text-[var(--katia-text-tertiary)]">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/ventas/clientes/${c.id}`}
                        title="Ver ficha completa"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--katia-primary)] hover:bg-[var(--katia-primary)]/10 transition-colors"
                      >
                        <IconExternalLink className="size-3.5" />
                        Ver
                      </Link>
                      <Link
                        href={`/gerencial?tab=clientes360&cliente=${c.id}`}
                        title="Cambiar estado"
                        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors"
                      >
                        Estado
                      </Link>
                      {isOwner && c.estado !== "activo" ? (
                        confirmDelete === c.id ? (
                          <form action={deleteCliente} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="confirmacion" value="ELIMINAR CLIENTE" />
                            <button
                              type="submit"
                              className="rounded-md bg-[var(--katia-danger)] px-2 py-1 text-xs font-bold text-white hover:opacity-90 transition-opacity"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md px-2 py-1 text-xs text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            title="Eliminar cliente"
                            onClick={() => setConfirmDelete(c.id)}
                            className="inline-flex items-center rounded-md p-1 text-[var(--katia-danger)]/60 hover:bg-[var(--katia-danger)]/10 hover:text-[var(--katia-danger)] transition-colors"
                          >
                            <IconTrash className="size-3.5" />
                          </button>
                        )
                      ) : null}
                    </div>
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
