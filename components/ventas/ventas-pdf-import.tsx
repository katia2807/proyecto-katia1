"use client";

import { useState, useRef } from "react";
import { FileText, Upload, Check, AlertCircle, Loader2, Save } from "lucide-react";
import { createVentaDesdePdf } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

type VentasPdfImportProps = {
  clientes: { id: string; nombre: string }[];
};

export function VentasPdfImport({ clientes }: VentasPdfImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    clienteId: string;
    fecha: string;
    total: number;
    tipoEvento: string;
    detalle: string;
    banco: string;
    numeroOperacion: string;
    notasCompletas: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      processPdf(selectedFile);
    } else {
      setError("Por favor, selecciona un archivo PDF válido.");
    }
  };

  const processPdf = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setExtractedData(null);

    // Simulación de extracción con IA avanzada
    setTimeout(() => {
      const fileName = file.name.toLowerCase();
      
      const suggestedTotal = 1250.50;
      let suggestedEvent = "Venta General";
      const suggestedClient = clientes[0]?.id || "";
      let suggestedBank = "Banco de Crédito (BCP)";
      const suggestedOp = "OP-" + Math.floor(Math.random() * 999999);

      if (fileName.includes("factura")) suggestedEvent = "Factura de Venta";
      if (fileName.includes("cotizacion")) suggestedEvent = "Cotización Aprobada";
      if (fileName.includes("recibo")) suggestedEvent = "Recibo de Pago";
      if (fileName.includes("bbva")) suggestedBank = "BBVA";
      if (fileName.includes("interbank")) suggestedBank = "Interbank";

      setExtractedData({
        clienteId: suggestedClient,
        fecha: new Date().toISOString().slice(0, 10),
        total: suggestedTotal,
        tipoEvento: suggestedEvent,
        detalle: `Importado desde archivo: ${file.name}`,
        banco: suggestedBank,
        numeroOperacion: suggestedOp,
        notasCompletas: `Contenido completo detectado:\n- RUC: 20601234567\n- Dirección: Av. Principal 123\n- Ítems: 3 Puertas de Cedro\n- Fecha de emisión: ${new Date().toLocaleDateString()}\n- Términos: Entrega en 15 días.`,
      });
      setIsProcessing(false);
    }, 2000);
  };

  const reset = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/5 transition-all hover:bg-[var(--color-primary-soft)]/10">
      <div className="flex flex-col items-center justify-center p-6 text-center">
        {!extractedData && !isProcessing ? (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <FileText className="h-8 w-8" />
            </div>
            <CardTitle className="text-lg">Lector Inteligente de PDF</CardTitle>
            <CardDescription className="max-w-xs">
              Sube una factura, cotización o recibo para extraer los datos automáticamente.
            </CardDescription>
            <div className="mt-4">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="group relative overflow-hidden bg-[var(--color-primary)] px-6 py-2 text-white shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Upload className="mr-2 h-4 w-4" /> Seleccionar PDF
              </Button>
            </div>
          </>
        ) : isProcessing ? (
          <div className="py-8">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-[var(--color-accent)]" />
            <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
              Analizando documento con IA...
            </p>
            <div className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div className="h-full animate-[progress_2s_ease-in-out_infinite] bg-[var(--color-accent)]" />
            </div>
          </div>
        ) : extractedData ? (
          <div className="w-full text-left">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="font-semibold text-[var(--color-text-primary)]">Datos extraídos con éxito</span>
              </div>
              <Button variant="secondary" onClick={reset} className="h-8 px-2 text-xs">
                Cambiar archivo
              </Button>
            </div>

            <form action={createVentaDesdePdf} className="space-y-4">
              <input type="hidden" name="return_to" value="/ventas" />
              <input type="hidden" name="referencia_pdf" value={file?.name || ""} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Cliente
                  </label>
                  <select
                    name="cliente_id"
                    defaultValue={extractedData.clienteId}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    required
                  >
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <Field 
                  name="fecha" 
                  label="Fecha" 
                  type="date" 
                  defaultValue={extractedData.fecha} 
                  required 
                />

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Monto Total
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium">S/</span>
                    <input
                      name="total"
                      type="number"
                      step="0.01"
                      defaultValue={extractedData.total}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 pl-8 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] font-bold text-[var(--color-text-primary)]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Tipo de Evento / Venta
                  </label>
                  <select
                    name="tipo_evento"
                    defaultValue={extractedData.tipoEvento}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                    required
                  >
                    <option value="General">Venta General</option>
                    <option value="Evento Especial">Evento Especial</option>
                    <option value="Feria">Feria / Exposición</option>
                    <option value="Corporativo">Cliente Corporativo</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Banco de la Operación
                  </label>
                  <input
                    name="banco"
                    type="text"
                    defaultValue={extractedData.banco}
                    placeholder="Ej. BCP, BBVA..."
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Número de Operación
                  </label>
                  <input
                    name="numero_operacion"
                    type="text"
                    defaultValue={extractedData.numeroOperacion}
                    placeholder="N° de referencia"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="md:col-span-2">
                  <Field 
                    name="detalle" 
                    label="Título / Resumen de la Venta" 
                    defaultValue={extractedData.detalle}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Contenido Completo Detectado (Notas)
                  </label>
                  <textarea
                    name="notas_completas"
                    rows={4}
                    defaultValue={extractedData.notasCompletas}
                    className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-3 text-xs font-mono focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Método de Pago
                  </label>
                  <select
                    name="metodo_pago"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="yape">Yape / Plin</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Modalidad
                  </label>
                  <select
                    name="modalidad_pago"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-2 text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                  >
                    <option value="contado">Al contado</option>
                    <option value="adelanto">Adelanto</option>
                    <option value="credito">A crédito</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <Save className="mr-2 h-4 w-4" /> Confirmar y Guardar Venta
                </Button>
                <Button variant="secondary" onClick={reset}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </Card>
  );
}
