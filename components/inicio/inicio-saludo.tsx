"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createInicioSaludoStore, INICIO_SALUDO_STORAGE_KEY, SALUDOS_INICIO } from "@/lib/inicio-saludos";
import { formatDate } from "@/lib/utils";
import styles from "./inicio-resumen.module.css";

const serverSnapshot = () => null;

export function InicioSaludo({ today }: { today: string }) {
  const store = useMemo(() => createInicioSaludoStore(
    today,
    () => window.localStorage,
    onChange => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === INICIO_SALUDO_STORAGE_KEY || event.key === null) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  ), [today]);
  const id = useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
  const saludo = SALUDOS_INICIO.find(item => item.id === id);

  return (
    <div aria-busy={!saludo}>
      <p className={styles.eyebrow}>{formatDate(today)}</p>
      <div className={styles.saludoCopy}>
        {saludo ? (
          <><h2>{saludo.title}</h2><p>{saludo.subtitle}</p></>
        ) : (
          <div className={styles.saludoPlaceholder} aria-hidden="true">
            <span /><span />
          </div>
        )}
      </div>
    </div>
  );
}
