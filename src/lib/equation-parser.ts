import { SYMBOL_GLOSSARY, lookupSymbol, type SymbolDefinition } from "./equation-glossary";

// LaTeX commands that are structural/operators/formatting, never variables.
// This mainly prevents wasted candidate lookups for very common commands;
// the real safety net is that extractKnownSymbols only ever returns
// glossary matches, never a guess.
const STRUCTURAL_COMMANDS = new Set([
  "frac", "sum", "left", "right", "begin", "end", "times", "cdot", "quad",
  "qquad", "text", "mathrm", "mathbf", "boldsymbol", "partial", "nabla",
  "int", "infty", "leftrangle", "rightrangle", "langle", "rangle", "leftarrow",
  "rightarrow", "Leftarrow", "Rightarrow", "leftrightarrow", "approx", "propto",
  "leq", "geq", "neq", "pm", "mp", "sqrt", "overline", "underline", "hat",
  "vec", "dot", "ddot", "prime", "circ", "perp", "parallel", "in", "notin",
  "subset", "cup", "cap", "emptyset", "forall", "exists", "log", "ln", "exp",
  "sin", "cos", "tan", "lim", "max", "min", "sup", "inf", "det", "dim", "ker",
]);

/**
 * Scans raw LaTeX source for tokens that match entries in the symbol
 * glossary. Returns only recognized symbols — deliberately does not
 * attempt to identify or label unrecognized single letters, since a
 * plausible-looking but wrong guess is worse than surfacing nothing.
 */
export function extractKnownSymbols(latex: string): SymbolDefinition[] {
  const found = new Map<string, SymbolDefinition>();

  // 1) Multi-character/subscripted tokens the glossary defines explicitly
  //    (e.g. "r_s", "T_{\mu\nu}") — matched as a unit before single-token
  //    extraction below would otherwise split them apart.
  for (const entry of SYMBOL_GLOSSARY) {
    for (const token of entry.tokens) {
      if (token.length > 1 && latex.includes(token)) {
        found.set(entry.name.en, entry);
        break;
      }
    }
  }

  // 2) Greek letters and other LaTeX commands: \alpha, \hbar, \pi, \Lambda...
  for (const match of latex.matchAll(/\\([a-zA-Z]+)/g)) {
    const command = match[1];
    if (STRUCTURAL_COMMANDS.has(command)) continue;
    const def = lookupSymbol(`\\${command}`);
    if (def) found.set(def.name.en, def);
  }

  // 3) Bare single-letter variables (G, M, c, L...) — only kept if the
  //    glossary has an exact entry; every other bare letter is left
  //    intentionally unlabeled.
  for (const match of latex.matchAll(/(?<![a-zA-Z\\])([a-zA-Z])(?![a-zA-Z])/g)) {
    const def = lookupSymbol(match[1]);
    if (def) found.set(def.name.en, def);
  }

  return Array.from(found.values());
}
