import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import styles from "./login-layout.module.css";

export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <header className={styles.brandRow}>
          <div className={styles.brand}><BrandMark /><span>Katia Suite</span></div>
          <ThemeToggle />
        </header>
        <div className={styles.intro}>
          <h1 id="login-title">Qué gusto verte</h1>
          <p>Ingresa para continuar con tu negocio.</p>
        </div>
        {children}
      </section>
      <footer className={styles.footer}>
        <Link href="/legal/privacidad">Privacidad</Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal/terminos">Términos</Link>
      </footer>
    </main>
  );
}
