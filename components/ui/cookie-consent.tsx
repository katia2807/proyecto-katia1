"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_KEY = "katia_cookies_aceptadas";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
    } catch {
      // noop
    }
  }, []);

  const aceptar = () => {
    setVisible(false);
    try {
      localStorage.setItem(COOKIE_KEY, "1");
    } catch {
      // noop
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9980] mx-auto max-w-lg">
      <div className="flex flex-col gap-3 rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] p-4 shadow-[var(--katia-shadow-modal)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-[var(--katia-text-secondary)]">
          Este sistema usa cookies técnicas esenciales para el funcionamiento de la sesión.
          No se usan cookies de rastreo o publicidad.{" "}
          <Link href="/legal/privacidad" className="underline hover:text-[var(--katia-primary)]">
            Política de privacidad
          </Link>
        </p>
        <button
          type="button"
          onClick={aceptar}
          className="shrink-0 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
