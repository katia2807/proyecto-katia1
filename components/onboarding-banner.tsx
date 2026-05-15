"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCircleCheck, IconCircleDashed } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type OnboardingStep = {
  label: string;
  done: boolean;
  href: string;
};

const STORAGE_KEY = "katia:onboarding-hidden";
const REACTIVATE_KEY = "katia:show-onboarding";

export function OnboardingBanner({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState(true);
  const allDone = steps.every((step) => step.done);

  useEffect(() => {
    const reactivated = window.localStorage.getItem(REACTIVATE_KEY) === "1";
    queueMicrotask(() => {
      if (reactivated) {
        window.localStorage.removeItem(REACTIVATE_KEY);
        window.localStorage.removeItem(STORAGE_KEY);
        setHidden(false);
        return;
      }
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1" || allDone);
    });
  }, [allDone]);

  if (hidden) return null;

  return (
    <Card className="border-[var(--color-accent)]/45 bg-[var(--color-accent-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Primeros pasos para operar Katia</CardTitle>
          <CardDescription>Se marcan automaticamente segun datos reales guardados.</CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "1");
            setHidden(true);
          }}
        >
          Ya lo se, ocultar
        </Button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.done ? IconCircleCheck : IconCircleDashed;
          return (
            <Link
              key={step.label}
              href={step.href}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-3 text-sm hover:border-[var(--color-border-strong)]"
            >
              <Icon className={step.done ? "size-5 text-[var(--color-success)]" : "size-5 text-[var(--color-warning)]"} />
              <p className="mt-2 font-semibold">{step.label}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{step.done ? "Listo" : "Pendiente"}</p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
