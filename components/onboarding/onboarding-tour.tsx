"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconX, IconArrowRight, IconArrowLeft } from "@tabler/icons-react";

const TOUR_STORAGE_KEY = "katia_tour_completado";

type TourStep = {
  titulo: string;
  descripcion: string;
  href?: string;
  accion?: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    titulo: "Bienvenido a Katia Suite",
    descripcion:
      "Este es tu sistema de gestión privado. Te guiaré en 6 pasos para que conozcas las funciones principales.",
  },
  {
    titulo: "Centro de Mando",
    descripcion:
      "Aquí ves todo lo importante: ingresos del día, pendientes urgentes y accesos rápidos. Es tu pantalla principal.",
    href: "/gerencial",
    accion: "Abrir Centro de Mando",
  },
  {
    titulo: "Tus clientes",
    descripcion:
      "Registra y gestiona a tus clientes. Puedes buscarlos por nombre, teléfono o documento desde cualquier módulo.",
    href: "/ventas/clientes",
    accion: "Ver clientes",
  },
  {
    titulo: "Inventario",
    descripcion:
      "Controla tu stock en tiempo real. El sistema te avisa cuando un producto está por agotarse.",
    href: "/inventario",
    accion: "Ver inventario",
  },
  {
    titulo: "Cotizaciones y ventas",
    descripcion:
      "Crea cotizaciones en segundos y conviértelas en ventas. Todos los documentos son internos y privados.",
    href: "/cotizacion",
    accion: "Crear cotización",
  },
  {
    titulo: "Reportes y caja",
    descripcion:
      "Exporta tus datos a Excel, revisa el flujo de caja y genera reportes de auditoría en cualquier momento.",
    href: "/reportes",
    accion: "Ver reportes",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!done) setVisible(true);
    } catch {
      // localStorage no disponible
    }
  }, []);

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      // noop
    }
  };

  const siguiente = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      cerrar();
    }
  };

  const anterior = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step]!;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[9990] flex items-end justify-center pb-6 sm:items-center sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={cerrar}
        aria-hidden
      />

      {/* Tour card */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-[var(--katia-radius-xl)] border border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] p-6 shadow-[var(--katia-shadow-modal)]">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i <= step
                    ? "bg-[var(--katia-primary)] w-4"
                    : "bg-[var(--katia-border-default)] w-1.5"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="flex size-7 items-center justify-center rounded-[var(--katia-radius-sm)] text-[var(--katia-text-tertiary)] transition hover:bg-[var(--katia-bg-overlay)] hover:text-[var(--katia-text-primary)]"
            aria-label="Cerrar tour"
          >
            <IconX className="size-4" />
          </button>
        </div>

        {/* Content */}
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--katia-text-tertiary)]">
          Paso {step + 1} de {TOUR_STEPS.length}
        </p>
        <h2 className="text-lg font-semibold text-[var(--katia-text-primary)]">{current.titulo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--katia-text-secondary)]">
          {current.descripcion}
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="text-xs text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-secondary)]"
          >
            Saltar tour
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={anterior}
                className="flex items-center gap-1.5 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--katia-text-secondary)] transition hover:border-[var(--katia-border-emphasis)] hover:text-[var(--katia-text-primary)]"
              >
                <IconArrowLeft className="size-3.5" />
                Anterior
              </button>
            ) : null}
            {current.href ? (
              <Link
                href={current.href}
                onClick={siguiente}
                className="flex items-center gap-1.5 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {current.accion ?? "Continuar"}
                <IconArrowRight className="size-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={siguiente}
                className="flex items-center gap-1.5 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {isLast ? "Comenzar" : "Siguiente"}
                <IconArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
