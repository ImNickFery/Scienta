"use client";

import { useId } from "react";

interface EnvironmentProps {
  /** Overrides the default kind label — e.g. label="قضیه" for Persian content. */
  label?: string;
  title?: string;
  children: React.ReactNode;
}

function TheoremEnvironment({
  kind,
  accent,
  title,
  children,
}: {
  kind: string;
  accent: string;
  title?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      id={`env-${id}`}
      className="not-prose my-8 rounded-2xl border p-5"
      style={{ borderColor: `${accent}40`, background: `${accent}0A` }}
    >
      <p className="mb-2 font-[family-name:var(--font-display)] text-sm font-bold" style={{ color: accent }}>
        {kind}
        {title ? <span className="font-normal opacity-80"> — {title}</span> : null}
      </p>
      <div className="prose-scientific text-sm leading-relaxed [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}

export function Theorem({ label, title, children }: EnvironmentProps) {
  return (
    <TheoremEnvironment kind={label ?? "Theorem"} accent="var(--color-accent-purple)" title={title}>
      {children}
    </TheoremEnvironment>
  );
}

export function Lemma({ label, title, children }: EnvironmentProps) {
  return (
    <TheoremEnvironment kind={label ?? "Lemma"} accent="var(--color-accent-orange)" title={title}>
      {children}
    </TheoremEnvironment>
  );
}

export function Corollary({ label, title, children }: EnvironmentProps) {
  return (
    <TheoremEnvironment kind={label ?? "Corollary"} accent="var(--color-accent-red)" title={title}>
      {children}
    </TheoremEnvironment>
  );
}

export function Proof({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="not-prose my-6 border-s-2 border-(--color-border-strong) ps-4">
      <p className="mb-1.5 text-sm font-semibold italic text-(--color-text-tertiary)">{label ?? "Proof."}</p>
      <div className="prose-scientific text-sm leading-relaxed [&>p:last-child]:mb-0 [&>p:last-child]:inline">
        {children}
        <span className="ms-2 inline-block" aria-hidden="true">∎</span>
      </div>
    </div>
  );
}
