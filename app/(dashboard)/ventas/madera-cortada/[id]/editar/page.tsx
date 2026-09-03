import { redirect } from "next/navigation";

type EditarVentaMaderaCortadaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarVentaMaderaCortadaPage({
  params,
}: EditarVentaMaderaCortadaPageProps) {
  const { id } = await params;
  redirect(`/ventas/madera-cortada/${id}/corregir`);
}
