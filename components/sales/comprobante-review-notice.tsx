type Item = { desc: string; advertenciaMedidas?: string };

export function ComprobanteReviewNotice({ items }: { items: readonly Item[] }) {
  const warnings = items.filter(item => item.advertenciaMedidas);
  if (!warnings.length) return null;
  return <aside role="status" data-comprobante-revision className="no-print print:hidden mx-auto my-4 w-full max-w-4xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
    <p className="font-semibold">Revisa las unidades antes de imprimir</p>
    <p className="mt-1">La descripción y las medidas registradas usan unidades distintas. Los datos y los importes se conservan.</p>
    <details className="mt-2">
      <summary className="cursor-pointer font-medium">Ver medidas por revisar ({warnings.length})</summary>
      <ul className="mt-2 list-inside list-disc space-y-2">
        {warnings.map((item, index) => <li key={index}><strong>{item.desc}:</strong> {item.advertenciaMedidas}</li>)}
      </ul>
    </details>
  </aside>;
}
