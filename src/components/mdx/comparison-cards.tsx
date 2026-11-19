interface ComparisonColumn {
  title: string;
  highlight?: boolean;
  rows: string[];
}

const GRID_CLASSES: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function ComparisonCards({ columns }: { columns?: ComparisonColumn[] }) {
  const list = Array.isArray(columns) ? columns : [];
  if (list.length === 0) return null;
  const colCount = Math.min(Math.max(list.length, 1), 4);
  return (
    <div className={`not-prose my-10 grid grid-cols-1 gap-4 ${GRID_CLASSES[colCount] ?? ""}`}>
      {list.map((col, i) => (
        <div
          key={i}
          className={`rounded-2xl border p-5 ${
            col.highlight
              ? "border-(--color-accent-purple)/50 bg-gradient-to-b from-(--color-accent-purple)/10 to-transparent"
              : "border-(--color-border-subtle) bg-white/[0.02]"
          }`}
        >
          <h4 className="mb-4 font-[family-name:var(--font-display)] font-bold text-(--color-text-primary)">{col.title}</h4>
          <ul className="space-y-2.5">
            {(Array.isArray(col.rows) ? col.rows : []).map((row, j) => (
              <li key={j} className="text-sm leading-relaxed text-(--color-text-secondary)">{row}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
