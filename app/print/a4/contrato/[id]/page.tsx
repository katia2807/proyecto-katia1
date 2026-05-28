import { notFound } from "next/navigation";
import { DocumentoHeader, DocumentoImprimible } from "@/components/sales/documento-imprimible";
import { getEmpresaConfig } from "@/lib/company-config";
import { getAlquilerRows, getClientesRows } from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function A4ContratoPage({ params }: PageProps) {
  const { id } = await params;
  const [alquilerResult, clientes, empresa] = await Promise.all([
    getAlquilerRows(),
    getClientesRows(),
    getEmpresaConfig(),
  ]);

  const contrato = alquilerResult.rows.find((c) => c.id === id);
  if (!contrato) notFound();
  const cliente = clientes.find((c) => c.id === contrato.cliente_id);

  return (
    <DocumentoImprimible id={id} docType="contrato" currentFormat="a4">
      <DocumentoHeader empresa={empresa} />

      <h2 style={{ fontSize: 16, marginBottom: 4 }}>
        Contrato de alquiler {contrato.codigo ?? id.slice(0, 8)}
      </h2>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Inicio: {formatDate(contrato.fecha_inicio)}
        {contrato.fecha_termino ? ` · Término estimado: ${formatDate(contrato.fecha_termino)}` : ""}
      </p>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Cliente</h3>
        <p style={{ fontSize: 12, margin: "2px 0" }}>{cliente?.nombre ?? "—"}</p>
        {contrato.ruc_empresa ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>RUC: {contrato.ruc_empresa}</p>
        ) : null}
        {contrato.representante ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>Representante: {contrato.representante}</p>
        ) : null}
        {contrato.direccion_ejecucion ? (
          <p style={{ fontSize: 12, margin: "2px 0" }}>
            Dirección de ejecución: {contrato.direccion_ejecucion}
          </p>
        ) : null}
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 6 }}>Tarifa y monto</h3>
        <table>
          <tbody>
            <tr>
              <th style={{ textAlign: "left" }}>Activo</th>
              <td>{contrato.activo}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Unidad de tarifa</th>
              <td>{contrato.tarifa_unidad ?? "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Tarifa unitaria</th>
              <td style={{ textAlign: "right" }}>{formatPen(contrato.tarifa)}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Días / unidades</th>
              <td style={{ textAlign: "right" }}>{contrato.dias_alquiler ?? "—"}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Monto total</th>
              <td style={{ textAlign: "right", fontWeight: 700 }}>
                {contrato.monto_total != null ? formatPen(contrato.monto_total) : "—"}
              </td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Depósito 30%</th>
              <td style={{ textAlign: "right", fontWeight: 700 }}>
                {contrato.deposito_30 != null ? formatPen(contrato.deposito_30) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 6 }}>Cláusulas de penalidad</h3>
        <ul style={{ fontSize: 12, paddingLeft: 18 }}>
          <li>Retraso en el pago: {contrato.penalidad_retraso_pago_pct}% sobre el monto total.</li>
          <li>
            Devolución tardía del equipo: {contrato.penalidad_devolucion_tardia_pct}% sobre el
            monto total.
          </li>
          <li>Daños al equipo: {contrato.penalidad_danios_pct}% sobre el monto total.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Modalidad de pago</h3>
        <p style={{ fontSize: 12 }}>
          {contrato.modalidad_pago ?? "—"} · Método: {contrato.metodo_pago ?? "—"}
        </p>
      </section>
    </DocumentoImprimible>
  );
}
