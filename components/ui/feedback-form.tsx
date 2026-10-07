"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

/** Conserva los campos al fallar y evita repetir un envío mientras está pendiente. */
export function FeedbackForm({ action, children, className, idempotent = false }: {
  action: (formData: FormData) => Promise<{ error?: string; success?: string }>;
  children: ReactNode;
  className?: string;
  idempotent?: boolean;
}) {
  const busy = useRef(false);
  const submissionId = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  return <form className={className} onSubmit={event => {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (idempotent) {
      submissionId.current ??= crypto.randomUUID();
      data.set("submission_id", submissionId.current);
    }
    busy.current = true;
    setResult({});
    startTransition(async () => {
      try {
        const response = await action(data);
        setResult(response);
        if (!response.error) { form.reset(); submissionId.current = null; }
      } catch {
        setResult({ error: "No se pudo confirmar el guardado. Conservamos los datos para que puedas reintentar." });
      } finally { busy.current = false; }
    });
  }}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending ? <p role="status" className="text-sm">Guardando…</p> : null}
    {result.error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{result.error}</p> : null}
    {result.success ? <p role="status" className="text-sm text-[var(--color-text-secondary)]">{result.success}</p> : null}
  </form>;
}
