import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Hammer,
  PackageOpen,
  PlusCircle,
  Scissors,
  TruckIcon,
} from "lucide-react";
import { VentasHubContextPanels } from "@/components/ventas/ventas-hub-context-panels";
import { VentasPdfImport } from "@/components/ventas/ventas-pdf-import";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getChoferesRows,
  getClientesRows,
  getCobrosVencidos,
  getMueblesCatalogoRows,
  getOrdenesProduccionRows,
  getProveedoresRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
  getAlquilerRows,
} from "@/lib/data";
import { VentasListWithFilters, UnifiedVenta } from "@/components/ventas/ventas-list-with-filters";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

type Tarjeta = {
  href: string;
  titulo: string;
  descripcion: string;
  icono: typeof Hammer;
  badge?: string;
};

const tarjetas: Tarjeta[] = [
  {
    href: "/ventas/muebles-terminados",
    titulo: "Muebles terminados",
    descripcion: "Venta directa desde el catálogo cuando ya está claro qué producto del inventario se entrega.",
    icono: Boxes,
    badge: "Catálogo",
  },
  {
    href: "/ventas/muebles-personalizados",
    titulo: "Muebles personalizados",
    descripcion: "Flujo especializado para producción de muebles a medida.",
    icono: Hammer,
    badge: "Cotizador",
  },
  {
    href: "/ventas/madera-cortada",
    titulo: "Madera cortada",
    descripcion: "Caso específico para ventas por pie tablar y cubicaje.",
    icono: PackageOpen,
    badge: "PT",
  },
  {
    href: "/ventas/alquiler-mixer",
    titulo: "Alquiler Bomba Mixer",
    descripcion: "Contrato, depósito, penalidades y cierre de alquiler.",
    icono: TruckIcon,
    badge: "Contrato",
  },
  {
    href: "/ventas/aserradero-servicios",
    titulo: "Servicio Aserradero",
    descripcion: "Servicios especiales de aserradero y procesos por encargo.",
    icono: Scissors,
    badge: "Cubicaje",
  },
];

type VentasPageProps = {
  searchParams?: Promise<{ quick?: string | string[] }>;
};

function normalizeQuickParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function VentasHubPage({ searchParams }: VentasPageProps) {
  const quick = normalizeQuickParam((await searchParams)?.quick);
  const [
    clientes,
    proveedores,
    choferes,
    muebles,
    ventasMuebles,
    ordenes,
    serviciosAserradero,
    cobrosVencidos,
    ventasMadera,
    alquilerBundle,
  ] = await Promise.all([
    getClientesRows(),
    getProveedoresRows(),
    getChoferesRows(),
    getMueblesCatalogoRows(),
    getVentasMuebleTerminadoRows(),
    getOrdenesProduccionRows(),
    getServiciosAserraderoRows(),
    getCobrosVencidos(),
    getVentasRows(),
    getAlquilerRows(),
  ]);
  const totalCobrosVencidos = cobrosVencidos.reduce((acc, c) => acc + c.monto, 0);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));

  // Mapear todas las categorías de ventas a una estructura uniforme
  const listMuebles = ventasMuebles.map((v) => {
    const mueble = muebles.find((m) => m.id === v.mueble_catalogo_id);
    return {
      id: v.id,
      fecha: v.fecha,
      clienteNombre: clientesById.get(v.cliente_id) ?? "Cliente Desconocido",
      concepto: `Mueble: ${mueble?.nombre ?? "Mueble terminado"} (x${v.cantidad})`,
      total: Number(v.total),
      categoria: "muebles" as const,
    };
  });

  const listMadera = ventasMadera.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    clienteNombre: clientesById.get(v.cliente_id) ?? "Cliente Desconocido",
    concepto: `Madera: ${v.correlativo ?? "Venta de Madera"}`.trim(),
    total: Number(v.total),
    categoria: "madera" as const,
  }));

  const listAserradero = serviciosAserradero.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    clienteNombre: clientesById.get(v.cliente_id) ?? "Cliente Desconocido",
    concepto: `Servicio Aserradero (${v.pies_cubicos.toFixed(2)} PT)`,
    total: Number(v.precio_cobrado),
    categoria: "aserradero" as const,
  }));

  const listAlquileres = alquilerBundle.rows.map((v) => ({
    id: v.id,
    fecha: v.fecha_inicio,
    clienteNombre: clientesById.get(v.cliente_id) ?? "Cliente Desconocido",
    concepto: `Alquiler Mixer: ${v.activo} (${v.codigo ?? "Contrato"})`,
    total: Number(v.monto_total),
    categoria: "alquileres" as const,
  }));

  const allVentas: UnifiedVenta[] = [
    ...listMuebles,
    ...listMadera,
    ...listAserradero,
    ...listAlquileres,
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Ventas</h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            Usa el flujo guiado para registrar ventas con menos pasos y menos decisiones manuales.
          </p>
          <p className="text-sm text-[var(--katia-text-secondary)]">
            Los accesos por tipo quedan disponibles abajo para casos puntuales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cotizacion?modo=guiado#cotizacion-wizard">
            <Button variant="secondary">
              <PlusCircle className="mr-2 size-4" />
              Nueva venta guiada
            </Button>
          </Link>
          <Link href="/ventas/dashboard">
            <Button variant="secondary">Dashboard del mes</Button>
          </Link>
          <Link href="/ventas/proveedores-comparador">
            <Button variant="secondary">Comparador de proveedores</Button>
          </Link>
          <Link href="/ventas/zonas-entrega">
            <Button variant="secondary">Zonas de entrega</Button>
          </Link>
        </div>
      </div>

      {cobrosVencidos.length > 0 ? (
        <Card className="border-[var(--color-danger)] bg-red-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-[var(--color-danger)]">
                ⚠ {cobrosVencidos.length} cobro{cobrosVencidos.length === 1 ? "" : "s"} a crédito vencido{cobrosVencidos.length === 1 ? "" : "s"}
              </CardTitle>
              <CardDescription>
                Total adeudado:{" "}
                <span className="font-bold text-[var(--color-danger)]">
                  {formatPen(totalCobrosVencidos)}
                </span>
                . Contacta al cliente para regularizar.
              </CardDescription>
            </div>
            <Link href="/reportes#cobros-vencidos" className="text-sm font-semibold text-[var(--color-danger)] underline">
              Ver detalle
            </Link>
          </div>
        </Card>
      ) : null}

      <Card className="border-2 border-[var(--katia-primary)] bg-[var(--katia-primary)]/5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-[var(--katia-primary)] px-2.5 py-1 text-xs font-bold text-white">
              Recomendado para uso diario
            </div>
            <CardTitle className="mt-3 text-xl">Nueva venta guiada</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              Empieza aquí para registrar ventas de forma más fácil: eliges o creas el cliente, agregas lo que necesita
              y dejas la operación lista para cobrar o convertir desde cotización. Es el camino recomendado para la
              atención diaria.
            </CardDescription>
          </div>
          <Link href="/cotizacion?modo=guiado#cotizacion-wizard">
            <Button className="h-12 px-6 text-base font-bold shadow-sm">
              <PlusCircle className="mr-2 size-4" />
              Crear venta
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VentasListWithFilters ventas={allVentas} />
        </div>
        <div>
          <Card className="h-full">
            <CardTitle>Órdenes de producción activas</CardTitle>
            <CardDescription>
              {ordenes.filter((o) => o.estado !== "entregado").length} órdenes en curso.
            </CardDescription>
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Cliente</TH>
                    <TH>Estado</TH>
                    <TH>Aprobada</TH>
                  </TRow>
                </THead>
                <tbody>
                  {ordenes.slice(0, 5).map((orden) => (
                    <TRow key={orden.id}>
                      <TD>{clientesById.get(orden.cliente_id) ?? "—"}</TD>
                      <TD className="capitalize">{orden.estado.replace(/_/g, " ")}</TD>
                      <TD>
                        {orden.fecha_aprobacion ? formatDate(orden.fecha_aprobacion) : "—"}
                      </TD>
                    </TRow>
                  ))}
                  {ordenes.length === 0 ? (
                    <TRow>
                      <TD colSpan={3} className="text-center text-[var(--color-text-secondary)]">
                        Sin órdenes aún. Aprueba una cotización para crear una.
                      </TD>
                    </TRow>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--katia-text-secondary)]">
          Opciones para casos puntuales
        </h3>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Usa estos accesos si ya sabes exactamente qué operación registrar o necesitas entrar a un flujo especializado.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((tarjeta) => {
          const Icon = tarjeta.icono;
          return (
            <Link
              key={tarjeta.href}
              href={tarjeta.href}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_var(--color-accent)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]">
                  <Icon className="size-5" />
                </div>
                {tarjeta.badge ? (
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {tarjeta.badge}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
                {tarjeta.titulo}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{tarjeta.descripcion}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] group-hover:gap-2">
                Abrir <ArrowRight className="size-3.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Alta de cliente, proveedor o chofer.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!canMutate ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
              Tu rol es de solo lectura en ventas.
            </p>
          ) : (
            <VentasHubContextPanels quick={quick} />
          )}
        </div>
      </Card>


      <VentasPdfImport clientes={clientes.map(c => ({ id: c.id, nombre: c.nombre }))} />

      <Card>
        <CardTitle>Resumen de catálogos disponibles</CardTitle>
        <CardDescription>
          Datos maestros que alimentan los formularios de cada sub-flujo.
        </CardDescription>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Resumen titulo="Clientes" valor={clientes.length} href="/gerencial" />
          <Resumen titulo="Proveedores" valor={proveedores.length} href="/ventas/proveedores-comparador" />
          <Resumen titulo="Choferes" valor={choferes.length} href="/ventas/zonas-entrega" />
          <Resumen titulo="Muebles en catálogo" valor={muebles.length} href="/ventas/muebles-terminados" />
        </div>
        {serviciosAserradero.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            {serviciosAserradero.length} servicios de aserradero en histórico.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function Resumen({ titulo, valor, href }: { titulo: string; valor: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[var(--color-border)] p-3 transition hover:bg-[var(--color-primary-soft)]/40"
    >
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">{titulo}</p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">{valor}</p>
    </Link>
  );
}
