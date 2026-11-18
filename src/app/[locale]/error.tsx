"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/animations/aurora-background";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[locale-error]", error);
  }, [error]);

  return (
    <section className="relative flex min-h-[70dvh] items-center overflow-hidden">
      <AuroraBackground />
      <Container className="relative text-center" size="narrow">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-accent-red)/15 text-(--color-accent-red)">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-(--color-text-primary)">
          مشکلی پیش آمد — Something went wrong
        </h1>
        <p className="mt-3 text-(--color-text-secondary)">
          صفحه با خطایی غیرمنتظره مواجه شد. لطفاً دوباره تلاش کنید.
          <br />
          This page hit an unexpected error. You can try again.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>بازتلاش / Try again</Button>
          <Button href="/fa" variant="secondary">بازگشت به خانه / Back home</Button>
        </div>
      </Container>
    </section>
  );
}
