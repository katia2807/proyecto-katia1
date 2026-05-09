import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type WhatsAppButtonProps = {
  telefono: string | null | undefined;
  mensaje?: string;
  /** Variante visual: pill (botón completo) o icon (solo icono). */
  variant?: "pill" | "icon";
  className?: string;
};

/** Devuelve el teléfono limpio: solo dígitos, sin "+" ni espacios. */
function normalizar(telefono: string): string {
  const limpio = telefono.replace(/\D/g, "");
  // Para Perú, si vienen 9 dígitos asumimos prefijo +51.
  if (limpio.length === 9 && !limpio.startsWith("51")) return `51${limpio}`;
  return limpio;
}

export function WhatsAppButton({
  telefono,
  mensaje,
  variant = "icon",
  className,
}: WhatsAppButtonProps) {
  if (!telefono?.trim()) return null;
  const numero = normalizar(telefono);
  const url = `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;

  if (variant === "pill") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110",
          className,
        )}
      >
        <MessageCircle className="size-3.5" />
        WhatsApp
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Enviar WhatsApp"
      aria-label="Enviar WhatsApp"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-110",
        className,
      )}
    >
      <MessageCircle className="size-3.5" />
    </a>
  );
}
