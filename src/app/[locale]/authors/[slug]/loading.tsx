import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthorDetailLoading() {
  return (
    <Container size="narrow" className="py-20">
      <div className="mb-12 flex flex-col items-center gap-4 text-center">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full max-w-xl" />
      </div>
    </Container>
  );
}
