import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <Container size="narrow" className="py-20">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
    </Container>
  );
}
