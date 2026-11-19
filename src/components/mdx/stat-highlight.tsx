export interface StatHighlightItem {
  value: string;
  label: string;
}

export function StatHighlight({
  stats,
  items,
  value,
  label,
}: {
  stats?: StatHighlightItem[];
  items?: StatHighlightItem[];
  value?: string;
  label?: string;
}) {
  const list: StatHighlightItem[] = Array.isArray(stats)
    ? stats
    : Array.isArray(items)
      ? items
      : value && label
        ? [{ value, label }]
        : [];

  if (list.length === 0) return null;

  return (
    <div className="not-prose my-10 grid grid-cols-2 gap-4 rounded-2xl border border-(--color-border-subtle) bg-gradient-to-br from-white/[0.04] to-transparent p-6 sm:grid-cols-3">
      {list.map((s, i) => (
        <div key={i} className="text-center">
          <p className="font-[family-name:var(--font-display)] text-3xl font-black text-gradient-aurora">{s.value}</p>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
