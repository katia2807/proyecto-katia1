import { PrintA4Voucher } from "@/components/sales/print-a4-voucher";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
};

export default async function A4FacturaPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tipo } = await searchParams;

  return <PrintA4Voucher id={id} docType="factura" searchTipo={tipo} />;
}
