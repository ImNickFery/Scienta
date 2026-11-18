import { Figure } from "./figure";

interface SideItem {
  src?: string;
  illustration?: "orbit" | "nebula" | "circuit" | "wave" | "molecule" | "field-lines";
  palette?: "purple" | "orange" | "red" | "aurora";
  alt: string;
  caption?: string;
}

export function SideBySide({ left, right }: { left: SideItem; right: SideItem }) {
  return (
    <div className="not-prose my-10 grid gap-4 sm:grid-cols-2">
      <Figure {...left} aspect="square" />
      <Figure {...right} aspect="square" />
    </div>
  );
}
