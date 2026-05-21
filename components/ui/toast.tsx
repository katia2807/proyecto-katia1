"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (opts: { message: string; variant: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 3000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, variant }: { message: string; variant: ToastVariant }) => {
      let finalMessage = message;
      if (variant === "error") {
        const lowerMsg = (message ?? "").toLowerCase();
        if (
          lowerMsg.includes("supabase") ||
          lowerMsg.includes("relation") ||
          lowerMsg.includes("constraint") ||
          lowerMsg.includes("null")
        ) {
          finalMessage = "Ocurrió un error técnico. Por favor intenta de nuevo o contacta al administrador.";
        }
      }
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-2), { id, message: finalMessage, variant }]);
      const tid = setTimeout(() => remove(id), DISMISS_MS);
      timers.current.set(id, tid);
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[10001] flex max-w-[min(calc(100vw-2rem),24rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              t.variant === "success"
                ? "border-emerald-500/50 bg-[#064e3b] text-white"
                : "border-red-500/55 bg-[#450a0a] text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
