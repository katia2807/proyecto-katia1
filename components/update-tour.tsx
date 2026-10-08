"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { BrandMark } from "@/components/brand-mark";
import { APP_UPDATE_PRESENTATION, APP_VERSION } from "@/lib/app-version";

type TourPosition = {
  x: number; y: number; width: number; height: number;
  cardLeft: number; cardTop: number; viewportWidth: number; viewportHeight: number;
};

/** Recorrido exclusivamente visual: no navega ni guarda operaciones del negocio. */
export function UpdateTour({ canOpenHelp }: { canOpenHelp: boolean }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(-1);
  const [position, setPosition] = useState<TourPosition | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const initialScroll = useRef<{ x: number; y: number } | null>(null);
  const maskId = useId();
  const seenKey = `katia_seen_presentation_${APP_VERSION}`;
  const currentStep = APP_UPDATE_PRESENTATION.steps[step];
  const isLast = step === APP_UPDATE_PRESENTATION.steps.length - 1;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(seenKey) !== APP_VERSION) setVisible(true);
    } catch {
      // El recorrido manual sigue disponible en la propuesta local.
    }
    const replayPreview = () => { setStep(-1); setPosition(null); setVisible(true); };
    window.addEventListener("katia-preview-presentation-open", replayPreview);
    return () => window.removeEventListener("katia-preview-presentation-open", replayPreview);
  }, [seenKey]);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    initialScroll.current = { x: window.scrollX, y: window.scrollY };
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (initialScroll.current) window.scrollTo({ left: initialScroll.current.x, top: initialScroll.current.y, behavior: "instant" });
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !currentStep) return;
    const targets = [...document.querySelectorAll<HTMLElement>(`[data-update-tour="${currentStep.target}"]`)];
    const findVisibleTarget = () => targets.find((element) => element.getBoundingClientRect().width > 0);
    const target = findVisibleTarget();
    if (target) target.scrollIntoView({ block: "nearest", behavior: "instant" });

    function measure() {
      const card = cardRef.current;
      const visibleTarget = findVisibleTarget();
      if (!card || !visibleTarget) { setPosition(null); return; }
      const bounds = visibleTarget.getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cardLeft = Math.max(16, Math.min(bounds.left + bounds.width / 2 - cardBounds.width / 2, viewportWidth - cardBounds.width - 16));
      const below = bounds.bottom + 16;
      const cardTop = below + cardBounds.height <= viewportHeight - 16
        ? below
        : Math.max(16, Math.min(bounds.top - cardBounds.height - 16, viewportHeight - cardBounds.height - 16));
      setPosition({ x: bounds.left - 6, y: bounds.top - 6, width: bounds.width + 12, height: bounds.height + 12, cardLeft, cardTop, viewportWidth, viewportHeight });
    }

    measure();
    const observer = new ResizeObserver(measure);
    targets.forEach((element) => observer.observe(element));
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [visible, currentStep]);

  function finish() {
    setVisible(false);
    try { window.localStorage.setItem(seenKey, APP_VERSION); } catch { /* El cierre siempre funciona. */ }
  }

  function moveTo(nextStep: number) {
    setPosition(null);
    setStep(nextStep);
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="update-tour-title" aria-describedby="update-tour-description" onCancel={finish} className={`update-tour-dialog ${currentStep ? "update-tour-active" : "update-tour-welcome"}`}>
      {currentStep && position ? (
        <svg aria-hidden="true" className="update-tour-spotlight" viewBox={`0 0 ${position.viewportWidth} ${position.viewportHeight}`} preserveAspectRatio="none">
          <defs><mask id={maskId}><rect width="100%" height="100%" fill="white" /><rect x={position.x} y={position.y} width={position.width} height={position.height} rx="12" fill="black" /></mask></defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.28)" mask={`url(#${maskId})`} />
          <rect x={position.x} y={position.y} width={position.width} height={position.height} rx="12" fill="none" stroke="var(--katia-primary)" strokeWidth="2" />
        </svg>
      ) : null}
      <div ref={cardRef} className="update-tour-card" style={currentStep && position ? { left: position.cardLeft, top: position.cardTop } : undefined}>
        <div className="flex items-center justify-between gap-3">
          {currentStep ? <p className="text-xs font-medium text-[var(--katia-text-secondary)]">Paso {step + 1} de {APP_UPDATE_PRESENTATION.steps.length}</p> : <BrandMark size="large" />}
          <button type="button" aria-label="Cerrar recorrido" onClick={finish} className="rounded-lg p-2 text-[var(--katia-text-secondary)] hover:bg-[var(--katia-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--katia-primary)]"><IconX className="size-4" /></button>
        </div>
        {!currentStep ? <p className="mt-4 text-xs text-[var(--katia-text-secondary)]">Katia Suite · Actualización {APP_VERSION}</p> : null}
        <div key={step} className="update-tour-step" aria-live="polite" aria-atomic="true">
          <h2 id="update-tour-title" className="mt-3 text-xl font-semibold tracking-tight">{currentStep?.title ?? APP_UPDATE_PRESENTATION.title}</h2>
          <p id="update-tour-description" className="mt-2 text-sm leading-6 text-[var(--katia-text-secondary)]">{currentStep?.description ?? APP_UPDATE_PRESENTATION.description}</p>
        </div>
        {currentStep ? <div aria-hidden="true" className="mt-4 flex gap-1.5">{APP_UPDATE_PRESENTATION.steps.map((item, index) => <span key={item.target} className={`h-1 w-5 rounded-full ${index === step ? "bg-[var(--katia-primary)]" : "bg-[var(--katia-border-default)]"}`} />)}</div> : null}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={currentStep ? () => moveTo(step - 1) : finish} className="min-h-10 rounded-lg px-2 text-sm text-[var(--katia-text-secondary)] hover:bg-[var(--katia-primary-soft)]">{currentStep ? "Anterior" : "Ahora no"}</button>
          <button type="button" onClick={isLast ? finish : () => moveTo(step + 1)} className="min-h-10 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--katia-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--katia-primary)]">{isLast ? "Listo" : currentStep ? "Siguiente" : "Ver cambios"}</button>
        </div>
        {currentStep ? <div className="mt-3 flex items-center justify-between gap-3 text-xs"><button type="button" onClick={finish} className="min-h-8 text-[var(--katia-text-secondary)] underline underline-offset-4">Saltar recorrido</button>{isLast && canOpenHelp ? <Link href="/ayuda" onClick={finish} className="text-[var(--katia-primary)] underline underline-offset-4">Consultar Ayuda</Link> : null}</div> : <p className="mt-3 text-xs leading-5 text-[var(--katia-text-secondary)]">Una sola vez por navegador para esta actualización.</p>}
      </div>
    </dialog>
  );
}
