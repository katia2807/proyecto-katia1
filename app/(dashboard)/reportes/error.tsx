"use client";
import Link from "next/link";
export default function DataError({reset}:{reset:()=>void}){return <div role="alert" className="space-y-4 rounded-xl border border-[var(--color-border)] p-5"><h2 className="text-lg font-semibold">No se pudo cargar la información</h2><p>No se muestra un historial vacío ni se usan datos de muestra. Intenta nuevamente antes de registrar cambios.</p><button type="button" className="underline" onClick={reset}>Volver a intentar</button><p><Link className="underline" href="/">Volver al inicio</Link></p></div>;}
