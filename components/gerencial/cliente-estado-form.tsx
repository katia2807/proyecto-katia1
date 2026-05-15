"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateClienteEstado } from "@/app/actions";

type Props = {
  clienteId: string;
  estadoActual: string | null;
};

export function ClienteEstadoForm({ clienteId, estadoActual }: Props) {
  const [estado, setEstado] = useState(estadoActual ?? "activo");

  return (
    <form action={updateClienteEstado} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={clienteId} />
      <select
        name="estado"
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        className="h-11 w-full rounded-[var(--border-radius-input)] border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] outline-none ring-0 transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)]"
      >
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
        <option value="moroso">Moroso</option>
      </select>
      <Button type="submit">Guardar estado</Button>
    </form>
  );
}
