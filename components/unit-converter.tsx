"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type UnitDef = {
  id: string;
  label: string;
  category: "longitud" | "area" | "volumen";
  toBase: number;
};

const units: UnitDef[] = [
  { id: "m", label: "Metro (m)", category: "longitud", toBase: 1 },
  { id: "cm", label: "Centimetro (cm)", category: "longitud", toBase: 0.01 },
  { id: "in", label: "Pulgada (in)", category: "longitud", toBase: 0.0254 },
  { id: "ft", label: "Pie (ft)", category: "longitud", toBase: 0.3048 },
  { id: "m2", label: "Metro cuadrado (m2)", category: "area", toBase: 1 },
  { id: "ft2", label: "Pie cuadrado (ft2)", category: "area", toBase: 0.09290304 },
  { id: "m3", label: "Metro cubico (m3)", category: "volumen", toBase: 1 },
  { id: "ft3", label: "Pie cubico (ft3)", category: "volumen", toBase: 0.0283168466 },
];

const DEFAULT_FORMULA_EXPRESSION = "(eIn * aIn * (lFt * 12)) / 144";
type FormulaMode = "comercial" | "exacta" | "personalizada";
const todayFormulaKey = `katia:formula-pref:pie-tablar:${new Date().toISOString().slice(0, 10)}`;

function readFormulaPreference(canEdit: boolean) {
  if (!canEdit || typeof window === "undefined") {
    return {
      mode: "comercial" as FormulaMode,
      expression: DEFAULT_FORMULA_EXPRESSION,
      confirmed: !canEdit,
    };
  }

  const raw = window.localStorage.getItem(todayFormulaKey);
  if (!raw) {
    return {
      mode: "comercial" as FormulaMode,
      expression: DEFAULT_FORMULA_EXPRESSION,
      confirmed: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as { mode?: FormulaMode; expression?: string };
    return {
      mode: parsed.mode ?? "comercial",
      expression: parsed.expression ?? DEFAULT_FORMULA_EXPRESSION,
      confirmed: true,
    };
  } catch {
    return {
      mode: "comercial" as FormulaMode,
      expression: DEFAULT_FORMULA_EXPRESSION,
      confirmed: false,
    };
  }
}

function formatResult(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatPieTablar(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 7,
  }).format(value);
}

function formatPieTablarInput(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(7);
}

function parseMedidaComercial(input: string) {
  const nums = input
    .replace(",", ".")
    .match(/\d+(\.\d+)?/g)
    ?.map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!nums || nums.length < 3) return null;
  const [espesorIn, anchoIn, largoFt] = nums;
  return { espesorIn, anchoIn, largoFt };
}

