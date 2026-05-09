import { notFound } from "next/navigation";
import { DocumentoHeader, DocumentoImprimible } from "@/components/sales/documento-imprimible";
import { getClientesRows, getCortesRows, getCotizacionesRows } from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function CotizacionPdfPage({ params }: PageProps) {
  const { id } = await params;
  const [cotizaciones, clientes, cortes] = await Promise.all([
    getCotizacionesRows(),
    getClientesRows(),
    getCortesRows(id),
  ]);

  const cotizacion = cotizaciones.find((c) => c.id === id);
  if (!cotizacion) notFound();

  const cliente = clientes.find((c) => c.id === cotizacion.cliente_id);

  return (
    <DocumentoImprimible>
      <DocumentoHeader />

      <h2 style={{ fontSize: 16, marginBottom: 4 }}>
        Cotización {cotizacion.correlativo ?? id.slice(0, 8)}
      </h2>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Fecha: {formatDate(cotizacion.fecha)}
      </p>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Datos del cliente</h3>
        <p style={{ fontSize: 12, margin: "2px 0" }}>Nombre: {cliente?.nombre ?? "—"}</p>
        {cliente?.ruc ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>RUC: {cliente.ruc}</p>
        ) : null}
        {cliente?.documento ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>Documento: {cliente.documento}</p>
        ) : null}
        {cliente?.telefono ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>Tel: {cliente.telefono}</p>
        ) : null}
        {cliente?.direccion ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>Dirección: {cliente.direccion}</p>
        ) : null}
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 6 }}>Detalle</h3>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Item</th>
              <th style={{ textAlign: "right" }}>Cant.</th>
              <th style={{ textAlign: "left" }}>Descripción</th>
              <th style={{ textAlign: "right" }}>P. Unit</th>
              <th style={{ textAlign: "right" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {cortes.length > 0 ? (
              cortes.map((c, idx) => (
                <tr key={c.id}>
                  <td>{idx + 1}</td>
                  <td style={{ textAlign: "right" }}>{c.cantidad}</td>
                  <td>
                    {c.tipo_pieza} {c.espesor}″ × {c.ancho}″ × {c.largo}′ ({cotizacion.especie_madera})
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatPen(Number(c.valor_calculado) / Math.max(1, c.cantidad))}
                  </td>
                  <td style={{ textAlign: "right" }}>{formatPen(Number(c.valor_calculado))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>1</td>
                <td style={{ textAlign: "right" }}>1</td>
                <td>{cotizacion.especie_madera} — Servicio personalizado</td>
                <td style={{ textAlign: "right" }}>{formatPen(Number(cotizacion.precio_acordado))}</td>
                <td style={{ textAlign: "right" }}>{formatPen(Number(cotizacion.precio_acordado))}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                Total acordado
              </td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>
                {formatPen(Number(cotizacion.precio_acordado))}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {cotizacion.motivo_ajuste ? (
        <section style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, marginBottom: 4 }}>Notas</h3>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 12,
              margin: 0,
              color: "#333",
            }}
          >
            {cotizacion.motivo_ajuste}
          </pre>
        </section>
      ) : null}

      <footer style={{ marginTop: 32, fontSize: 11, color: "#666" }}>
        <p>Documento generado por el sistema interno · Vigencia 15 días.</p>
      </footer>
    </DocumentoImprimible>
  );
}
