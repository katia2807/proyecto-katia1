"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import type { ClienteCompleto } from "@/lib/combobox-mocks";

export type GerencialClienteSearchSelectProps = {
  clientes: ClienteCompleto[];
  value?: string;
};

export function GerencialClienteSearchSelect({ clientes, value }: GerencialClienteSearchSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const options = useMemo(
    () => clientes,
    [clientes],
  );

  const handleChange = (id: string) => {
    const params = new URLSearchParams();
    if (id) params.set("cliente", id);
    const search = params.toString();
    router.push(`${pathname}${search ? `?${search}` : ""}`);
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Buscar cliente</span>
      <ClienteCombobox
        clientes={options}
        value={value ?? ""}
        onChange={handleChange}
        placeholder="Nombre, DNI, RUC o teléfono"
        inputAriaLabel="Buscar cliente"
      />
    </div>
  );
}
