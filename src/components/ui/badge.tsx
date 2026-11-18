import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-3 py-1 text-xs font-medium text-(--color-text-secondary)",
        className
      )}
    >
      {children}
    </span>
  );
}
