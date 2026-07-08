"use client";

import { useEffect, useState } from "react";
import { APP_UPDATE_SUMMARY, APP_VERSION } from "@/lib/app-version";

const SEEN_VERSION_KEY = "katia_seen_version";

export function AppVersionNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seenVersion = window.localStorage.getItem(SEEN_VERSION_KEY);
      if (seenVersion === APP_VERSION) return;
      setVisible(true);
      window.localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      // localStorage may be unavailable; in that case the notice is skipped.
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[10000] max-w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-[var(--katia-border-default)] bg-[var(--katia-bg-base)] px-4 py-3 text-sm shadow-lg">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--katia-text-primary)]">
            Sistema actualizado a la version {APP_VERSION}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--katia-text-secondary)]">
            {APP_UPDATE_SUMMARY}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--katia-text-secondary)] transition hover:bg-[var(--katia-primary-soft)] hover:text-[var(--katia-text-primary)]"
          onClick={() => setVisible(false)}
          aria-label="Cerrar aviso de actualizacion"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}