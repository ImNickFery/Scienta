import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/animations/aurora-background";
import { Starfield } from "@/components/animations/starfield";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70dvh] items-center overflow-hidden">
      <AuroraBackground />
      <Starfield density={60} />
      <Container className="relative text-center" size="narrow">
        <p className="font-[family-name:var(--font-display)] text-8xl font-black text-gradient-aurora">404</p>
        <h1 className="mt-4 text-2xl font-bold text-(--color-text-primary)">
          این صفحه در فضازمان ما یافت نشد — This page doesn&rsquo;t exist in our spacetime
        </h1>
        <p className="mt-3 text-(--color-text-secondary)">
          شاید به سیاه‌چاله‌ای سقوط کرده — Perhaps it fell into a black hole.
        </p>
        <div className="mt-8">
          <Button href="/fa">بازگشت به خانه / Back Home</Button>
        </div>
      </Container>
    </section>
  );
}
