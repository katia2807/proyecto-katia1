"use client";

import { useMemo, useState } from "react";
import { Field, SelectField } from "@/components/ui/field";
import type { EstadoEntrega, TipoEntrega, ZonaEntregaRow } from "@/lib/demo-store";
import { formatPen } from "@/lib/utils";

type ChoferOption = {
  id: string;
  nombre: string;
  telefono?: string | null;
  placa?: string | null;
};

type EntregaFormFieldsProps = {
  prefix?: string;
  choferes: ChoferOption[];
  zonas?: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  defaultChoferId?: string;
  defaultTipoEntrega?: TipoEntrega;
  defaultDireccion?: string;
  defaultEstadoEntrega?: EstadoEntrega;
  defaultZonaId?: string;
  /** URL del listado de choferes para crearlos cuando no haya. */
  choferesHref?: string;
};

const tipos: { value: TipoEntrega; label: string }[] = [
  { value: "puesto_en_obra", label: "Puesto en obra" },
  { value: "entrega_local", label: "Entrega en local" },
  { value: "envio", label: "Envío a domicilio" },
];

const estados: { value: EstadoEntrega; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "entregado", label: "Entregado" },
];

/**
 * Bloque común para datos de entrega: chofer + tipo + dirección + estado.
 * Cuando se elige "entrega_local" la dirección y zona se ocultan.
 */
export function EntregaFormFields({
  prefix = "",
  choferes,
  zonas = [],
  defaultChoferId = "",
  defaultTipoEntrega = "envio",
  defaultDireccion = "",
  defaultEstadoEntrega = "pendiente",
  defaultZonaId = "",
  choferesHref = "/personal",
}: EntregaFormFieldsProps) {
  const [tipo, setTipo] = useState<TipoEntrega>(defaultTipoEntrega);
  const [zonaId, setZonaId] = useState(defaultZonaId);
  const name = (n: string) => (prefix ? `${prefix}_${n}` : n);
  const requiereDireccion = tipo !== "entrega_local";
  const zonaSeleccionada = useMemo(
    () => zonas.find((z) => z.id === zonaId) ?? null,
    [zonas, zonaId],
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SelectField
        name={name("chofer_id")}
        label="Chofer asignado"
        defaultValue={defaultChoferId}
      >
        <option value="">Sin asignar</option>
        {choferes.map((chofer) => (
          <option key={chofer.id} value={chofer.id}>
            {chofer.nombre}
            {chofer.placa ? ` · ${chofer.placa}` : ""}
          </option>
        ))}
      </SelectField>

      <SelectField
        name={name("tipo_entrega")}
        label="Tipo de entrega"
        value={tipo}
        onChange={(event) => setTipo(event.target.value as TipoEntrega)}
      >
        {tipos.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      {requiereDireccion ? (
        <Field
          className="md:col-span-2"
          name={name("direccion_entrega")}
          label="Dirección de entrega"
          placeholder="Av. / Jr. / Mz. y Lt. / Referencia"
          defaultValue={defaultDireccion}
          required={tipo === "envio"}
        />
      ) : (
        <input type="hidden" name={name("direccion_entrega")} value="" />
      )}

      {requiereDireccion && zonas.length > 0 ? (
        <SelectField
          name={name("zona_entrega_id")}
          label="Zona de entrega (tarifa)"
          value={zonaId}
          onChange={(event) => setZonaId(event.target.value)}
        >
          <option value="">Sin zona</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre} · {formatPen(z.tarifa)}
              {z.distancia_km > 0 ? ` · ${z.distancia_km} km` : ""}
            </option>
          ))}
        </SelectField>
      ) : (
        <input type="hidden" name={name("zona_entrega_id")} value="" />
      )}

      <SelectField
        name={name("estado_entrega")}
        label="Estado entrega"
        defaultValue={defaultEstadoEntrega}
      >
        {estados.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      {zonaSeleccionada && zonaSeleccionada.tarifa > 0 ? (
        <p className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Recuerda agregar el flete de <strong>{formatPen(zonaSeleccionada.tarifa)}</strong> al precio
          total cuando elijas esta zona.
        </p>
      ) : null}

      {choferes.length === 0 ? (
        <p className="md:col-span-2 text-xs text-[var(--color-text-secondary)]">
          Aún no hay choferes registrados.{" "}
          <a className="text-[var(--color-accent)] underline" href={choferesHref}>
            Registrar chofer
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
