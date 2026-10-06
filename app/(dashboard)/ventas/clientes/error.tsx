"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

export default function ClientesError({ reset }: { reset: () => void }) {
  return <Card className="space-y-3" role="alert">
    <CardTitle>No se pudieron cargar los datos de Clientes</CardTitle>
    <CardDescription>Intenta de nuevo. El historial y los importes no se muestran hasta completar la consulta.</CardDescription>
    <Button onClick={reset}>Intentar de nuevo</Button>
  </Card>;
}
