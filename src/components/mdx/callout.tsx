import { Info, AlertTriangle, Lightbulb } from "lucide-react";

const variants = {
  info: { Icon: Info, color: "var(--color-accent-purple)" },
  warning: { Icon: AlertTriangle, color: "var(--color-accent-red)" },
  tip: { Icon: Lightbulb, color: "var(--color-accent-orange)" },
  insight: { Icon: Lightbulb, color: "var(--color-accent-purple)" },
};

export function Callout({
  type,
  variant,
  title,
  children,
}: {
  type?: keyof typeof variants | string;
  variant?: keyof typeof variants | string;
  title?: string;
  children: React.ReactNode;
}) {
  const key = (type ?? variant ?? "info") as keyof typeof variants;
  const { Icon, color } = variants[key] ?? variants.info;
  return (
    <div
      className="my-8 flex gap-3 rounded-2xl border p-5"
      style={{ borderColor: `${color}40`, background: `${color}0D` }}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color }} />
      <div className="text-sm leading-relaxed text-(--color-text-secondary)">
        {title && <p className="mb-1 font-semibold text-(--color-text-primary)">{title}</p>}
        {children}
      </div>
    </div>
  );
}
