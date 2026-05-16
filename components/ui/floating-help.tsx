"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { IconHelpCircle, IconX, IconRoute } from "@tabler/icons-react";

const pageInfo: { match: string; title: string; description: string; tips: string[] }[] = [
  {
    match: "/gerencial",
    title: "Centro de Mando",
    description: "Panel ejecutivo con KPIs en tiempo real, alertas críticas, flujo de caja, análisis de clientes y herramientas de gestión.",
    tips: [
      "Pestaña «Hoy»: ingresos del día, alertas urgentes y acciones a resolver.",
      "Pestaña «Pasado»: métricas del mes, top clientes y productos.",
      "Pestaña «Futuro»: cotizaciones pendientes y stock valorizado.",
      "Pestaña «Clientes 360°»: tabla masiva para gestionar, cambiar estado o eliminar clientes.",
    ],
  },
  {
    match: "/inventario",
    title: "Inventario",
    description: "Catálogo de productos con stock, movimientos (Kardex), alertas de reposición y valorización del inventario.",
    tips: [
      "En «Alertas» verás los productos con stock por debajo del mínimo.",
      "El Kardex registra cada entrada y salida con trazabilidad.",
      "El análisis Pareto/ABC vive en el Centro de Mando.",
      "Usa el código de producto para identificar rápido insumos vs. muebles.",
    ],
  },
  {
    match: "/cotizacion",
    title: "Cotizaciones",
    description: "Crea, edita y confirma cotizaciones. Desde aquí puedes cobrar, convertir a venta o generar PDF para el cliente.",
    tips: [
      "Primero revisa cotizaciones existentes antes de crear una nueva.",
      "Al aprobar una cotización puedes iniciar producción.",
      "Los cobros quedan conectados automáticamente con Caja.",
    ],
  },
  {
    match: "/caja",
    title: "Caja",
    description: "Registro inmutable de todos los movimientos de dinero. Separa ingresos/egresos de empresa y personales para ver la utilidad real.",
    tips: [
      "Cada fila abre el detalle completo del movimiento.",
      "Los movimientos personales no afectan la utilidad de la empresa.",
      "Agrega notas claras para que la auditoría sea fácil.",
    ],
  },
  {
    match: "/ventas/clientes",
    title: "Clientes",
    description: "Directorio de clientes con ficha individual (operaciones, cobros, historial). Gestiona y agrega desde aquí.",
    tips: [
      "Haz clic en una fila para ver la ficha 360° del cliente.",
      "Los pedidos activos y cobros vencidos aparecen en el detalle.",
      "Para gestión masiva (eliminar, cambiar estado) ve al Centro de Mando › Clientes 360°.",
    ],
  },
  {
    match: "/ventas",
    title: "Ventas",
    description: "Módulo de ventas de muebles, madera, aserradero y alquiler. Registra, confirma y genera comprobantes.",
    tips: [
      "Las ventas en borrador no afectan caja hasta que se confirman.",
      "Puedes importar ventas desde PDF para agilizar el registro.",
      "Las ventas confirmadas generan movimiento automático en Caja.",
    ],
  },
  {
    match: "/reportes",
    title: "Reportes",
    description: "Exportación de datos a Excel, análisis antifraude y auditoría de operaciones. Para decisiones estratégicas ve al Centro de Mando.",
    tips: [
      "Exporta a Excel con un clic para análisis externo.",
      "El Antifraude detecta anomalías y operaciones duplicadas.",
      "Los datos de reportes son inmutables — solo lectura.",
    ],
  },
  {
    match: "/configuracion",
    title: "Configuración",
    description: "Gestiona tu cuenta, datos de empresa y preferencias del sistema (tema, idioma, notificaciones).",
    tips: [
      "El tema oscuro/claro también cambia automáticamente según la hora del día.",
      "Los datos de empresa aparecen en cotizaciones y reportes.",
    ],
  },
  {
    match: "/ayuda",
    title: "Manual de usuario",
    description: "Guía completa del sistema con instrucciones por módulo, roles y preguntas frecuentes.",
    tips: [
      "Busca por sección o usa Ctrl+F para encontrar lo que necesitas.",
      "Las preguntas frecuentes resuelven los problemas más comunes.",
    ],
  },
  {
    match: "/admin/respaldo",
    title: "Respaldo",
    description: "Descarga respaldos manuales, resetea datos para entrega limpia y carga datos de bienvenida para demo.",
    tips: [
      "El reset borra datos operativos pero conserva configuración.",
      "Descarga el respaldo ANTES de hacer cualquier reset.",
    ],
  },
];

const defaultContent = {
  title: "Katia Suite",
  description: "ERP completo para gestión de ventas, inventario, caja, cotizaciones y clientes.",
  tips: [
    "Usa la búsqueda global (barra superior) para saltar a clientes, productos o cotizaciones.",
    "Los estados vacíos muestran el siguiente paso recomendado.",
    "El Centro de Mando es tu panel ejecutivo — empieza siempre por ahí.",
  ],
};

export function FloatingHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = useMemo(() => {
    return (
      pageInfo.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`)) ??
      defaultContent
    );
  }, [pathname]);

  function handleRestartTour() {
    try {
      localStorage.removeItem("katia_tour_done");
      localStorage.removeItem("katia_tour_step");
    } catch {
      // ignore
    }
    window.location.reload();
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-card,var(--bg-card))] p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-[var(--katia-text-primary)]">{content.title}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar ayuda" className="mt-0.5 shrink-0 text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]">
              <IconX className="size-4" />
            </button>
          </div>

          <p className="mt-2 text-sm text-[var(--katia-text-secondary)] leading-relaxed">
            {content.description}
          </p>

          <ul className="mt-3 space-y-1.5">
            {content.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-[var(--katia-text-tertiary)]">
                <span className="mt-0.5 shrink-0 size-1.5 rounded-full bg-[var(--katia-primary)]/60" />
                {tip}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--katia-border-subtle)] pt-3">
            <button
              type="button"
              onClick={handleRestartTour}
              className="flex items-center gap-2 rounded-lg bg-[var(--katia-primary)]/10 px-3 py-2 text-xs font-semibold text-[var(--katia-primary)] transition-colors hover:bg-[var(--katia-primary)]/20"
            >
              <IconRoute className="size-3.5" />
              Reiniciar tour completo del sistema
            </button>
            <a
              href="/ayuda"
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--katia-text-secondary)] transition-colors hover:bg-[var(--katia-surface-raised)] text-center"
            >
              Abrir manual de usuario →
            </a>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Abrir ayuda contextual"
        onClick={() => setOpen((v) => !v)}
        className="flex size-12 items-center justify-center rounded-full border border-[var(--katia-border-subtle)] bg-[var(--katia-primary)] text-white shadow-xl transition-transform hover:scale-105"
      >
        <IconHelpCircle className="size-6" />
      </button>
    </div>
  );
}
