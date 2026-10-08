"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/constants";

const STORAGE_KEY = "katia_visual_preview_style";
const CHANGE_EVENT = "katia-visual-preview-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getAppearance() {
  return document.documentElement.dataset.appearance === "propuesta" ? "propuesta" : "actual";
}

/** Se monta exclusivamente en el servidor de propuesta local y con datos demo. */
export function VisualPreviewControls() {
  const appearance = useSyncExternalStore(subscribe, getAppearance, () => "propuesta");
  const pathname = usePathname();
  const canPreviewPresentation = navItems.some((item) => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));

  function selectAppearance(value: "propuesta" | "actual") {
    document.documentElement.dataset.appearance = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // La comparación sigue disponible si el navegador no permite guardar preferencias.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div className="visual-preview-toolbar">
      <p><strong>Propuesta local</strong><span> · Neutral moderno · Datos de prueba</span></p>
      <div role="group" aria-label="Comparar apariencia">
        <button type="button" aria-pressed={appearance === "actual"} onClick={() => selectAppearance("actual")}>Actual</button>
        <button type="button" aria-pressed={appearance === "propuesta"} onClick={() => selectAppearance("propuesta")}>Propuesta</button>
      </div>
      {canPreviewPresentation ? <button type="button" title="Repetir el recorrido solo para revisar esta propuesta local" onClick={() => window.dispatchEvent(new Event("katia-preview-presentation-open"))}>Ver recorrido</button> : null}
    </div>
  );
}
