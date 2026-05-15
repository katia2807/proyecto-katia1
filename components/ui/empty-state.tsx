import Link from "next/link";
import { IconInbox } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--bg-surface)] text-[var(--color-text-secondary)]">
        <IconInbox className="size-7" />
      </div>
      <CardTitle className="mt-4">{title}</CardTitle>
      <CardDescription className="mt-2 max-w-lg">{description}</CardDescription>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="mt-4">
          <Button type="button">{actionLabel}</Button>
        </Link>
      ) : null}
    </Card>
  );
}
