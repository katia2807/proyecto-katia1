"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import type { MetodoPago, ModalidadPago } from "@/lib/demo-store";

type PagoFormFieldsProps = {
  prefix?: string;
  defaultMetodoPago?: MetodoPago;
  defaultModalidadPago?: ModalidadPago;
  defaultFechaPagoCredito?: string;
  /** Mostrar también un input de monto adelantado cuando modalidad=adelanto. */
  showAdelantoInput?: boolean;
  defaultAdelanto?: string;
};

const metodos: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape / Plin" },
  { value: "transferencia", label: "Transferencia bancaria" },
  { value: "billetera_digital", label: "Billetera digital" },
  { value: "otro", label: "Otro" },
];

const modalidades: { value: ModalidadPago; label: string }[] = [
  { value: "contado", label: "Contado" },
  { value: "adelanto", label: "Adelanto" },
  { value: "adelanto_saldo", label: "Adelanto + saldo" },
  { value: "credito", label: "Crédito" },
];

/**
 * Bloque común para datos de pago: método + modalidad +
 * fecha límite cuando es crédito y opcional monto adelantado.
 */
export function PagoFormFields({
  prefix = "",
  defaultMetodoPago = "efectivo",
  defaultModalidadPago = "contado",
  defaultFechaPagoCredito = "",
  showAdelantoInput = true,
  defaultAdelanto = "0",
}: PagoFormFieldsProps) {
  const [modalidad, setModalidad] = useState<ModalidadPago>(defaultModalidadPago);
  const name = (n: string) => (prefix ? `${prefix}_${n}` : n);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SelectField
        name={name("metodo_pago")}
        label="Método de pago"
        defaultValue={defaultMetodoPago}
      >
        {metodos.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        name={name("modalidad_pago")}
        label="Modalidad"
        value={modalidad}
        onChange={(event) => setModalidad(event.target.value as ModalidadPago)}
      >
        {modalidades.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      {(modalidad === "credito" || modalidad === "adelanto_saldo") ? (
        <Field
          name={name("fecha_pago_credito")}
          label={modalidad === "credito" ? "Fecha límite de pago" : "Fecha límite para saldo"}
          type="date"
          defaultValue={defaultFechaPagoCredito}
          required
        />
      ) : (
        <input type="hidden" name={name("fecha_pago_credito")} value="" />
      )}

      {(modalidad === "adelanto" || modalidad === "adelanto_saldo") && showAdelantoInput ? (
        <Field
          name={name("adelanto")}
          label="Monto adelantado (S/)"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaultAdelanto}
          required
        />
      ) : showAdelantoInput ? (
        <input type="hidden" name={name("adelanto")} value="0" />
      ) : null}

      {modalidad === "credito" && showAdelantoInput ? (
        <Field
          name={name("monto_credito")}
          label="Monto de crédito (S/)"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
          required
        />
      ) : showAdelantoInput ? (
        <input type="hidden" name={name("monto_credito")} value="0" />
      ) : null}
    </div>
  );
}
