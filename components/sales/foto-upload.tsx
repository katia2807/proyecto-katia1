"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { subirArchivo, type EstadoArchivoUpload, type BucketArchivo } from "@/lib/archivo-upload";

type FotoUploadProps = {
  /** Bucket destino dentro de data/uploads/. */
  bucket: BucketArchivo;
  /** Nombre del input hidden que reportará la URL guardada. */
  name: string;
  /** Etiqueta del campo. */
  label: string;
  /** URL inicial cuando se está editando un recurso existente. */
  defaultUrl?: string;
  disabled?: boolean;
  onStateChange?: (estado: EstadoArchivoUpload) => void;
};

/**
 * Sube un archivo (imagen/PDF) a `/api/uploads`, muestra un preview y mantiene
 * la URL resultante en un input hidden listo para enviarse al server action.
 */
export function FotoUpload({ bucket, name, label, defaultUrl = "", disabled = false, onStateChange }: FotoUploadProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [estado, setEstado] = useState<EstadoArchivoUpload>("idle");
  const subiendo = useRef(false);
  const [mensaje, setMensaje] = useState<string>("");

  useEffect(() => {
    setUrl(defaultUrl);
  }, [defaultUrl]);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || subiendo.current) return;
    subiendo.current = true;
    setEstado("subiendo");
    onStateChange?.("subiendo");
    setMensaje("Preparando archivo...");
    try {
      const nuevaUrl = await subirArchivo(file, bucket);
      setUrl(nuevaUrl);
      setEstado("ok");
      onStateChange?.("ok");
      setMensaje("Archivo guardado con éxito.");
    } catch (err) {
      setEstado("error");
      onStateChange?.("error");
      setMensaje(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo subir el archivo. Intenta de nuevo.",
      );
      // Permite volver a elegir el mismo archivo tras un fallo de conexión.
      input.value = "";
    } finally {
      subiendo.current = false;
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
          disabled={disabled || estado === "subiendo"}
          className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)] disabled:opacity-50 disabled:pointer-events-none"
        />
      </label>
      <input type="hidden" name={name} value={url} />
      {estado === "subiendo" ? (
        <p role="status" className="text-xs text-[var(--color-text-secondary)]">Subiendo…</p>
      ) : null}
      {estado === "error" ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">{mensaje}</p>
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
