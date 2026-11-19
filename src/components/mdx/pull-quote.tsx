export function PullQuote({
  children,
  attribution,
  author,
}: {
  children: React.ReactNode;
  attribution?: string;
  author?: string;
}) {
  const credit = attribution ?? author;
  return (
    <blockquote className="pull-quote not-prose relative my-12 border-0 py-2 text-2xl sm:text-3xl">
      <span
        className="absolute -top-4 start-0 select-none text-6xl leading-none opacity-20"
        style={{ fontFamily: "var(--font-latin-display)", color: "var(--color-accent-purple)" }}
        aria-hidden="true"
      >
        &ldquo;
      </span>
      {/* A div, not a <p>: MDX parses the quote body as its own paragraph, so a
          <p> here would nest <p> inside <p>. That is invalid HTML — the parser
          closes the outer one, the client DOM stops matching the server HTML,
          and the whole article tree fails to hydrate. The child paragraph's
          margin is zeroed so the attribution keeps its original spacing. */}
      <div className="relative ps-8 text-gradient-purple-orange [&>p]:mb-0">{children}</div>
      {credit && <cite className="mt-4 block ps-8 text-sm not-italic text-(--color-text-tertiary)">— {credit}</cite>}
    </blockquote>
  );
}
