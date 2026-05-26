"use client";

import { useMemo, useState } from "react";
import { MargenIndicator } from "@/components/sales/margen-indicator";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatPen, roundMoney } from "@/lib/utils";

const catalogoPlantillas = {
  puerta_contraplacada: {
    nombre: "Puerta Contraplacada",
    piezas: [
      { id: 1, cantidad: 2, descripcion: "Parantes para la puerta", espesor: 2, ancho: 6, largo: 8 },
      { id: 2, cantidad: 4, descripcion: "Listones horizontales", espesor: 2, ancho: 3, largo: 3 },
      { id: 3, cantidad: 2, descripcion: "Parantes para el marco", espesor: 2, ancho: 4, largo: 8 },
      { id: 4, cantidad: 4, descripcion: "Listones horizontales (marco)", espesor: 2, ancho: 4, largo: 3 }
    ],
    insumos_base: [
      { id: 1, cantidad: 0.5, descripcion: "Clavos 1/2", unidad: "kg", precio_unitario: 5.00 },
      { id: 2, cantidad: 1, descripcion: "Cola azul", unidad: "balde", precio_unitario: 4.00 }
    ]
  }
};

type Step = 1 | 2 | 3;
type PlantillaKey = keyof typeof catalogoPlantillas;

type CotizadorInteligenteProps = {
  canSave?: boolean;
};

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]/60 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

function toNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return roundMoney(value);
}

function calcularPieTablar(cantidad: number, espesor: number, ancho: number, largo: number) {
  return (cantidad * espesor * ancho * largo) / 12;
}

