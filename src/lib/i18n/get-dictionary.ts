import type { Locale } from "./config";

const dictionaries = {
  fa: () => import("./dictionaries/fa").then((m) => m.default),
  en: () => import("./dictionaries/en").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  const loader = dictionaries[locale] ?? dictionaries.fa;
  return loader();
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
