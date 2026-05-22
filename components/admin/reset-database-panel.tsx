"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { resetDatabaseAction } from "@/app/(dashboard)/admin/respaldo/actions";

export function ResetDatabasePanel() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setPhrase("");
    }
  }, [open]);

  // Bloquear el scroll de la página cuando el modal está abierto
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const handleConfirmReset = async () => {
    if (phrase !== "LIMPIAR") return;
    setBusy(true);
    try {
      const res = await resetDatabaseAction(phrase);
      if (res.ok) {
        showToast({
          message: "Base de datos restablecida correctamente. Todos los datos operativos han sido eliminados.",
          variant: "success",
        });
        setOpen(false);
      } else {
        showToast({
          message: res.error || "Error al intentar restablecer la base de datos.",
          variant: "error",
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Ocurrió un error inesperado al reiniciar el sistema.";
      showToast({
        message: errMsg,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-8 pt-6 border-t border-[var(--katia-border-subtle)]">
        <Card className="border-[rgba(239,68,68,0.3)] bg-red-50/5 dark:bg-red-950/5 shadow-md shadow-red-500/5 hover:border-red-500/60 transition-all duration-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <ShieldAlert className="size-5 shrink-0 animate-pulse" />
                <CardTitle className="text-red-700 dark:text-red-400 font-bold">
                  Zona de Peligro Extremo: Limpieza Total de Base de Datos
                </CardTitle>
              </div>
              <CardDescription className="text-red-800/80 dark:text-red-300/70 max-w-2xl text-xs sm:text-sm">
                Esta acción es destructiva y eliminará de forma irreversible todos los registros operativos en producción de Supabase (clientes, ventas, movimientos de caja, inventario, cotizaciones, etc.). Las configuraciones de la empresa, perfiles y logs no se verán afectados.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="danger"
              className="shrink-0 bg-red-600 hover:bg-red-700 font-bold tracking-wide"
              onClick={() => setOpen(true)}
            >
              🗑️ Limpiar base de datos
            </Button>
          </div>
        </Card>
      </div>

      {mounted &&
        open &&
        createPortal(
          <>
            {/* Backdrop / Overlay */}
            <div
              className="fixed inset-0 z-[10120] bg-[color-mix(in_srgb,var(--color-bg)_78%,black)] backdrop-blur-sm"
              aria-hidden
              onClick={() => {
                if (!busy) setOpen(false);
              }}
            />
            
            {/* Contenedor del Dialog */}
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descId}
              className="fixed left-1/2 top-1/2 z-[10121] flex w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--katia-radius-lg)] border border-red-500/30 bg-[var(--katia-bg-elevated)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Paso 1: Advertencia Inicial */}
              {step === 1 && (
                <>
                  <div className="flex gap-4 border-b border-[var(--katia-border-subtle)] px-6 py-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                      <AlertTriangle className="size-6 shrink-0" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 id={titleId} className="text-lg font-bold text-red-700 dark:text-red-400">
                        ¿Confirmas la limpieza del sistema?
                      </h2>
                      <div id={descId} className="mt-3 text-sm leading-relaxed text-[var(--katia-text-secondary)]">
                        <p className="font-semibold text-[var(--katia-text-primary)]">
                          ⚠️ Esta acción eliminará todos los datos operativos (clientes, ventas, inventario, cotizaciones, movimientos, etc.). No se puede deshacer ni recuperar.
                        </p>
                        <p className="mt-2 text-xs">
                          Asegúrate de haber descargado previamente un respaldo en Excel si deseas conservar un histórico de tus transacciones.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--katia-border-subtle)] bg-[color-mix(in_srgb,var(--katia-surface-raised)_40%,transparent)] px-6 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-w-[7rem]"
                      onClick={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="min-w-[7rem] bg-red-600 hover:bg-red-700"
                      onClick={() => setStep(2)}
                    >
                      Sí, entiendo, continuar
                    </Button>
                  </div>
                </>
              )}

              {/* Paso 2: Frase de Confirmación */}
              {step === 2 && (
                <>
                  <div className="flex gap-4 border-b border-[var(--katia-border-subtle)] px-6 py-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                      <ShieldAlert className="size-6 shrink-0" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 id={titleId} className="text-lg font-bold text-red-700 dark:text-red-400">
                        Confirmación Final Obligatoria
                      </h2>
                      <div id={descId} className="mt-3 space-y-4 text-sm leading-relaxed text-[var(--katia-text-secondary)]">
                        <p>
                          Para evitar borrados accidentales, escribe exactamente <span className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">LIMPIAR</span> para desbloquear la acción final.
                        </p>
                        <Field
                          label="Escribe la palabra de confirmación:"
                          placeholder="LIMPIAR"
                          value={phrase}
                          onChange={(e) => setPhrase(e.target.value)}
                          disabled={busy}
                          autoComplete="off"
                          spellCheck={false}
                          autoFocus
                          className="font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal text-[var(--katia-text-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--katia-border-subtle)] bg-[color-mix(in_srgb,var(--katia-surface-raised)_40%,transparent)] px-6 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-w-[7rem]"
                      disabled={busy}
                      onClick={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="min-w-[7rem] bg-red-600 hover:bg-red-700 disabled:opacity-40"
                      disabled={busy || phrase !== "LIMPIAR"}
                      onClick={handleConfirmReset}
                    >
                      {busy ? "Limpiando..." : "Confirmar Reset Completo"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
