"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type InventarioAccionesRapidasProps = {
  canMutate: boolean;
  noPermisoHint: React.ReactNode;
  children: React.ReactNode;
};

export function InventarioAccionesRapidas({
  canMutate,
  noPermisoHint,
  children,
}: InventarioAccionesRapidasProps) {
  const [minimizada, setMinimizada] = useState(false);

  if (minimizada) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Acciones rápidas de inventario ocultas. Úsalas solo cuando vayas a registrar productos o
          movimientos.
        </p>
        <Button type="button" variant="secondary" className="shrink-0" onClick={() => setMinimizada(false)}>
          Mostrar acciones rápidas
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex w-full min-w-0 flex-1 items-start justify-between gap-3 sm:max-w-xl">
        <div className="min-w-0">
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Solo se abre lo que elegiste.</CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-9 shrink-0 px-3 text-xs"
          onClick={() => setMinimizada(true)}
        >
          Ocultar acciones
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {!canMutate ? noPermisoHint : null}
        {canMutate ? children : null}
      </div>
    </Card>
  );
}
