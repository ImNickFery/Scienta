export interface SymbolDefinition {
  /** The LaTeX token(s) that map to this symbol, e.g. ["G"], ["\\hbar"], ["r_s", "r_{s}"] */
  tokens: string[];
  name: { fa: string; en: string };
  unit?: { fa: string; en: string };
  description: { fa: string; en: string };
  /** Optional link to a related field page, e.g. "/fields/quantum" (locale prefix added at render time) */
  relatedField?: string;
}

/**
 * Common physics & math symbols. This is intentionally a curated, hand-
 * verified list rather than an attempt at exhaustive LaTeX symbol coverage —
 * a wrong or fabricated definition is worse than no definition, so the
 * Equation Explorer only surfaces entries it actually finds here, and shows
 * a bare "unrecognized symbol" affordance for anything else rather than
 * guessing.
 */
export const SYMBOL_GLOSSARY: SymbolDefinition[] = [
  {
    tokens: ["G"],
    name: { fa: "ثابت گرانش نیوتن", en: "Newtonian gravitational constant" },
    unit: { fa: "N·m²/kg²", en: "N·m²/kg²" },
    description: {
      fa: "ثابت تناسب در قانون گرانش نیوتن و معادلات میدان انیشتین که قدرت جفت‌شدگی گرانش با جرم و انرژی را تعیین می‌کند.",
      en: "The proportionality constant in Newton's law of gravitation and Einstein's field equations, setting how strongly gravity couples to mass and energy.",
    },
    relatedField: "/fields/physics",
  },
  {
    tokens: ["M"],
    name: { fa: "جرم", en: "Mass" },
    unit: { fa: "kg", en: "kg" },
    description: {
      fa: "جرم جسم مورد بررسی، معمولاً یک ستاره، سیاه‌چاله یا جرم مرکزی.",
      en: "The mass of the object under consideration — typically a star, black hole, or central mass.",
    },
    relatedField: "/fields/astronomy",
  },
  {
    tokens: ["c"],
    name: { fa: "سرعت نور", en: "Speed of light" },
    unit: { fa: "m/s", en: "m/s" },
    description: {
      fa: "سرعت نور در خلأ، یکی از ثابت‌های بنیادین فیزیک و حد سرعت برای انتقال اطلاعات و انرژی.",
      en: "The speed of light in vacuum — a fundamental constant of physics and the universal speed limit for information and energy.",
    },
    relatedField: "/fields/physics",
  },
  {
    tokens: ["r_s", "r_{s}"],
    name: { fa: "شعاع شوارتزشیلد", en: "Schwarzschild radius" },
    unit: { fa: "m", en: "m" },
    description: {
      fa: "شعاع افق رویداد یک سیاه‌چاله غیرچرخان؛ فاصله‌ای از مرکز که در آن سرعت گریز برابر سرعت نور می‌شود.",
      en: "The event-horizon radius of a non-rotating black hole — the distance from the center at which escape velocity equals the speed of light.",
    },
    relatedField: "/fields/astronomy",
  },
  {
    tokens: ["\\hbar"],
    name: { fa: "ثابت پلانک کاهش‌یافته", en: "Reduced Planck constant" },
    unit: { fa: "J·s", en: "J·s" },
    description: {
      fa: "ثابت پلانک تقسیم بر ۲π؛ مقیاس بنیادین کوانتش کنش و تکانه زاویه‌ای در مکانیک کوانتومی.",
      en: "Planck's constant divided by 2π — the fundamental scale of action and angular-momentum quantization in quantum mechanics.",
    },
    relatedField: "/fields/quantum",
  },
  {
    tokens: ["\\alpha"],
    name: { fa: "آلفا", en: "Alpha" },
    description: {
      fa: "معمولاً برای نمایش یک ضریب، زاویه یا دامنه احتمال در معادله به کار می‌رود.",
      en: "Commonly used for a coefficient, angle, or probability amplitude, depending on context.",
    },
  },
  {
    tokens: ["\\beta"],
    name: { fa: "بتا", en: "Beta" },
    description: {
      fa: "معمولاً برای نمایش یک ضریب یا دامنه احتمال دوم در معادله به کار می‌رود.",
      en: "Commonly used for a second coefficient or probability amplitude, complementary to alpha.",
    },
  },
  {
    tokens: ["\\psi", "|\\psi\\rangle"],
    name: { fa: "تابع موج", en: "Wave function" },
    description: {
      fa: "تابعی که حالت کوانتومی یک سامانه را توصیف می‌کند؛ مربع اندازه آن چگالی احتمال یافتن سامانه در یک حالت را می‌دهد.",
      en: "A function describing the quantum state of a system; its squared magnitude gives the probability density of finding the system in a given state.",
    },
    relatedField: "/fields/quantum",
  },
  {
    tokens: ["\\sigma"],
    name: { fa: "تابع فعال‌سازی", en: "Activation function" },
    description: {
      fa: "در شبکه‌های عصبی، تابعی غیرخطی (مانند سیگموئید یا ReLU) که به خروجی هر نورون اعمال می‌شود.",
      en: "In neural networks, a nonlinear function (such as sigmoid or ReLU) applied to a neuron's output.",
    },
    relatedField: "/fields/ai",
  },
  {
    tokens: ["\\eta"],
    name: { fa: "نرخ یادگیری", en: "Learning rate" },
    description: {
      fa: "ابرپارامتری که اندازه گام به‌روزرسانی وزن‌ها را در گرادیان کاهشی کنترل می‌کند.",
      en: "A hyperparameter controlling the step size of weight updates during gradient descent.",
    },
    relatedField: "/fields/ai",
  },
  {
    tokens: ["L"],
    name: { fa: "تابع هزینه", en: "Loss function" },
    description: {
      fa: "معیاری عددی از خطای مدل که آموزش سعی در کمینه‌کردن آن دارد.",
      en: "A numerical measure of model error that training seeks to minimize.",
    },
    relatedField: "/fields/ai",
  },
  {
    tokens: ["w_i", "w_{i}"],
    name: { fa: "وزن سیناپسی", en: "Synaptic weight" },
    description: {
      fa: "پارامتر قابل‌آموزش که قدرت اتصال میان دو نورون را در شبکه عصبی تعیین می‌کند.",
      en: "A trainable parameter determining the strength of the connection between two neurons in a network.",
    },
    relatedField: "/fields/ai",
  },
  {
    tokens: ["\\pi"],
    name: { fa: "پی", en: "Pi" },
    unit: { fa: "بی‌بعد", en: "dimensionless" },
    description: {
      fa: "نسبت محیط دایره به قطر آن، ثابتی ریاضی با مقدار تقریبی ۳.۱۴۱۵۹.",
      en: "The ratio of a circle's circumference to its diameter — a mathematical constant approximately equal to 3.14159.",
    },
    relatedField: "/fields/math",
  },
  {
    tokens: ["\\Lambda"],
    name: { fa: "ثابت کیهان‌شناختی", en: "Cosmological constant" },
    description: {
      fa: "جمله‌ای در معادلات میدان انیشتین که انرژی تاریک و شتاب انبساط جهان را توصیف می‌کند.",
      en: "A term in Einstein's field equations describing dark energy and the accelerating expansion of the universe.",
    },
    relatedField: "/fields/astronomy",
  },
  {
    tokens: ["T_{\\mu\\nu}", "T_{\\mu \\nu}"],
    name: { fa: "تانسور تکانه-انرژی", en: "Stress–energy tensor" },
    description: {
      fa: "کمیتی تانسوری که توزیع جرم، انرژی و تکانه را در فضازمان توصیف می‌کند و منبع خمیدگی گرانشی است.",
      en: "A tensor quantity describing the distribution of mass, energy, and momentum in spacetime — the source of gravitational curvature.",
    },
    relatedField: "/fields/physics",
  },
  {
    tokens: ["G_{\\mu\\nu}", "G_{\\mu \\nu}"],
    name: { fa: "تانسور انیشتین", en: "Einstein tensor" },
    description: {
      fa: "کمیتی تانسوری که خمیدگی فضازمان را توصیف می‌کند؛ در معادله میدان انیشتین با تانسور تکانه-انرژی برابر می‌شود.",
      en: "A tensor describing the curvature of spacetime, set equal to the stress–energy tensor in Einstein's field equation.",
    },
    relatedField: "/fields/physics",
  },
];

/**
 * Finds a glossary entry for a raw LaTeX token, if one exists. Tokens are
 * matched exactly (after whitespace normalization) against each entry's
 * `tokens` list — deliberately conservative to avoid false positives.
 */
export function lookupSymbol(token: string): SymbolDefinition | null {
  const normalized = token.trim().replace(/\s+/g, " ");
  return SYMBOL_GLOSSARY.find((entry) => entry.tokens.includes(normalized)) ?? null;
}
