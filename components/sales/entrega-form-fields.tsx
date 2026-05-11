"use client";

import { useMemo, useState } from "react";
import { Combobox } from "@/components/ui/Combobox";
import { Field, SelectField } from "@/components/ui/field";
import { MOCK_CHOFERES, MOCK_ZONAS_ENTREGA } from "@/lib/combobox-mocks";
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
  /** Con `NEXT_PUBLIC_COMBOBOX_MOCK` el padre puede pasar `true` para listas demo. */
  mockData?: boolean;
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
  mockData = false,
}: EntregaFormFieldsProps) {
  const [tipo, setTipo] = useState<TipoEntrega>(defaultTipoEntrega);
  const [zonaId, setZonaId] = useState(defaultZonaId);
  const [choferId, setChoferId] = useState(defaultChoferId);
  const name = (n: string) => (prefix ? `${prefix}_${n}` : n);
  const requiereDireccion = tipo !== "entrega_local";

  const effectiveChoferes = useMemo((): ChoferOption[] => {
    if (!mockData) return choferes;
    const injected: ChoferOption[] = MOCK_CHOFERES.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      placa: c.placa,
    }));
    return [...injected, ...choferes];
  }, [choferes, mockData]);

  const effectiveZonas = useMemo(() => {
    if (!mockData) return zonas;
    const injected: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[] = MOCK_ZONAS_ENTREGA.map(
      (z) => ({
        id: z.id,
        nombre: z.nombre,
        tarifa: z.tarifa,
        distancia_km: z.distancia_km,
      }),
    );
    return [...injected, ...zonas];
  }, [mockData, zonas]);

  const choferComboboxOptions = useMemo(
    () => [
      { value: "", label: "Sin asignar" },
      ...effectiveChoferes.map((c) => ({
        value: c.id,
        label: `${c.nombre}${c.placa ? ` · ${c.placa}` : ""}`,
        sublabel: c.telefono ? String(c.telefono) : undefined,
      })),
    ],
    [effectiveChoferes],
  );

  const zonaComboboxOptions = useMemo(
    () => [
      { value: "", label: "Sin zona" },
      ...effectiveZonas.map((z) => ({
        value: z.id,
        label: `${z.nombre} · ${formatPen(z.tarifa)}`,
        sublabel: z.distancia_km > 0 ? `${z.distancia_km} km` : undefined,
      })),
    ],
    [effectiveZonas],
  );

  const zonaSeleccionada = useMemo(
    () => effectiveZonas.find((z) => z.id === zonaId) ?? null,
    [effectiveZonas, zonaId],
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
        Chofer asignado
        <Combobox
          options={choferComboboxOptions}
          value={choferId}
          onChange={setChoferId}
          hiddenInputName={name("chofer_id")}
          placeholder="Buscar chofer…"
          inputAriaLabel="Chofer asignado"
        />
      </label>

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

      {requiereDireccion && effectiveZonas.length > 0 ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
          Zona de entrega (tarifa)
          <Combobox
            options={zonaComboboxOptions}
            value={zonaId}
            onChange={setZonaId}
            hiddenInputName={name("zona_entrega_id")}
            placeholder="Buscar zona…"
            inputAriaLabel="Zona de entrega"
          />
        </label>
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

      {effectiveChoferes.length === 0 ? (
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