export function UnitConverter({ canEdit = true }: { canEdit?: boolean }) {
  const [category, setCategory] = useState<UnitDef["category"]>("longitud");
  const categoryUnits = useMemo(() => units.filter((u) => u.category === category), [category]);
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [amount, setAmount] = useState("1");
  const [espesorCm, setEspesorCm] = useState("2.54");
  const [anchoCm, setAnchoCm] = useState("20");
  const [largoM, setLargoM] = useState("3");
  const [pieTablarManual, setPieTablarManual] = useState<string | null>(null);
  const [medidaInternaManual, setMedidaInternaManual] = useState<string | null>(null);
  const [medidaComercialManual, setMedidaComercialManual] = useState<string | null>(null);
  const [formulaMode, setFormulaMode] = useState<FormulaMode>(() => readFormulaPreference(canEdit).mode);
  const [formulaExpression, setFormulaExpression] = useState(() => readFormulaPreference(canEdit).expression);
  const [formulaConfirmed, setFormulaConfirmed] = useState(() => readFormulaPreference(canEdit).confirmed);
  const [showFormulaConfig, setShowFormulaConfig] = useState(() => !readFormulaPreference(canEdit).confirmed);
  const [showCalculationDetails, setShowCalculationDetails] = useState(
    () => !readFormulaPreference(canEdit).confirmed,
  );

  const result = useMemo(() => {
    const from = categoryUnits.find((u) => u.id === fromUnit) ?? categoryUnits[0];
    const to = categoryUnits.find((u) => u.id === toUnit) ?? categoryUnits[1] ?? categoryUnits[0];
    const value = Number(amount || "0");
    if (!from || !to) return "0";
    const base = value * from.toBase;
    return formatResult(base / to.toBase);
  }, [amount, categoryUnits, fromUnit, toUnit]);

  const madera = useMemo(() => {
    const eCm = Number(espesorCm || "0");
    const aCm = Number(anchoCm || "0");
    const lM = Number(largoM || "0");

    const eIn = eCm / 2.54;
    const aIn = aCm / 2.54;
    const lFt = (lM * 100) / 30.48;
    const volumenM3 = (eCm / 100) * (aCm / 100) * lM;
    const volumenFt3 = volumenM3 * 35.3146667;
    const pieTablar = (eIn * aIn * (lFt * 12)) / 144;

    // Medida comercial aproximada usada en aserradero.
    const nominalE = Math.max(0.5, Math.round(eIn * 4) / 4);
    const nominalA = Math.max(1, Math.round(aIn));
    const nominalL = Math.max(1, Math.round(lFt));

    return {
      eIn,
      aIn,
      lFt,
      volumenM3,
      volumenFt3,
      pieTablarExacto: pieTablar,
      nominal: `${nominalE} x ${nominalA} x ${nominalL} pies`,
      nominalDims: { espesorIn: nominalE, anchoIn: nominalA, largoFt: nominalL },
      etiquetaInterna: `${eIn.toFixed(2)}in x ${aIn.toFixed(2)}in x ${lFt.toFixed(2)}ft`,
    };
  }, [anchoCm, espesorCm, largoM]);

  const medidaInternaFinal =
    medidaInternaManual && medidaInternaManual.trim().length > 0
      ? medidaInternaManual
      : madera.etiquetaInterna;
  const medidaComercialFinal =
    medidaComercialManual && medidaComercialManual.trim().length > 0
      ? medidaComercialManual
      : madera.nominal;

  const pieTablarComercial = useMemo(() => {
    const parsed = parseMedidaComercial(medidaComercialFinal);
    const dims = parsed ?? madera.nominalDims;
    return (dims.espesorIn * dims.anchoIn * (dims.largoFt * 12)) / 144;
  }, [madera.nominalDims, medidaComercialFinal]);

  const formulaComputation = useMemo(() => {
    if (formulaMode === "exacta") {
      return { value: madera.pieTablarExacto, error: null as string | null };
    }
    if (formulaMode === "personalizada") {
      try {
        const fn = new Function("eIn", "aIn", "lFt", `return ${formulaExpression};`);
        const result = Number(fn(madera.eIn, madera.aIn, madera.lFt));
        if (!Number.isFinite(result) || result <= 0) {
          return {
            value: pieTablarComercial,
            error: "La fórmula personalizada devolvió un valor inválido.",
          };
        }
        return { value: result, error: null as string | null };
      } catch {
        return {
          value: pieTablarComercial,
          error: "No se pudo evaluar la fórmula personalizada.",
        };
      }
    }
    return { value: pieTablarComercial, error: null as string | null };
  }, [formulaExpression, formulaMode, madera.aIn, madera.eIn, madera.lFt, madera.pieTablarExacto, pieTablarComercial]);
  const pieTablarCalculado = formulaComputation.value;

  const pieTablarFinal = useMemo(() => {
    const manual = Number(String(pieTablarManual ?? "").replace(",", "."));
    if (Number.isFinite(manual) && manual > 0) return manual;
    return pieTablarCalculado;
  }, [pieTablarCalculado, pieTablarManual]);

  function confirmFormulaForToday() {
    if (!canEdit) return;
    window.localStorage.setItem(
      todayFormulaKey,
      JSON.stringify({
        mode: formulaMode,
        expression: formulaExpression,
      }),
    );
    setFormulaConfirmed(true);
    setShowFormulaConfig(false);
    setShowCalculationDetails(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Conversion maderera</CardTitle>
        <CardDescription>Valores directos, editables y compactos.</CardDescription>
        {!canEdit ? (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Valores fijados por gerencia. Puedes usarlos, pero no editarlos.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field
            label="Espesor (cm)"
            type="number"
            min="0"
            step="0.01"
            value={espesorCm}
            onChange={(e) => setEspesorCm(e.target.value)}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
          <Field
            label="Ancho (cm)"
            type="number"
            min="0"
            step="0.01"
            value={anchoCm}
            onChange={(e) => setAnchoCm(e.target.value)}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
          <Field
            label="Largo (m)"
            type="number"
            min="0"
            step="0.01"
            value={largoM}
            onChange={(e) => setLargoM(e.target.value)}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </div>

        {canEdit ? (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            {showFormulaConfig ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    label="Fórmula a usar"
                    value={formulaMode}
                    onChange={(e) => {
                      setFormulaMode(e.target.value as FormulaMode);
                      setFormulaConfirmed(false);
                    }}
                  >
                    <option value="comercial">Óptima sugerida (medida comercial)</option>
                    <option value="exacta">Exacta (medidas convertidas)</option>
                    <option value="personalizada">Personalizada (calculadora)</option>
                  </SelectField>
                  <div className="flex items-end justify-start md:justify-end">
                    <Button type="button" variant="secondary" onClick={confirmFormulaForToday}>
                      Usar esta fórmula hoy
                    </Button>
                  </div>
                </div>
                {formulaMode === "personalizada" ? (
                  <div className="mt-3">
                    <Field
                      label="Expresión personalizada (usa eIn, aIn, lFt)"
                      value={formulaExpression}
                      onChange={(e) => {
                        setFormulaExpression(e.target.value);
                        setFormulaConfirmed(false);
                      }}
                    />
                  </div>
                ) : null}
                {!formulaConfirmed ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Confirma la fórmula para esta jornada y evitar que te lo vuelva a preguntar hoy.
                  </p>
                ) : null}
                {formulaComputation.error ? <p className="mt-2 text-xs text-rose-600">{formulaComputation.error}</p> : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Fórmula confirmada para hoy. El panel de configuración queda oculto para no cortar el flujo.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowFormulaConfig(true);
                    setShowCalculationDetails(true);
                    setFormulaConfirmed(false);
                  }}
                >
                  Cambiar fórmula
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {showCalculationDetails ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field
              label="Formato interno"
              value={medidaInternaFinal}
              onChange={(e) => setMedidaInternaManual(e.target.value)}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
            <Field
              label="Medida comercial"
              value={medidaComercialFinal}
              onChange={(e) => setMedidaComercialManual(e.target.value)}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
            <Field
              label="Pie tablar"
              type="number"
              min="0"
              step="0.0001"
              value={pieTablarManual ?? formatPieTablarInput(pieTablarCalculado)}
              onChange={(e) => setPieTablarManual(e.target.value === "" ? null : e.target.value)}
              readOnly={!canEdit}
              disabled={!canEdit}
            />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Pie tablar calculado</p>
              <p className="text-lg font-semibold">{formatPieTablar(pieTablarCalculado)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowCalculationDetails(true)}>
              Mostrar detalles
            </Button>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Volumen (m3)</p>
            <p className="text-lg font-semibold">{formatResult(madera.volumenM3)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Volumen (ft3)</p>
            <p className="text-lg font-semibold">{formatResult(madera.volumenFt3)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Pie tablar</p>
            <p className="text-lg font-semibold">{formatPieTablar(pieTablarFinal)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Conversion general</CardTitle>
        <CardDescription>Rapida entre unidades.</CardDescription>
        <div className="mt-4 space-y-3">
          <SelectField
            label="Tipo de conversion"
            value={category}
            onChange={(e) => {
              const next = e.target.value as UnitDef["category"];
              setCategory(next);
              const nextUnits = units.filter((u) => u.category === next);
              setFromUnit(nextUnits[0]?.id ?? "m");
              setToUnit(nextUnits[1]?.id ?? nextUnits[0]?.id ?? "m");
            }}
          >
            <option value="longitud">Longitud</option>
            <option value="area">Area</option>
            <option value="volumen">Volumen</option>
          </SelectField>

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="De unidad" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
              {categoryUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </SelectField>
            <SelectField label="A unidad" value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
              {categoryUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </SelectField>
          </div>

          <Field
            label="Valor"
            type="number"
            min="0"
            step="0.0001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/45 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Resultado</p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{result}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
