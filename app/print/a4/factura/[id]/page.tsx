import { PrintA4Voucher } from "@/components/sales/print-a4-voucher";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string; volver?: string | string[] }>;
};

export default async function A4FacturaPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tipo, volver } = await searchParams;

  return <PrintA4Voucher id={id} docType="factura" searchTipo={tipo} volver={volver} />;
}
