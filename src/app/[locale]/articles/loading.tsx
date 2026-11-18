import { Container } from "@/components/ui/container";
import { ArticleGridSkeleton } from "@/components/ui/skeleton";

export default function ArticlesLoading() {
  return (
    <Container className="py-20">
      <div className="mb-12 max-w-2xl space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-10 w-64 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <ArticleGridSkeleton count={9} size="large" />
    </Container>
  );
}
