import type { ReactNode } from "react";

type AuthSplitLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthSplitLayout({ title, subtitle, children }: AuthSplitLayoutProps) {
  return (
    <main className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <section className="relative flex items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-10">
        <div className="auth-orb-bg -left-20 top-4 h-56 w-56 bg-[var(--accent-primary)]" />
        <div className="auth-orb-bg -right-16 bottom-0 h-64 w-64 bg-[var(--accent-secondary)]" />
        <div className="auth-orb-bg left-1/3 top-1/2 h-40 w-40 bg-white/50" />

        <div className="relative z-10 w-full max-w-md rounded-[var(--border-radius-card)] border border-white/10 bg-white/5 p-7 shadow-[var(--shadow-card)] backdrop-blur-[20px]">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Katia Suite</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{subtitle}</p>
          {children}
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[var(--bg-sidebar)] md:block">
        <div className="login-sphere auth-float-sphere left-[8%] top-[10%] h-72 w-72 bg-[var(--accent-primary)]/45" />
        <div className="login-sphere auth-float-sphere right-[18%] top-[30%] h-48 w-48 bg-[var(--accent-secondary)]/40 [animation-delay:0.8s]" />
        <div className="login-sphere auth-float-sphere bottom-[18%] left-[22%] h-24 w-24 bg-white/35 [animation-delay:1.5s]" />
        <div className="login-sphere auth-float-sphere bottom-[10%] right-[10%] h-56 w-56 bg-[var(--accent-primary)]/28 [animation-delay:2s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.14),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(6,182,212,0.14),transparent_50%)]" />
        <div className="absolute inset-x-0 bottom-[16%] px-10">
          <p className="text-3xl font-semibold tracking-[0.14em] text-[var(--text-primary)]">Katia Suite</p>
          <p className="mt-3 max-w-sm text-sm text-[var(--text-secondary)]">
            Control total del taller con una experiencia moderna, rápida y segura.
          </p>
        </div>
      </section>
    </main>
  );
}
