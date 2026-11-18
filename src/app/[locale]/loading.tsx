import { Container } from "@/components/ui/container";
import { ArticleGridSkeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="pt-24">
      <Container className="py-16">
        <div className="mb-10 h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <ArticleGridSkeleton count={3} size="large" />
      </Container>
      <Container className="py-16">
        <div className="mb-10 h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <ArticleGridSkeleton count={6} />
      </Container>
    </div>
  );
}
