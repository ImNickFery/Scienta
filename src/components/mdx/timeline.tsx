interface TimelineEvent {
  year: string;
  title: string;
  description?: string;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="not-prose my-10 space-y-0">
      {events.map((event, i) => (
        <div key={i} className="relative flex gap-5 pb-8 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute top-8 bottom-0 start-[15px] w-px bg-gradient-to-b from-(--color-accent-purple)/50 to-transparent" />
          )}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-orange) text-xs font-bold text-white">
            {i + 1}
          </div>
          <div className="pt-0.5">
            <p className="text-xs font-semibold text-(--color-accent-orange)">{event.year}</p>
            <h4 className="mt-0.5 font-[family-name:var(--font-display)] font-bold text-(--color-text-primary)">{event.title}</h4>
            {event.description && <p className="mt-1 text-sm leading-relaxed text-(--color-text-tertiary)">{event.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
