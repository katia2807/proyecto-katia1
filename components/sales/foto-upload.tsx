"use client";

import Image from "next/image";
import { useState } from "react";

type FotoUploadProps = {
  /** Bucket destino dentro de data/uploads/. */
  bucket: "muebles" | "caja" | "compras" | "comprobantes";
  /** Nombre del input hidden que reportará la URL guardada. */
  name: string;
  /** Etiqueta del campo. */
  label: string;
  /** URL inicial cuando se está editando un recurso existente. */
  defaultUrl?: string;
};

/**
 * Sube un archivo (imagen/PDF) a `/api/uploads`, muestra un preview y mantiene
 * la URL resultante en un input hidden listo para enviarse al server action.
 */
export function FotoUpload({ bucket, name, label, defaultUrl = "" }: FotoUploadProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [estado, setEstado] = useState<"idle" | "subiendo" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string>("");

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEstado("subiendo");
    setMensaje("");
    try {
      const fd = new FormData();
      fd.append("bucket", bucket);
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }
      setUrl(json.url);
      setEstado("ok");
      setMensaje("Archivo guardado.");
    } catch (err) {
      setEstado("error");
      setMensaje(err instanceof Error ? err.message : "Error al subir.");
    }
  }

  const esImagen = url && /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <div className="space-y-2">
      <label className="space-y-1">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleChange}
          className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)]"
        />
      </label>
      <input type="hidden" name={name} value={url} />
      {estado === "subiendo" ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Subiendo…</p>
      ) : null}
      {estado === "error" ? (
        <p className="text-xs text-[var(--color-danger)]">{mensaje}</p>
      ) : null}
      {url ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-2">
          {esImagen ? (
            <Image
              src={url}
              alt="Preview"
              width={64}
              height={64}
              className="size-16 rounded-lg object-cover"
              unoptimized
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-xs font-semibold">
              PDF
            </span>
          )}
          <div className="flex-1 text-xs">
            <p className="font-semibold">{estado === "ok" ? mensaje : "Archivo asignado."}</p>
            <a
              href={url}
              target="_blank"
              className="text-[var(--color-accent)] underline"
              rel="noreferrer"
            >
              Abrir
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
