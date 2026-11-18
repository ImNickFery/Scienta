import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function FieldsLoading() {
  return (
    <Container className="py-20">
      <div className="mb-12 max-w-2xl space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card-elevated flex items-center gap-4 rounded-2xl p-6">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
