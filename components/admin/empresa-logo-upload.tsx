"use client";

import { useActionState } from "react";
import {
  clearEmpresaLogo,
  type EmpresaLogoFormState,
  uploadEmpresaLogo,
} from "@/app/(dashboard)/admin/empresa/actions";
import { Button } from "@/components/ui/button";
import type { EmpresaConfig } from "@/lib/company-config";

const logoInitial: EmpresaLogoFormState = {};

async function clearLogoFormAction(prev: EmpresaLogoFormState, formData: FormData) {
  void prev;
  void formData;
  return clearEmpresaLogo();
}

type EmpresaLogoUploadProps = {
  empresa: EmpresaConfig;
};

export function EmpresaLogoUpload({ empresa }: EmpresaLogoUploadProps) {
  const [state, uploadAction, uploadPending] = useActionState(uploadEmpresaLogo, logoInitial);
  const [clearState, clearAction, clearPending] = useActionState(clearLogoFormAction, logoInitial);

  const message = state.error ?? state.success ?? clearState.error ?? clearState.success;
  const isError = Boolean(state.error || clearState.error);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Formato <strong>PNG</strong> (ideal para logo sin fondo). Tamano maximo 2 MB. Se almacena en Supabase
        Storage y aparece en el encabezado de los PDFs.
      </p>

      {empresa.logo_url ? (
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={empresa.logo_url}
            alt={`Logo de ${empresa.nombre}`}
            className="h-16 max-w-[200px] rounded-lg border border-[var(--color-border)] bg-white object-contain p-1"
            width={160}
            height={64}
          />
          <form action={clearAction}>
            <Button type="submit" variant="danger" disabled={clearPending}>
              {clearPending ? "Quitando..." : "Quitar logo"}
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No hay logo: los PDFs muestran el icono generico.
        </p>
      )}

      <form action={uploadAction} className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label
            htmlFor="empresa-logo-file"
            className="text-sm font-medium text-[var(--color-text-primary)]"
          >
            Subir PNG
          </label>
          <input
            id="empresa-logo-file"
            name="logo"
            type="file"
            accept="image/png,.png"
            required
            className="block w-full max-w-sm text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary-soft)] file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
        <Button type="submit" disabled={uploadPending}>
          {uploadPending ? "Subiendo..." : "Guardar logo"}
        </Button>
      </form>

      {message ? (
        <p
          className={
            isError
              ? "rounded-xl border border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-danger)]"
              : "rounded-xl border border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-success)]"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
