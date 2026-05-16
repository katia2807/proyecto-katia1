import Link from "next/link";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[var(--katia-bg-base)] px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 inline-block text-sm font-semibold text-[var(--katia-primary)] hover:underline">
          ← Volver al sistema
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--katia-text-primary)]">
          Términos de uso
        </h1>
        <p className="mt-2 text-sm text-[var(--katia-text-secondary)]">
          Última actualización: mayo 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--katia-text-secondary)]">
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">1. Uso del sistema</h2>
            <p>
              Katia Suite es un sistema de gestión privado destinado exclusivamente al uso interno de la organización
              propietaria. El acceso está restringido a usuarios autorizados con credenciales válidas.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">2. Confidencialidad</h2>
            <p>
              Toda la información registrada en el sistema (clientes, ventas, inventario, reportes financieros)
              es confidencial y no debe ser compartida con terceros no autorizados.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">3. Responsabilidad</h2>
            <p>
              El usuario es responsable de las acciones realizadas con sus credenciales. El uso indebido del sistema
              puede resultar en la revocación del acceso.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">4. Modificaciones</h2>
            <p>
              El propietario del sistema se reserva el derecho de modificar estos términos en cualquier momento.
              Los cambios serán comunicados a los usuarios autorizados.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">5. Documentos internos</h2>
            <p>
              Los documentos generados por este sistema (cotizaciones, reportes, contratos) son de uso interno
              y no constituyen documentos fiscales oficiales.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
