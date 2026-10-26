import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), sale: vi.fn(), rental: vi.fn(), quote: vi.fn(), clients: vi.fn(), drivers: vi.fn(), company: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requirePageAccess: mocks.access }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NO_ENCONTRADO"); } }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: mocks.company }));
vi.mock("@/lib/data", () => ({ getClientesRows: mocks.clients, getChoferesRows: mocks.drivers, getAlquilerRows: mocks.rental, getCotizacionUnificadaById: mocks.quote }));
vi.mock("@/lib/print-helpers", () => ({ resolveSaleDocument: mocks.sale, getProductoMaderaById: vi.fn(), getAdelantoFromCaja: vi.fn(), getMuebleNombre: vi.fn() }));

import { PrintA4Voucher } from "@/components/sales/print-a4-voucher";
import { PrintTicketVoucher } from "@/components/sales/print-ticket-voucher";
import A4ContratoPage from "@/app/print/a4/contrato/[id]/page";
import A4CotizacionPage from "@/app/print/a4/cotizacion/[id]/page";

const id = "84000000-0000-4000-8000-000000000001";
const entries = [
  ...(["boleta", "factura"] as const).flatMap(docType => [
    { name: "A4 " + docType, permission: "/ventas", run: () => PrintA4Voucher({ id, docType, searchTipo: "madera" }), query: mocks.sale },
    { name: "Ticket " + docType, permission: "/ventas", run: () => PrintTicketVoucher({ id, docType, searchTipo: "madera" }), query: mocks.sale },
  ]),
  { name: "Contrato", permission: "/ventas", run: () => A4ContratoPage({ params: Promise.resolve({ id }) }), query: mocks.rental },
  { name: "Cotización", permission: "/cotizacion", run: () => A4CotizacionPage({ params: Promise.resolve({ id }) }), query: mocks.quote },
];
const queries = [mocks.sale, mocks.rental, mocks.quote, mocks.clients, mocks.drivers, mocks.company];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ role: "owner_admin", organizationId: "org-ficticia" });
  mocks.clients.mockResolvedValue([]);
  mocks.drivers.mockResolvedValue([]);
  mocks.company.mockResolvedValue({});
});

for (const entry of entries) describe("Impresión privada: " + entry.name, () => {
  test.each(["SIN_SESION", "SIN_PERMISO"])("%s bloquea antes de consultar el documento y los clientes", async reason => {
    mocks.access.mockRejectedValue(new Error(reason));
    await expect(entry.run()).rejects.toThrow(reason);
    expect(mocks.access).toHaveBeenCalledWith(entry.permission);
    for (const query of queries) expect(query).not.toHaveBeenCalled();
  });
  test("con permiso consulta el documento después de autorizar", async () => {
    entry.query.mockRejectedValue(new Error("CONSULTA_AUTORIZADA"));
    await expect(entry.run()).rejects.toThrow("CONSULTA_AUTORIZADA");
    expect(mocks.access).toHaveBeenCalledWith(entry.permission);
    expect(entry.query).toHaveBeenCalledOnce();
    expect(mocks.access.mock.invocationCallOrder[0]).toBeLessThan(entry.query.mock.invocationCallOrder[0]);
  });
});
