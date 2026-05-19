"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createChofer, createProveedor } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatPen } from "@/lib/utils";

type Cliente = {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  tipo_persona: "natural" | "empresa" | null;
  estado?: "activo" | "inactivo" | "moroso" | null;
  created_at: string;
};

type ClienteDetail = Cliente & {
  operaciones: number;
  facturado: number;
  pedidosActivos: number;
  pagosPendientes: number;
  cotizaciones: { id: string; fecha: string; monto: number; estado: string; href: string }[];
};

type Tab = "compradores" | "base_datos";

function FormularioChofer({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createChofer(formData);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-[var(--color-border)] p-4">
      <p className="sm:col-span-2 text-sm font-semibold text-[var(--color-text-primary)]">Nuevo chofer</p>
      <Field name="nombre" label="Nombre *" placeholder="Nombre completo" required className="sm:col-span-2" />
      <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
      <Field name="placa" label="Placa del vehículo" placeholder="ABC-123" />
      {error && <p className="sm:col-span-2 text-xs text-red-500">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar chofer"}</Button>
      </div>
    </form>
  );
}

function FormularioProveedor({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createProveedor(formData);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2 rounded-xl border border-[var(--color-border)] p-4">
      <p className="sm:col-span-2 text-sm font-semibold text-[var(--color-text-primary)]">Nuevo proveedor</p>
      <Field name="nombre" label="Nombre / Razón social *" placeholder="Proveedor de madera SAC" required className="sm:col-span-2" />
      <Field name="documento" label="RUC / DNI" placeholder="20123456789" />
      <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
      {error && <p className="sm:col-span-2 text-xs text-red-500">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar proveedor"}</Button>
      </div>
    </form>
  );
}

export function ClientesMasterDetail({ clientes }: { clientes: ClienteDetail[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("compradores");
  const [showFormChofer, setShowFormChofer] = useState(false);
  const [showFormProveedor, setShowFormProveedor] = useState(false);

  const tabClass = (t: Tab) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      tab === t
        ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
        : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
    }`;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button type="button" className={tabClass("compradores")} onClick={() => setTab("compradores")}>
          Compradores <span className="ml-1 text-xs opacity-70">{clientes.length}</span>
        </button>
        <button type="button" className={tabClass("base_datos")} onClick={() => setTab("base_datos")}>
          Base de datos
        </button>
      </div>

      {/* COMPRADORES */}
      {tab === "compradores" && (
        <>
          {clientes.length === 0 ? (
            <EmptyState
              title="Aun no hay clientes"
              description="Los clientes sirven para enlazar cotizaciones, ventas, pagos pendientes e historial de pedidos."
              actionLabel="Crear desde ventas"
              actionHref="/ventas"
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <Table>
                  <THead>
                    <TRow>
                      <TH>Nombre</TH>
                      <TH>Documento</TH>
                      <TH>Telefono</TH>
                      <TH>Tipo</TH>
                      <TH>Estado</TH>
                      <TH className="text-right">Pedidos activos</TH>
                      <TH className="text-right">Pagos pendientes</TH>
                      <TH className="text-right">Operaciones</TH>
                      <TH className="text-right">Facturado</TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {clientes.map((c) => (
                      <TRow
                        key={c.id}
                        className="cursor-pointer hover:bg-[var(--color-primary-soft)]"
                        onClick={() => router.push(`/ventas/clientes/${c.id}`)}
                      >
                        <TD className="font-semibold">{c.nombre}</TD>
                        <TD>{c.documento ?? "Sin documento"}</TD>
                        <TD>{c.telefono ?? "Sin telefono"}</TD>
                        <TD>{c.tipo_persona ? <Badge variant="neutral">{c.tipo_persona}</Badge> : "No definido"}</TD>
                        <TD>
                          <Badge variant={c.estado === "activo" ? "success" : c.estado === "moroso" ? "danger" : "warning"}>
                            {c.estado ?? "desconocido"}
                          </Badge>
                        </TD>
                        <TD className="text-right">{c.pedidosActivos}</TD>
                        <TD className="text-right">{c.pagosPendientes}</TD>
                        <TD className="text-right">{c.operaciones}</TD>
                        <TD className="text-right font-semibold">{formatPen(c.facturado)}</TD>
                      </TRow>
                    ))}
                  </tbody>
                </Table>
              </div>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Haz clic en una fila para abrir la ficha completa del cliente.
              </p>
            </>
          )}
        </>
      )}

      {/* BASE DE DATOS — Choferes y Proveedores */}
      {tab === "base_datos" && (
        <div className="space-y-6">

          {/* CHOFERES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">Choferes contratados</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Transportistas que realizan entregas a domicilio o en obra.</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => { setShowFormChofer(true); setShowFormProveedor(false); }}
              >
                + Registrar chofer
              </Button>
            </div>
            {showFormChofer && (
              <FormularioChofer onDone={() => { setShowFormChofer(false); window.location.reload(); }} />
            )}
            <div className="rounded-xl border border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
              Los choferes registrados aparecerán aquí. Agrégalos desde el botón de arriba o al procesar una venta.
            </div>
          </div>

          {/* PROVEEDORES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">Proveedores</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Proveedores de madera e insumos.</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => { setShowFormProveedor(true); setShowFormChofer(false); }}
              >
                + Registrar proveedor
              </Button>
            </div>
            {showFormProveedor && (
              <FormularioProveedor onDone={() => { setShowFormProveedor(false); window.location.reload(); }} />
            )}
            <div className="rounded-xl border border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
              Los proveedores registrados aparecerán aquí.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
