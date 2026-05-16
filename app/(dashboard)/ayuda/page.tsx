import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const SECCIONES = [
  {
    rol: "Dueña / Administrador",
    color: "var(--katia-primary)",
    pasos: [
      { titulo: "Centro de Mando", descripcion: "Tu pantalla principal. Ve ingresos del día, pendientes urgentes y atajos directos.", href: "/gerencial" },
      { titulo: "Reportes y auditoría", descripcion: "Exporta datos a Excel, revisa el historial de caja y genera cierres mensuales firmados.", href: "/reportes" },
      { titulo: "Configuración", descripcion: "Actualiza los datos de tu empresa, cuenta y preferencias de visualización.", href: "/configuracion" },
      { titulo: "Respaldo", descripcion: "Consulta el estado de tus datos y accede al panel de Supabase para backups automáticos.", href: "/admin/respaldo" },
    ],
  },
  {
    rol: "Vendedor",
    color: "var(--katia-accent-cyan)",
    pasos: [
      { titulo: "Registrar una venta", descripcion: "Ve a Ventas, selecciona el tipo de venta (mueble, madera, aserradero, etc.) y completa el formulario.", href: "/ventas" },
      { titulo: "Crear una cotización", descripcion: "En Cotizaciones, crea una nueva cotización con líneas de productos y el cliente correspondiente.", href: "/cotizacion" },
      { titulo: "Agregar un cliente", descripcion: "Desde Clientes puedes registrar un cliente nuevo en segundos.", href: "/ventas/clientes" },
      { titulo: "Registrar un movimiento de caja", descripcion: "En Caja, registra ingresos o egresos con categoría y notas opcionales.", href: "/caja" },
    ],
  },
  {
    rol: "Almacén",
    color: "var(--katia-success)",
    pasos: [
      { titulo: "Ver el inventario", descripcion: "En Inventario puedes ver todos los productos, su stock actual y los productos con stock bajo.", href: "/inventario" },
      { titulo: "Agregar un producto", descripcion: "Usa el formulario de inventario para registrar un nuevo producto con su código automático.", href: "/inventario?tab=productos" },
      { titulo: "Registrar un movimiento de stock", descripcion: "Desde el Kardex puedes registrar entradas y salidas de stock con trazabilidad completa.", href: "/inventario?tab=kardex" },
    ],
  },
];

const FAQS = [
  {
    pregunta: "¿Cómo cambio el tema de la interfaz?",
    respuesta: "Usa el ícono ☀️/🌙 en la barra superior derecha. El sistema también cambia automáticamente según la hora del día.",
  },
  {
    pregunta: "¿Los documentos generados tienen validez fiscal?",
    respuesta: "No. Todos los documentos (cotizaciones, contratos, reportes) son internos y privados. No tienen referencias fiscales oficiales.",
  },
  {
    pregunta: "¿Cómo exporto mis datos?",
    respuesta: "En Reportes puedes exportar todo a Excel con un solo clic. El archivo incluye todas las hojas operativas (caja, ventas, inventario, etc.).",
  },
  {
    pregunta: "¿Puedo usar el sistema en el celular?",
    respuesta: "Sí. El sistema está optimizado para tablets y celulares. En pantallas pequeñas, el menú lateral se oculta y se accede desde el ícono de menú.",
  },
  {
    pregunta: "¿Qué pasa si un producto llega a stock cero?",
    respuesta: "El sistema muestra alertas en el Centro de Mando y en el ícono de Inventario en el menú lateral. No bloquea operaciones pero avisa claramente.",
  },
];

export default function AyudaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Manual de usuario</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Guía rápida por rol. Si tienes dudas, contacta al administrador del sistema.
        </p>
      </div>

      {SECCIONES.map((seccion) => (
        <section key={seccion.rol}>
          <div
            className="mb-3 inline-flex items-center rounded-[var(--katia-radius-pill)] border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: seccion.color, color: seccion.color }}
          >
            {seccion.rol}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {seccion.pasos.map((paso) => (
              <Link key={paso.href} href={paso.href}>
                <Card className="h-full cursor-pointer transition-all duration-150 hover:border-[var(--katia-border-emphasis)] hover:bg-[var(--katia-primary-soft)]">
                  <CardTitle className="text-sm">{paso.titulo}</CardTitle>
                  <CardDescription className="mt-1 text-xs">{paso.descripcion}</CardDescription>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="mb-4 text-lg font-semibold text-[var(--katia-text-primary)]">Preguntas frecuentes</h3>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.pregunta}
              className="group rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-[var(--katia-text-primary)] list-none flex items-center justify-between">
                {faq.pregunta}
                <span className="text-[var(--katia-text-tertiary)] transition-transform group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[var(--katia-text-secondary)]">{faq.respuesta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
