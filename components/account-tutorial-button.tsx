"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AccountTutorialButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => {
        window.localStorage.setItem("katia:show-onboarding", "1");
        window.localStorage.removeItem("katia:onboarding-hidden");
        router.push("/");
      }}
    >
      Ver tutorial
    </Button>
  );
}
