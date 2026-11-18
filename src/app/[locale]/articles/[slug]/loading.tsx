import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleLoading() {
  return (
    <>
      <section className="border-b border-(--color-border-subtle) py-20 sm:py-28">
        <Container>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-6 w-24 rounded-full" />
          <Skeleton className="mt-5 h-10 w-3/4 max-w-2xl" />
          <Skeleton className="mt-3 h-10 w-1/2 max-w-xl" />
          <Skeleton className="mt-6 h-5 w-full max-w-lg" />
          <div className="mt-8 flex gap-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </Container>
      </section>
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
          <div className="mx-auto max-w-3xl space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={i % 3 === 0 ? "h-8 w-2/3" : "h-4 w-full"} />)}
          </div>
        </div>
      </Container>
    </>
  );
}
