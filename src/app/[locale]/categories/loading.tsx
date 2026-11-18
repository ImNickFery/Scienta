import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <Container className="py-20">
      <div className="mb-12 max-w-2xl space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-full" style={{ width: `${5 + (i % 5) * 1.5}rem` }} />
        ))}
      </div>
    </Container>
  );
}
