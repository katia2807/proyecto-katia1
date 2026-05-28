import { PrintTicketVoucher } from "@/components/sales/print-ticket-voucher";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
};

export default async function TicketFacturaPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tipo } = await searchParams;

  return <PrintTicketVoucher id={id} docType="factura" searchTipo={tipo} />;
}