export function CotizadorInteligente({ canSave = true }: CotizadorInteligenteProps) {
  const [pasoActivo, setPasoActivo] = useState<Step>(1);
  const [pasoMaximo, setPasoMaximo] = useState<Step>(1);
  const [error, setError] = useState("");

  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaKey>("puerta_contraplacada");

  const [desperdicioPct, setDesperdicioPct] = useState("30");
  const [precioPorPT, setPrecioPorPT] = useState("0");

  const [manoObra, setManoObra] = useState("0");
  const [precioVenta, setPrecioVenta] = useState("0");

  const plantilla = catalogoPlantillas[plantillaSeleccionada];

  const piezasConSubtotal = useMemo(
    () =>
      plantilla.piezas.map((pieza) => ({
        ...pieza,
        subtotalPT: calcularPieTablar(pieza.cantidad, pieza.espesor, pieza.ancho, pieza.largo),
      })),
    [plantilla],
  );

  const totalPTNeto = useMemo(
    () => piezasConSubtotal.reduce((acc, pieza) => acc + pieza.subtotalPT, 0),
    [piezasConSubtotal],
  );

  const ptAComprar = useMemo(() => {
    const desperdicio = Math.max(0, toNumber(desperdicioPct));
    return totalPTNeto * (1 + desperdicio / 100);
  }, [desperdicioPct, totalPTNeto]);

  const costoTotalMadera = useMemo(
    () => ptAComprar * Math.max(0, toNumber(precioPorPT)),
    [ptAComprar, precioPorPT],
  );

  const insumosConCosto = useMemo(
    () =>
      plantilla.insumos_base.map((insumo) => ({
        ...insumo,
        costo: insumo.cantidad * insumo.precio_unitario,
      })),
    [plantilla],
  );

  const costoTotalInsumos = useMemo(
    () => insumosConCosto.reduce((acc, insumo) => acc + insumo.costo, 0),
    [insumosConCosto],
  );

  const costoTotal = useMemo(
    () => costoTotalMadera + costoTotalInsumos + Math.max(0, toNumber(manoObra)),
    [costoTotalMadera, costoTotalInsumos, manoObra],
  );

  const gananciaNeta = useMemo(() => toNumber(precioVenta) - costoTotal, [precioVenta, costoTotal]);

  function abrirPaso(step: Step) {
    if (step <= pasoMaximo) {
      setPasoActivo(step);
      setError("");
    }
  }

  function irPaso2() {
    if (!nombreCliente.trim()) {
      setError("Ingresa el nombre del cliente para continuar.");
      return;
    }
    if (!telefono.trim()) {
      setError("Ingresa el telefono para continuar.");
      return;
    }
    if (!fecha) {
      setError("Selecciona una fecha valida.");
      return;
    }
    setPasoMaximo(2);
    setPasoActivo(2);
    setError("");
  }

  function irPaso3() {
    if (toNumber(precioPorPT) <= 0) {
      setError("Ingresa un precio por PT mayor a 0.");
      return;
    }
    setPasoMaximo(3);
    setPasoActivo(3);
    setError("");
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <CardTitle>Cotizador Inteligente</CardTitle>
        <CardDescription>Asistente paso a paso para cotizar muebles de carpinteria con plantillas predefinidas.</CardDescription>
      </Card>

      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => abrirPaso(1)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Paso 1: Datos y Seleccion</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Cliente, fecha y plantilla base</p>
          </div>
          <span className="text-xs font-semibold text-[var(--color-accent)]">{pasoActivo === 1 ? "Abierto" : "Ver"}</span>
        </button>

        {pasoActivo === 1 ? (
          <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Nombre del Cliente</span>
                <input
                  value={nombreCliente}
                  onChange={(event) => setNombreCliente(event.target.value)}
                  className={inputClass}
                  placeholder="Ej: Juan Perez"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Telefono</span>
                <input
                  value={telefono}
                  onChange={(event) => setTelefono(event.target.value)}
                  className={inputClass}
                  placeholder="Ej: 999888777"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fecha</span>
                <input value={fecha} onChange={(event) => setFecha(event.target.value)} type="date" className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Elegir Plantilla</span>
                <select
                  value={plantillaSeleccionada}
                  onChange={(event) => setPlantillaSeleccionada(event.target.value as PlantillaKey)}
                  className={inputClass}
                >
                  <option value="puerta_contraplacada">Puerta Contraplacada</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={irPaso2}
                className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)]"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className={`overflow-hidden p-0 ${pasoMaximo < 2 ? "opacity-70" : ""}`}>
        <button
          type="button"
          onClick={() => abrirPaso(2)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          disabled={pasoMaximo < 2}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Paso 2: Calculo de Madera (Materia Prima)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Despiece, PT neto, desperdicio y costo de madera</p>
          </div>
          <span className="text-xs font-semibold text-[var(--color-accent)]">{pasoActivo === 2 ? "Abierto" : "Ver"}</span>
        </button>

        {pasoActivo === 2 ? (
          <div className="space-y-4 border-t border-[var(--color-border)] px-5 pb-5 pt-4">
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-primary-soft)]/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Descripcion</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Cantidad</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Espesor</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Ancho</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Largo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Subtotal PT</th>
                  </tr>
                </thead>
                <tbody>
                  {piezasConSubtotal.map((pieza) => (
                    <tr key={pieza.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2 text-[var(--color-text-primary)]">{pieza.descripcion}</td>
                      <td className="px-3 py-2 text-right">{pieza.cantidad}</td>
                      <td className="px-3 py-2 text-right">{pieza.espesor}</td>
                      <td className="px-3 py-2 text-right">{pieza.ancho}</td>
                      <td className="px-3 py-2 text-right">{pieza.largo}</td>
                      <td className="px-3 py-2 text-right font-semibold">{pieza.subtotalPT.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/25 p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Total PT Neto</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{totalPTNeto.toFixed(2)} PT</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">% Desperdicio</span>
                <input
                  value={desperdicioPct}
                  onChange={(event) => setDesperdicioPct(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Precio por PT (S/)</span>
                <input
                  value={precioPorPT}
                  onChange={(event) => setPrecioPorPT(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">PT a Comprar</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{ptAComprar.toFixed(2)} PT</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/25 p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Costo Total Madera</p>
                <p className="text-3xl font-black text-[var(--color-text-primary)]">{formatPen(round2(costoTotalMadera))}</p>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setPasoActivo(1)}
                className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold"
              >
                Atras
              </button>
              <button
                type="button"
                onClick={irPaso3}
                className="h-10 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)]"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className={`overflow-hidden p-0 ${pasoMaximo < 3 ? "opacity-70" : ""}`}>
        <button
          type="button"
          onClick={() => abrirPaso(3)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          disabled={pasoMaximo < 3}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Paso 3: Finanzas y Ganancia</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Costos finales, precio de venta y utilidad neta</p>
          </div>
          <span className="text-xs font-semibold text-[var(--color-accent)]">{pasoActivo === 3 ? "Abierto" : "Ver"}</span>
        </button>

        {pasoActivo === 3 ? (
          <div className="space-y-4 border-t border-[var(--color-border)] px-5 pb-5 pt-4">
            <div className="rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Costo Total Madera (desde Paso 2)</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatPen(round2(costoTotalMadera))}</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-primary-soft)]/30">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Insumo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Cantidad</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Unidad</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Precio Unitario</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosConCosto.map((insumo) => (
                    <tr key={insumo.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2">{insumo.descripcion}</td>
                      <td className="px-3 py-2 text-right">{insumo.cantidad}</td>
                      <td className="px-3 py-2">{insumo.unidad}</td>
                      <td className="px-3 py-2 text-right">{formatPen(insumo.precio_unitario)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatPen(insumo.costo)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--color-border)] bg-[var(--color-primary-soft)]/20">
                    <td colSpan={4} className="px-3 py-2 font-semibold">
                      Costo Insumos Total
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{formatPen(round2(costoTotalInsumos))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Mano de Obra (S/)</span>
                <input
                  value={manoObra}
                  onChange={(event) => setManoObra(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Precio de Venta al Cliente (S/)</span>
                <input
                  value={precioVenta}
                  onChange={(event) => setPrecioVenta(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  disabled={!canSave}
                  aria-disabled={!canSave}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Total Produccion</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatPen(round2(costoTotal))}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Precio Venta</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatPen(round2(toNumber(precioVenta)))}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/25 p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Ganancia Neta</p>
                <p className={`text-2xl font-black ${gananciaNeta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                  {formatPen(round2(gananciaNeta))}
                </p>
              </div>
            </div>

            <MargenIndicator
              costo={costoTotal}
              precio={toNumber(precioVenta)}
              label="Margen sobre precio de venta"
            />

            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setPasoActivo(2)}
                className="h-10 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold"
              >
                Atras
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {!canSave ? <p className="text-xs text-[var(--color-text-secondary)]">Modo lectura activo para precio de venta.</p> : null}
    </div>
  );
}
