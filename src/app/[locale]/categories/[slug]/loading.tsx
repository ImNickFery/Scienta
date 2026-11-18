import { Container } from "@/components/ui/container";
import { ArticleGridSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoryDetailLoading() {
  return (
    <Container className="py-20">
      <div className="mb-12 max-w-2xl space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-56" />
      </div>
      <ArticleGridSkeleton count={6} size="large" />
    </Container>
  );
}
