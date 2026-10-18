"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientePdfAutofill, type ClientePdfValues } from "@/components/sales/cliente-pdf-autofill";
import { combinarCuentasCliente, leerContactoCliente, type CuentaCliente } from "@/lib/cliente-contacto";

type Props = {
  prefix?: string; defaultTipoPersona?: "natural" | "empresa" | "";
  defaultNombre?: string; defaultDocumento?: string; defaultRuc?: string;
  defaultTelefono?: string; defaultDireccion?: string; defaultDatosAdicionales?: unknown;
  optional?: boolean; compact?: boolean; showBothDocuments?: boolean;
};
export function ClienteFormFields({
  prefix = "", defaultTipoPersona = "natural", defaultNombre = "", defaultDocumento = "",
  defaultRuc = "", defaultTelefono = "", defaultDireccion = "", defaultDatosAdicionales,
  optional = false, compact = false, showBothDocuments = false,
}: Props) {
  const [values, setValues] = useState({ nombre: defaultNombre, tipo_persona: defaultTipoPersona,
    documento: defaultDocumento, ruc: defaultRuc, telefono: defaultTelefono, direccion: defaultDireccion,
    email: leerContactoCliente(defaultDatosAdicionales).email });
  const [accounts, setAccounts] = useState<CuentaCliente[]>(() => leerContactoCliente(defaultDatosAdicionales).cuentas_bancarias);
  const [expanded, setExpanded] = useState(!compact);
  const [bankExpanded, setBankExpanded] = useState(false);
  const name = (key: string) => prefix ? prefix + "_" + key : key;
  const set = (key: keyof typeof values, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  function apply(detected: ClientePdfValues) {
    const { cuentas_bancarias, ...fields } = detected;
    const tipo = fields.tipo_persona;
    if (tipo !== "empresa" && tipo !== "natural" && tipo !== undefined) delete fields.tipo_persona;
    setValues(previous => ({ ...previous, ...fields, tipo_persona: tipo === "empresa" || tipo === "natural" ? tipo : previous.tipo_persona }));
    if (Object.keys(fields).some(key => key !== "nombre") || cuentas_bancarias?.length) setExpanded(true);
    if (cuentas_bancarias?.length) {
      setAccounts(previous => combinarCuentasCliente(previous, cuentas_bancarias));
      setBankExpanded(true);
    }
  }
  function updateAccount(index: number, key: keyof CuentaCliente, value: string) {
    setAccounts(previous => previous.map((account, i) => i === index ? { ...account, [key]: value } : account));
  }
  const metadata = { email: values.email, cuentas_bancarias: accounts.filter(c => c.banco || c.numero || c.cci || c.titular || c.moneda) };
  const showRuc = showBothDocuments || values.tipo_persona === "empresa" || !!values.ruc;
  const showDocument = showBothDocuments || values.tipo_persona !== "empresa" || !!values.documento;
  const fields = <>
    <SelectField name={name("tipo_persona")} label="Tipo" value={values.tipo_persona} onChange={event => set("tipo_persona", event.target.value)}>
      <option value="">Sin especificar</option><option value="natural">Persona natural</option><option value="empresa">Empresa (RUC)</option>
    </SelectField>
    {showDocument ? <Field name={name("documento")} label="DNI / Documento" value={values.documento} onChange={event => set("documento", event.target.value)} maxLength={20} /> : <input type="hidden" name={name("documento")} value={values.documento} />}
    {showRuc ? <Field name={name("ruc")} label="RUC" value={values.ruc} onChange={event => set("ruc", event.target.value)} inputMode="numeric" maxLength={11} /> : <input type="hidden" name={name("ruc")} value={values.ruc} />}
    <Field name={name("telefono")} label="Teléfono" value={values.telefono} onChange={event => set("telefono", event.target.value)} inputMode="tel" maxLength={30} />
    <Field label="Correo electrónico (opcional)" type="email" value={values.email} onChange={event => set("email", event.target.value)} maxLength={254} />
    <div className="sm:col-span-2"><Field name={name("direccion")} label="Dirección" value={values.direccion} onChange={event => set("direccion", event.target.value)} maxLength={500} /></div>
    <details className="sm:col-span-2 rounded-lg border border-[var(--katia-border-subtle)] px-3 py-2" open={bankExpanded} onToggle={event => setBankExpanded(event.currentTarget.open)}>
      <summary className="min-h-8 cursor-pointer text-sm font-medium">Cuentas bancarias (opcional){accounts.length ? " · " + accounts.length : ""}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-[var(--katia-text-secondary)]">Datos de referencia del cliente. No registran cobros ni transferencias.</p>
        {accounts.map((account, index) => <fieldset key={index} className="grid gap-3 rounded-lg border border-[var(--katia-border-default)] p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold">Cuenta {index + 1}</legend>
          <Field label={"Banco · cuenta " + (index + 1)} value={account.banco} maxLength={100} onChange={event => updateAccount(index, "banco", event.target.value)} />
          <SelectField label={"Moneda · cuenta " + (index + 1)} value={account.moneda} onChange={event => updateAccount(index, "moneda", event.target.value)}><option value="">Sin especificar</option><option value="PEN">Soles (PEN)</option><option value="USD">Dólares (USD)</option></SelectField>
          <Field label={"Número de cuenta " + (index + 1)} value={account.numero} maxLength={40} inputMode="numeric" onChange={event => updateAccount(index, "numero", event.target.value)} />
          <Field label={"CCI · cuenta " + (index + 1)} value={account.cci} maxLength={32} inputMode="numeric" onChange={event => updateAccount(index, "cci", event.target.value)} />
          <div className="sm:col-span-2"><Field label={"Titular · cuenta " + (index + 1)} value={account.titular} maxLength={180} onChange={event => updateAccount(index, "titular", event.target.value)} /></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAccounts(previous => previous.filter((_, i) => i !== index))}>Quitar cuenta {index + 1}</Button>
        </fieldset>)}
        <Button type="button" variant="secondary" size="sm" disabled={accounts.length >= 5} onClick={() => setAccounts(previous => [...previous, { banco: "", moneda: "", numero: "", cci: "", titular: "" }])}>Añadir cuenta</Button>
      </div>
    </details>
  </>;
  return <div className="space-y-3">
    <ClientePdfAutofill current={{ ...values, tipo_persona: values.nombre || values.ruc || values.documento ? values.tipo_persona : "" }} currentAccounts={accounts} onApply={apply} />
    <input type="hidden" name={name("datos_adicionales")} value={JSON.stringify(metadata)} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field name={name("nombre")} label="Nombre o razón social" value={values.nombre} onChange={event => set("nombre", event.target.value)} required={!optional} maxLength={180} /></div>
      {compact ? <details className="sm:col-span-2 rounded-lg border border-[var(--katia-border-subtle)] px-3 py-2" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
        <summary className="min-h-8 cursor-pointer text-sm font-medium">Contacto, factura y bancos</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{fields}</div>
      </details> : fields}
    </div>
  </div>;
}
