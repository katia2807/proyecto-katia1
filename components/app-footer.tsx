import Link from "next/link";
import { APP_LAST_UPDATE, APP_VERSION } from "@/lib/app-version";
import { cn } from "@/lib/utils";


type AppFooterProps = {
  className?: string;
  companyName?: string | null;
};

export function AppFooter({ className, companyName }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto border-t border-[var(--katia-border-subtle)] px-4 py-3 md:px-6",
        "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-[var(--katia-text-tertiary)]">
        {companyName ? (
          <span className="font-medium text-[var(--katia-text-secondary)]">{companyName}</span>
        ) : null}
        {companyName ? " Â· " : null}
        Katia Suite
      </p>
      <div className="flex items-center gap-3">
        <p className="text-xs text-[var(--katia-text-disabled)]">
          Versión {APP_VERSION} · Actualizado: {APP_LAST_UPDATE}
        </p>
        <Link href="/legal/terminos" className="text-xs text-[var(--katia-text-disabled)] hover:text-[var(--katia-text-tertiary)]">
          TÃ©rminos
        </Link>
        <Link href="/legal/privacidad" className="text-xs text-[var(--katia-text-disabled)] hover:text-[var(--katia-text-tertiary)]">
          Privacidad
        </Link>
      </div>
    </footer>
  );
}
