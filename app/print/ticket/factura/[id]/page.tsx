import { PrintTicketVoucher } from "@/components/sales/print-ticket-voucher";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string; volver?: string | string[] }>;
};

export default async function TicketFacturaPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tipo, volver } = await searchParams;

  return <PrintTicketVoucher id={id} docType="factura" searchTipo={tipo} volver={volver} />;
}
