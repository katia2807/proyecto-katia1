"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDF_CLIENTE_LABELS, parsePdfCliente, type CampoPdfCliente, type ResultadoPdfCliente } from "@/lib/pdf-cliente-parser";
import { combinarCuentasCliente, esMismaReferenciaCuenta, type CuentaCliente } from "@/lib/cliente-contacto";
import type { PdfReaderProgress } from "@/lib/pdf-cliente-reader";

export type ClientePdfValues = Partial<Record<CampoPdfCliente, string>> & { cuentas_bancarias?: CuentaCliente[] };
type Props = { current: Partial<Record<CampoPdfCliente, string>>; currentAccounts: CuentaCliente[]; onApply: (values: ClientePdfValues) => void };
export function ClientePdfAutofill({ current, currentAccounts, onApply }: Props) {
  const id = useId();
  const [result, setResult] = useState<ResultadoPdfCliente | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<PdfReaderProgress | null>(null);
  const [error, setError] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Partial<Record<CampoPdfCliente, boolean>>>({});
  const [values, setValues] = useState<Partial<Record<CampoPdfCliente, string>>>({});
  const [selectedAccounts, setSelectedAccounts] = useState<Record<number, boolean>>({});
  const [applied, setApplied] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); }, []);

  async function read(nextFile: File, forceOcr = false, pdfPassword = "") {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    const request = ++requestId.current;
    setLoading(true); setError(""); setProgress(null); setResult(null); setSelected({}); setSelectedAccounts({});
    setValues({}); setApplied(false); setPasswordRequired(false);
    const timeout = window.setTimeout(() => active.abort("timeout"), 180000);
    try {
      const { leerPdfCliente } = await import("@/lib/pdf-cliente-reader");
      const pages = await leerPdfCliente(nextFile, { signal: active.signal, password: pdfPassword, forceOcr,
        onProgress: value => { if (request === requestId.current) setProgress(value); } });
      if (request !== requestId.current) return;
      const parsed = parsePdfCliente(pages);
      setResult(parsed);
      setValues(Object.fromEntries(Object.entries(parsed.campos).map(([key, candidates]) => [key, candidates.length === 1 ? candidates[0].valor : ""])));
    } catch (cause) {
      if (request !== requestId.current) return;
      if (active.signal.aborted) setError(active.signal.reason === "timeout" ? "La lectura tardó demasiado. Usa un PDF más corto o completa los datos manualmente." : "Lectura cancelada. Tus datos no cambiaron.");
      else {
        setError(cause instanceof Error && cause.name === "PdfReaderError" ? cause.message : "No se pudo abrir el lector. Intenta otra vez o completa la ficha manualmente.");
        setPasswordRequired(!!(cause && typeof cause === "object" && "passwordRequired" in cause && cause.passwordRequired));
      }
    } finally {
      window.clearTimeout(timeout);
      if (request === requestId.current) { setLoading(false); controller.current = null; }
    }
  }
  function apply() {
    if (!result) return;
    const data: ClientePdfValues = {};
    for (const key of Object.keys(result.campos) as CampoPdfCliente[]) {
      if ((selected[key] ?? (!current[key] && result.campos[key].length === 1)) && values[key]?.trim()) data[key] = values[key]!.trim();
    }
    const accounts = result.cuentas.filter((_, index) => selectedAccounts[index] ?? true).map(c => c.cuenta);
    const combined = combinarCuentasCliente(currentAccounts, accounts);
    if (combined.some((a, i) => combined.slice(0, i).some(b => esMismaReferenciaCuenta(a, b)))) { setError("Hay versiones diferentes de una misma cuenta. Elige una sola o corrige la cuenta que ya está en la ficha."); return; }
    if (combined.length > 5) { setError("La ficha admite cinco cuentas en total. Desmarca alguna o quita una cuenta anterior antes de añadir más."); return; }
    if (accounts.length) data.cuentas_bancarias = accounts;
    if (!Object.keys(data).length) { setError("Selecciona al menos un dato para rellenar."); return; }
    onApply(data); setApplied(true); setResult(null); setPassword(""); setFile(null); setError("");
  }
  const progressText = !progress || progress.etapa === "abriendo" ? "Abriendo el PDF…" :
    (progress.etapa === "escaneo" ? "Leyendo escaneo" : "Leyendo texto") + " · página " + progress.pagina + " de " + progress.paginas;
  return (
    <details className="rounded-xl border border-[var(--katia-border-default)] bg-[var(--katia-bg-base)] px-3 py-2" onKeyDown={event => {
      if (event.key !== "Enter") return;
      event.stopPropagation();
      if (event.target instanceof HTMLInputElement && event.target.type !== "file") event.preventDefault();
    }}>
      <summary className="min-h-9 cursor-pointer text-sm font-semibold text-[var(--katia-text-primary)]">
        <FileText aria-hidden="true" className="mr-1 inline size-4" /> Leer datos desde un PDF
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-[var(--katia-text-secondary)]">El archivo se lee en este navegador. Revisa los datos antes de guardarlos.</p>
        <label className="block text-sm font-medium" htmlFor={id}>Archivo PDF de cliente</label>
        <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] p-2">
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => fileInput.current?.click()} aria-controls={id}>
            {fileName ? "Cambiar PDF" : "Elegir PDF"}
          </Button>
          <span id={id + "-name"} aria-live="polite" className="min-w-0 flex-1 break-all text-xs text-[var(--katia-text-secondary)]" title={fileName || undefined}>
            {fileName || "Ningún PDF seleccionado"}
          </span>
        </div>
        <input ref={fileInput} id={id} type="file" accept=".pdf,application/pdf" disabled={loading} className="sr-only" tabIndex={-1} aria-describedby={id + "-name"}
          onChange={event => {
            const chosen = event.target.files?.[0];
            event.target.value = ""; // Permite volver a elegir el mismo PDF; su nombre se muestra aparte.
            if (!chosen) return;
            setPassword(""); setFile(chosen); setFileName(chosen.name); void read(chosen);
          }} />
        {loading ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>{progressText}</span><Button type="button" size="sm" variant="secondary" onClick={() => controller.current?.abort()}>Cancelar lectura</Button>
        </div> : null}
        {passwordRequired && file ? <div className="space-y-2">
          <label className="block text-xs" htmlFor={id + "-password"}>Contraseña del PDF</label>
          <input id={id + "-password"} type="password" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] px-3" />
          <Button type="button" size="sm" onClick={() => void read(file, false, password)}>Leer con contraseña</Button>
        </div> : null}
        {error ? <p role="alert" className="text-xs text-[var(--katia-danger)]">{error}</p> : null}
        {applied ? <p role="status" className="text-xs">Datos colocados en la ficha. Puedes corregirlos; aún no se han guardado.</p> : null}
        {result ? <div className="space-y-3">
          <p className="text-sm font-semibold">Datos detectados · revisa y elige</p>
          {result.advertencias.map(message => <p key={message} className="text-xs text-[var(--katia-text-secondary)]">{message}</p>)}
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(result.campos) as CampoPdfCliente[]).filter(key => result.campos[key].length).map(key => {
              const candidates = result.campos[key];
              const checked = selected[key] ?? (!current[key] && candidates.length === 1);
              return <div key={key} className="min-w-0 space-y-1 rounded-lg border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] p-2">
                <label className="flex min-h-8 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={checked} onChange={event => setSelected(prev => ({ ...prev, [key]: event.target.checked }))} />{PDF_CLIENTE_LABELS[key]}</label>
                {candidates.length > 1 ? <select aria-label={"Valor detectado de " + PDF_CLIENTE_LABELS[key]} value={values[key] ?? ""} onChange={event => { setValues(prev => ({ ...prev, [key]: event.target.value })); setSelected(prev => ({ ...prev, [key]: !!event.target.value })); }} className="h-10 w-full rounded-md border border-[var(--katia-border-default)] bg-[var(--katia-bg-base)] px-2 text-xs">
                  <option value="">Elige el valor correcto</option>{candidates.map(candidate => <option key={candidate.valor} value={candidate.valor}>{candidate.valor} · pág. {candidate.pagina}</option>)}
                </select> : key === "tipo_persona" ? <select aria-label={"Revisar " + PDF_CLIENTE_LABELS[key]} value={values[key] ?? ""} onChange={event => setValues(prev => ({ ...prev, [key]: event.target.value }))} className="h-10 w-full rounded-md border border-[var(--katia-border-default)] bg-[var(--katia-bg-base)] px-2 text-sm"><option value="">Sin especificar</option><option value="empresa">Empresa</option><option value="natural">Persona natural</option></select> :
                  <input aria-label={"Revisar " + PDF_CLIENTE_LABELS[key]} value={values[key] ?? ""} onChange={event => setValues(prev => ({ ...prev, [key]: event.target.value }))} maxLength={key === "direccion" ? 500 : 254} className="h-10 w-full rounded-md border border-[var(--katia-border-default)] bg-[var(--katia-bg-base)] px-2 text-sm" />}
                {current[key] && current[key] !== values[key] ? <p className="break-words text-xs text-[var(--katia-text-secondary)]">Ya contiene: {current[key]}. Se conserva si no marcas este campo.</p> : null}
                <details className="text-xs text-[var(--katia-text-secondary)]"><summary className="cursor-pointer">Ver origen</summary>{candidates.map(candidate => <p key={candidate.valor} className="mt-1 break-words">Pág. {candidate.pagina}{candidate.origen === "ocr" ? " · escaneo" : ""}: {candidate.evidencia}</p>)}</details>
              </div>;
            })}
          </div>
          {result.cuentas.length ? <div className="space-y-2"><p className="text-xs font-semibold">Cuentas bancarias detectadas</p>{result.cuentas.map((entry, index) => <label key={index} className="flex items-start gap-2 rounded-lg border border-[var(--katia-border-subtle)] p-2 text-xs">
            <input type="checkbox" checked={selectedAccounts[index] ?? true} onChange={event => setSelectedAccounts(prev => ({ ...prev, [index]: event.target.checked }))} />
            <span className="break-all">{entry.cuenta.banco || "Banco por completar"} · {entry.cuenta.moneda || "Moneda por confirmar"}<br />
              {entry.cuenta.numero ? "Cuenta: " + entry.cuenta.numero : ""}{entry.cuenta.cci ? " · CCI: " + entry.cuenta.cci : ""}<br />Pág. {entry.pagina}{entry.origen === "ocr" ? " · escaneo" : ""}</span>
          </label>)}</div> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={apply}>Usar estos datos</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setResult(null); setFile(null); setFileName(""); setPassword(""); setError(""); }}>Descartar lectura</Button>
            {file && !result.cuentas.some(c => c.origen === "ocr") ? <Button type="button" variant="secondary" size="sm" onClick={() => void read(file, true, password)}>Leer también como escaneo</Button> : null}
          </div>
        </div> : null}
      </div>
    </details>
  );
}
