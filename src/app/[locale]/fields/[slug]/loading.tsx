import { Container } from "@/components/ui/container";
import { ArticleGridSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function FieldDetailLoading() {
  return (
    <Container className="py-20">
      <div className="mb-12 max-w-2xl space-y-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <ArticleGridSkeleton count={6} size="large" />
    </Container>
  );
}
