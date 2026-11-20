import Link from "next/link";
import { Marquee } from "@/components/animations/marquee";
import { getFields } from "@/lib/taxonomy";
import type { Locale } from "@/lib/i18n/config";

/**
 * A thin ticker of every scientific field, sitting directly under the hero.
 *
 * Its job is breadth: before the reader commits to scrolling, one glance
 * says how wide the subject matter runs. The strip is duplicated inside
 * <Marquee> for the seamless loop, so each entry appears twice in the DOM —
 * the second copy is aria-hidden by the marquee itself, and the links stay
 * real links in the first.
 */
export async function TopicsTicker({ locale }: { locale: Locale }) {
  const fields = await getFields();
  if (fields.length === 0) return null;

  const decorativeTwin = fields.map((field) => (
    <span
      key={field.slug}
      className="mx-4 inline-flex shrink-0 items-center gap-2.5 text-sm text-(--color-text-tertiary)"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: field.color }}
      />
      <span className="whitespace-nowrap">{field.name[locale]}</span>
    </span>
  ));

  return (
    <div className="relative overflow-hidden border-b border-(--color-border-subtle) bg-(--color-bg-deep) py-5">
      <Marquee duration={48} duplicate={decorativeTwin}>
        {fields.map((field) => (
          <Link
            key={field.slug}
            href={`/${locale}/fields/${field.slug}`}
            className="group mx-4 inline-flex shrink-0 items-center gap-2.5 text-sm text-(--color-text-tertiary) transition-colors duration-300 hover:text-(--color-text-primary)"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-150"
              style={{ background: field.color }}
            />
            <span className="whitespace-nowrap">{field.name[locale]}</span>
          </Link>
        ))}
      </Marquee>
    </div>
  );
}
