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
    <div className="not-prose my-8 grid grid-cols-2 gap-4 rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-secondary)/70 p-5 sm:my-10 sm:grid-cols-3 sm:p-6">
      {list.map((s, i) => {
        const spanFullOnMobile = list.length % 2 === 1 && i === list.length - 1;
        return (
          <div
            key={i}
            className={`text-center ${spanFullOnMobile ? "col-span-2 border-t border-(--color-border-subtle) pt-4 sm:col-span-1 sm:border-t-0 sm:pt-0" : ""}`}
          >
            <p className="font-[family-name:var(--font-display)] text-2xl font-black text-gradient-aurora sm:text-3xl">
              {s.value}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}
