import Link from "next/link";

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[var(--katia-bg-base)] px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 inline-block text-sm font-semibold text-[var(--katia-primary)] hover:underline">
          ← Volver al sistema
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--katia-text-primary)]">
          Política de privacidad
        </h1>
        <p className="mt-2 text-sm text-[var(--katia-text-secondary)]">
          Última actualización: mayo 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--katia-text-secondary)]">
          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">1. Datos que se recopilan</h2>
            <p>
              El sistema almacena información operativa ingresada por los usuarios autorizados: datos de clientes,
              registros de ventas, movimientos de inventario y de caja. No se recopilan datos personales de navegación
              más allá de los necesarios para el funcionamiento del sistema.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">2. Uso de los datos</h2>
            <p>
              Los datos son utilizados exclusivamente para las operaciones internas de la organización propietaria.
              No se comparten, venden ni transfieren a terceros.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">3. Almacenamiento</h2>
            <p>
              Los datos se almacenan en una base de datos segura con acceso restringido por autenticación y
              políticas de seguridad a nivel de fila (Row Level Security). Los accesos son auditados.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">4. Acceso a los datos</h2>
            <p>
              Solo usuarios con credenciales válidas y roles asignados pueden acceder al sistema.
              Los roles determinan qué información puede ver o modificar cada usuario.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-[var(--katia-text-primary)]">5. Retención</h2>
            <p>
              Los datos operativos se conservan según las necesidades del negocio. El propietario del sistema
              puede realizar respaldos y eliminaciones controladas desde el módulo de respaldo.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
