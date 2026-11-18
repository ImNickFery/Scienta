import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)} style={style} />;
}

export function ArticleCardSkeleton({ size = "default" }: { size?: "default" | "large" | "compact" }) {
  if (size === "compact") {
    return (
      <div className="card-elevated flex items-center gap-4 rounded-(--radius-card) p-3">
        <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }
  return (
    <div className="card-elevated overflow-hidden rounded-(--radius-card)">
      <Skeleton className={cn("w-full rounded-none", size === "large" ? "aspect-[16/9]" : "aspect-[4/3]")} />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function ArticleGridSkeleton({ count = 6, size = "default" }: { count?: number; size?: "default" | "large" | "compact" }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6", size === "compact" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} size={size} />
      ))}
    </div>
  );
}
