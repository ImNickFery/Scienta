export interface SeedField {
  slug: string;
  name_fa: string;
  name_en: string;
  color: string;
  icon: string;
}

export interface SeedAuthor {
  slug: string;
  name_fa: string;
  name_en: string;
  title_fa: string;
  title_en: string;
  bio_fa: string;
  bio_en: string;
}

export interface SeedTag {
  slug: string;
  name_fa: string;
  name_en: string;
}

export interface SeedArticle {
  slug: string;
  field: string;
  authorSlug: string;
  tags: SeedTag[];
  featured: boolean;
  trending: boolean;
  views: number;
  publishedAt: string;
  fa: { title: string; excerpt: string; content: string };
  en: { title: string; excerpt: string; content: string };
}

export const SEED_FIELDS: SeedField[] = [
  { slug: "physics", name_fa: "فیزیک", name_en: "Physics", color: "#7B3FFB", icon: "atom" },
  { slug: "astronomy", name_fa: "نجوم و فضا", name_en: "Astronomy & Space", color: "#FF7A00", icon: "orbit" },
  { slug: "ai", name_fa: "هوش مصنوعی", name_en: "Artificial Intelligence", color: "#FF3C5A", icon: "cpu" },
  { slug: "space", name_fa: "کاوش فضایی", name_en: "Space Exploration", color: "#7B3FFB", icon: "rocket" },
  { slug: "quantum", name_fa: "محاسبات کوانتومی", name_en: "Quantum Computing", color: "#FF7A00", icon: "waves" },
  { slug: "math", name_fa: "ریاضیات", name_en: "Mathematics", color: "#FF3C5A", icon: "sigma" },
  { slug: "biology", name_fa: "زیست‌شناسی", name_en: "Biology", color: "#7B3FFB", icon: "dna" },
  { slug: "medicine", name_fa: "پزشکی", name_en: "Medicine", color: "#FF7A00", icon: "heart-pulse" },
  { slug: "engineering", name_fa: "مهندسی", name_en: "Engineering", color: "#FF3C5A", icon: "cog" },
  { slug: "technology", name_fa: "فناوری", name_en: "Technology", color: "#7B3FFB", icon: "microchip" },
];

export const SEED_AUTHORS: SeedAuthor[] = [
  {
    slug: "sara-ahmadi",
    name_fa: "سارا احمدی",
    name_en: "Sara Ahmadi",
    title_fa: "پژوهشگر فیزیک نظری",
    title_en: "Theoretical Physics Researcher",
    bio_fa: "سارا احمدی پژوهشگر فیزیک نظری با تمرکز بر گرانش کوانتومی و کیهان‌شناسی است.",
    bio_en: "Sara Ahmadi is a theoretical physics researcher focused on quantum gravity and cosmology.",
  },
  {
    slug: "kian-moradi",
    name_fa: "کیان مرادی",
    name_en: "Kian Moradi",
    title_fa: "نویسنده علمی حوزه هوش مصنوعی",
    title_en: "AI Science Writer",
    bio_fa: "کیان مرادی درباره یادگیری ماشین، شبکه‌های عصبی و آینده هوش مصنوعی می‌نویسد.",
    bio_en: "Kian Moradi writes about machine learning, neural networks, and the future of AI.",
  },
  {
    slug: "elham-rostami",
    name_fa: "الهام رستمی",
    name_en: "Elham Rostami",
    title_fa: "اخترفیزیک‌دان",
    title_en: "Astrophysicist",
    bio_fa: "الهام رستمی اخترفیزیک‌دانی است که روی سیاه‌چاله‌ها و امواج گرانشی کار می‌کند.",
    bio_en: "Elham Rostami is an astrophysicist working on black holes and gravitational waves.",
  },
];

export const SEED_ARTICLES: SeedArticle[] = [
  {
    slug: "geometry-of-black-holes",
    field: "astronomy",
    authorSlug: "elham-rostami",
    tags: [
      { slug: "general-relativity", name_fa: "نسبیت عام", name_en: "General Relativity" },
      { slug: "black-holes", name_fa: "سیاه‌چاله", name_en: "Black Holes" },
      { slug: "cosmology", name_fa: "کیهان‌شناسی", name_en: "Cosmology" },
    ],
    featured: true,
    trending: true,
    views: 18420,
    publishedAt: "2026-05-12 00:00:00",
    fa: {
      title: "هندسه سیاه‌چاله‌ها: از شوارتزشیلد تا کر",
      excerpt: "چگونه انحنای فضازمان یک ستاره در حال فروپاشی را به دروازه‌ای یک‌طرفه تبدیل می‌کند؟ نگاهی به ریاضیات پشت افق رویداد.",
      content: `هیچ شیئی در طبیعت به اندازه سیاه‌چاله ذهن انسان را درگیر نکرده است. جایی که قوانین آشنای فیزیک از هم می‌پاشند و فضازمان خود را به دور خودش می‌پیچد.

<StatHighlight stats={[
  { value: "۱.۳ میلیارد", label: "سال نوری فاصله M87*" },
  { value: "۶.۵ میلیارد", label: "برابر جرم خورشید" },
  { value: "۲۰۱۹", label: "سال نخستین تصویر" }
]} />

## معادله میدان انیشتین

نقطه شروع هر بحث درباره سیاه‌چاله‌ها، معادله میدان انیشتین است:

$$
G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}
$$

این معادله می‌گوید که انحنای فضازمان ($G_{\\mu\\nu}$) توسط توزیع جرم و انرژی ($T_{\\mu\\nu}$) تعیین می‌شود. برای یک جرم کروی متقارن و ساکن، جواب شوارتزشیلد به دست می‌آید.

<Figure illustration="nebula" palette="purple" alt="شبیه‌سازی هنری یک سیاه‌چاله" caption="بازنمایی هنری از خمش فضازمان در اطراف یک سیاه‌چاله ابرپرجرم." wide aspect="wide" />

## شعاع شوارتزشیلد

شعاع افق رویداد برای جرمی مانند خورشید از رابطه زیر به دست می‌آید:

$$
r_s = \\frac{2GM}{c^2}
$$

اگر تمام جرم خورشید در کره‌ای به شعاع تقریباً ۳ کیلومتر فشرده شود، سرعت گریز از سطح آن برابر سرعت نور خواهد شد.

<PullQuote attribution="کارل شوارتزشیلد، ۱۹۱۶">
افق رویداد مرزی است که از آن پس هیچ سیگنالی، حتی نور، نمی‌تواند بازگردد.
</PullQuote>

### مقایسه انواع سیاه‌چاله

<ComparisonCards columns={[
  { title: "ستاره‌ای", rows: ["۵ تا ۵۰ برابر جرم خورشید", "چند کیلومتر شعاع افق", "حاصل فروپاشی یک ستاره"] },
  { title: "میانی", rows: ["صدها تا هزاران برابر خورشید", "ده‌ها کیلومتر شعاع افق", "کمتر مشاهده‌شده"] },
  { title: "ابرپرجرم", highlight: true, rows: ["میلیون‌ها تا میلیاردها برابر خورشید", "میلیون‌ها کیلومتر شعاع افق", "مرکز اکثر کهکشان‌ها"] }
]} />

## فرآیند فروپاشی

مراحل تشکیل یک سیاه‌چاله ستاره‌ای را می‌توان به این صورت نمایش داد:

\`\`\`mermaid
graph TD
    A[ستاره پرجرم] --> B[پایان سوخت هسته‌ای]
    B --> C[فروپاشی گرانشی]
    C --> D{جرم باقیمانده}
    D -->|کمتر از حد چاندراسکار| E[کوتوله سفید]
    D -->|بین ۱.۴ تا ۳ خورشید| F[ستاره نوترونی]
    D -->|بیشتر از حد تولمن-اوپنهایمر| G[سیاه‌چاله]
\`\`\`

<SideBySide
  left={{ illustration: "orbit", palette: "purple", alt: "مدل‌سازی مداری", caption: "مدارهای پایدار در اطراف افق رویداد" }}
  right={{ illustration: "field-lines", palette: "orange", alt: "خطوط میدان گرانشی", caption: "خمیدگی خطوط میدان در نزدیکی جرم پرچگالی" }}
/>

## سیاه‌چاله‌های چرخان: جواب کر

سیاه‌چاله‌های واقعی معمولاً می‌چرخند. جواب کر (Kerr) این حالت را توصیف می‌کند و پدیده‌ای به نام کشش قاب‌مرجع (frame dragging) را پیش‌بینی می‌کند؛ جایی که فضازمان خود در اطراف جسم چرخان کشیده می‌شود.

> «افق رویداد یک مرز اطلاعاتی است، نه یک دیوار فیزیکی؛ سقوط از آن نقطه بازگشتی ندارد.»

## گاه‌شمار کشف

<Timeline events={[
  { year: "۱۹۱۶", title: "جواب شوارتزشیلد", description: "نخستین جواب دقیق معادلات انیشتین برای جرمی کروی متقارن." },
  { year: "۱۹۶۳", title: "جواب کر", description: "تعمیم جواب برای اجسام چرخان." },
  { year: "۱۹۷۴", title: "تابش هاوکینگ", description: "پیش‌بینی نظری تبخیر کوانتومی سیاه‌چاله‌ها." },
  { year: "۲۰۱۵", title: "کشف امواج گرانشی", description: "رصدخانه LIGO ادغام دو سیاه‌چاله را مستقیماً رصد کرد." },
  { year: "۲۰۱۹", title: "نخستین تصویر", description: "تلسکوپ افق رویداد سایه سیاه‌چاله M87* را تصویر کرد." }
]} />

<VideoEmbed src="https://www.youtube-nocookie.com/embed/e-P5IFTqB98" title="شبیه‌سازی سیاه‌چاله — NASA Goddard" caption="شبیه‌سازی ناسا از خمش نور در اطراف یک سیاه‌چاله." />

## چرا اهمیت دارد؟

<Callout type="tip" title="نکته پژوهشی">
مشاهده مستقیم سایه سیاه‌چاله توسط تلسکوپ افق رویداد در سال ۲۰۱۹ نخستین تأیید تصویری از پیش‌بینی‌های نسبیت عام در این مقیاس بود.
</Callout>

<ImageGallery images={[
  { illustration: "nebula", palette: "purple", alt: "گالری ۱", caption: "دیسک برافزایشی" },
  { illustration: "orbit", palette: "orange", alt: "گالری ۲", caption: "مدارهای پایدار" },
  { illustration: "field-lines", palette: "red", alt: "گالری ۳", caption: "خطوط میدان" }
]} />

## منابع

1. Misner, Thorne & Wheeler, *Gravitation*, W. H. Freeman, 1973.
2. Event Horizon Telescope Collaboration, *Astrophysical Journal Letters*, 2019.
3. Kerr, R. P., *Physical Review Letters*, 1963.`,
    },
    en: {
      title: "The Geometry of Black Holes: From Schwarzschild to Kerr",
      excerpt: "How does the curvature of spacetime around a collapsing star become a one-way door? A look at the mathematics behind the event horizon.",
      content: `Few objects in nature have captured the human imagination like black holes — places where familiar physical laws break down and spacetime folds in on itself.

<StatHighlight stats={[
  { value: "53.5M", label: "Light-years to M87*" },
  { value: "6.5B", label: "Solar masses" },
  { value: "2019", label: "First image captured" }
]} />

## Einstein's Field Equation

Every discussion of black holes begins with Einstein's field equation:

$$
G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}
$$

This equation states that the curvature of spacetime ($G_{\\mu\\nu}$) is determined by the distribution of mass and energy ($T_{\\mu\\nu}$). For a static, spherically symmetric mass, this yields the Schwarzschild solution.

<Figure illustration="nebula" palette="purple" alt="Artist's rendering of a black hole" caption="An artistic rendering of spacetime curvature around a supermassive black hole." wide aspect="wide" />

## The Schwarzschild Radius

The event horizon radius for a mass like the Sun is given by:

$$
r_s = \\frac{2GM}{c^2}
$$

If the Sun's entire mass were compressed into a sphere roughly 3 kilometers in radius, its escape velocity would equal the speed of light.

<PullQuote attribution="Karl Schwarzschild, 1916">
The event horizon is the boundary beyond which no signal — not even light — can ever return.
</PullQuote>

### Comparing Black Hole Types

<ComparisonCards columns={[
  { title: "Stellar", rows: ["5–50 solar masses", "A few km horizon radius", "Formed from a collapsing star"] },
  { title: "Intermediate", rows: ["Hundreds–thousands of solar masses", "Tens of km horizon radius", "Rarely observed directly"] },
  { title: "Supermassive", highlight: true, rows: ["Millions–billions of solar masses", "Millions of km horizon radius", "Found at the center of most galaxies"] }
]} />

## The Collapse Process

The stages of stellar black hole formation can be shown as:

\`\`\`mermaid
graph TD
    A[Massive Star] --> B[Nuclear Fuel Exhausted]
    B --> C[Gravitational Collapse]
    C --> D{Remnant Mass}
    D -->|Below Chandrasekhar limit| E[White Dwarf]
    D -->|1.4–3 solar masses| F[Neutron Star]
    D -->|Above Tolman-Oppenheimer limit| G[Black Hole]
\`\`\`

<SideBySide
  left={{ illustration: "orbit", palette: "purple", alt: "Orbital modeling", caption: "Stable orbits near the event horizon" }}
  right={{ illustration: "field-lines", palette: "orange", alt: "Gravitational field lines", caption: "Field line curvature near a dense mass" }}
/>

## Rotating Black Holes: The Kerr Solution

Real black holes typically rotate. The Kerr solution describes this case and predicts frame dragging — a phenomenon where spacetime itself is dragged around the rotating body.

> "The event horizon is an information boundary, not a physical wall — falling past it offers no way back."

## Discovery Timeline

<Timeline events={[
  { year: "1916", title: "Schwarzschild Solution", description: "The first exact solution to Einstein's equations for a spherically symmetric mass." },
  { year: "1963", title: "Kerr Solution", description: "Generalized the solution to rotating bodies." },
  { year: "1974", title: "Hawking Radiation", description: "Theoretical prediction of quantum black hole evaporation." },
  { year: "2015", title: "Gravitational Waves Detected", description: "LIGO directly observed two black holes merging." },
  { year: "2019", title: "First Image", description: "The Event Horizon Telescope imaged the shadow of M87*." }
]} />

<VideoEmbed src="https://www.youtube-nocookie.com/embed/e-P5IFTqB98" title="Black Hole Simulation — NASA Goddard" caption="NASA's simulation of light bending around a black hole." />

## Why It Matters

<Callout type="tip" title="Research Note">
The Event Horizon Telescope's 2019 direct image of a black hole's shadow was the first visual confirmation of general relativity's predictions at this scale.
</Callout>

<ImageGallery images={[
  { illustration: "nebula", palette: "purple", alt: "Gallery 1", caption: "Accretion disk" },
  { illustration: "orbit", palette: "orange", alt: "Gallery 2", caption: "Stable orbits" },
  { illustration: "field-lines", palette: "red", alt: "Gallery 3", caption: "Field lines" }
]} />

## References

1. Misner, Thorne & Wheeler, *Gravitation*, W. H. Freeman, 1973.
2. Event Horizon Telescope Collaboration, *Astrophysical Journal Letters*, 2019.
3. Kerr, R. P., *Physical Review Letters*, 1963.`,
    },
  },
  {
    slug: "neural-networks-explained",
    field: "ai",
    authorSlug: "kian-moradi",
    tags: [
      { slug: "deep-learning", name_fa: "یادگیری عمیق", name_en: "Deep Learning" },
      { slug: "neural-networks", name_fa: "شبکه عصبی", name_en: "Neural Networks" },
      { slug: "backpropagation", name_fa: "پس‌انتشار خطا", name_en: "Backpropagation" },
    ],
    featured: true,
    trending: false,
    views: 24310,
    publishedAt: "2026-06-20 00:00:00",
    fa: {
      title: "شبکه‌های عصبی چگونه یاد می‌گیرند؟",
      excerpt: "سفری به درون ریاضیات پس‌انتشار خطا و چگونگی یادگیری میلیون‌ها پارامتر از داده.",
      content: `هر بار که یک مدل زبانی متنی تولید می‌کند یا یک شبکه بینایی ماشین تصویری را طبقه‌بندی می‌کند، میلیون‌ها ضرب و جمع ساده در حال انجام است. راز یادگیری این سیستم‌ها در یک الگوریتم نسبتاً ساده به نام پس‌انتشار خطا نهفته است.

## یک نورون مصنوعی

ساده‌ترین واحد یک شبکه عصبی، خروجی وزن‌دار ورودی‌ها به‌علاوه یک تابع فعال‌سازی است:

$$
y = \\sigma\\left(\\sum_{i=1}^{n} w_i x_i + b\\right)
$$

که در آن $\\sigma$ تابع فعال‌سازی (مانند ReLU یا سیگموئید) است.

## تابع هزینه و گرادیان کاهشی

هدف آموزش، کمینه‌کردن تابع هزینه $L$ نسبت به وزن‌هاست:

$$
w_i \\leftarrow w_i - \\eta \\frac{\\partial L}{\\partial w_i}
$$

$\\eta$ در اینجا نرخ یادگیری است که سرعت به‌روزرسانی پارامترها را کنترل می‌کند.

## جریان اطلاعات در شبکه

\`\`\`mermaid
flowchart LR
    X[ورودی] --> H1[لایه پنهان ۱]
    H1 --> H2[لایه پنهان ۲]
    H2 --> O[خروجی]
    O --> L[تابع هزینه]
    L -.پس‌انتشار خطا.-> H2
    L -.پس‌انتشار خطا.-> H1
\`\`\`

## چرا لایه‌های بیشتر کمک می‌کند؟

هر لایه یک نگاشت غیرخطی از فضای ویژگی می‌سازد. با انباشتن این نگاشت‌ها، شبکه می‌تواند مرزهای تصمیم بسیار پیچیده‌ای یاد بگیرد که با یک لایه ساده امکان‌پذیر نیست.

## چالش‌های عملی

- **بیش‌برازش**: شبکه داده‌های آموزشی را حفظ می‌کند نه الگوی کلی را.
- **گرادیان محوشونده**: در شبکه‌های عمیق، گرادیان‌ها می‌توانند بسیار کوچک شوند.
- **هزینه محاسباتی**: آموزش مدل‌های بزرگ به خوشه‌های GPU نیاز دارد.

## جمع‌بندی

پس‌انتشار خطا، با وجود سادگی ریاضی نسبی‌اش، پایه تقریباً تمام پیشرفت‌های اخیر هوش مصنوعی از تشخیص تصویر تا مدل‌های زبانی بزرگ است.

## منابع

1. Rumelhart, Hinton & Williams, *Nature*, 1986.
2. Goodfellow, Bengio & Courville, *Deep Learning*, MIT Press, 2016.`,
    },
    en: {
      title: "How Do Neural Networks Actually Learn?",
      excerpt: "A journey into the mathematics of backpropagation and how millions of parameters learn from data.",
      content: `Every time a language model generates text or a vision network classifies an image, millions of simple multiplications and additions take place. The secret to how these systems learn lies in a relatively simple algorithm called backpropagation.

## An Artificial Neuron

The simplest unit of a neural network is a weighted sum of inputs passed through an activation function:

$$
y = \\sigma\\left(\\sum_{i=1}^{n} w_i x_i + b\\right)
$$

where $\\sigma$ is the activation function (such as ReLU or sigmoid).

## Loss Function and Gradient Descent

The goal of training is to minimize a loss function $L$ with respect to the weights:

$$
w_i \\leftarrow w_i - \\eta \\frac{\\partial L}{\\partial w_i}
$$

Here $\\eta$ is the learning rate, controlling how fast the parameters update.

## Information Flow Through the Network

\`\`\`mermaid
flowchart LR
    X[Input] --> H1[Hidden Layer 1]
    H1 --> H2[Hidden Layer 2]
    H2 --> O[Output]
    O --> L[Loss Function]
    L -.Backpropagation.-> H2
    L -.Backpropagation.-> H1
\`\`\`

## Why More Layers Help

Each layer builds a nonlinear mapping of the feature space. Stacking these mappings lets the network learn decision boundaries far more complex than a single layer could produce.

## Practical Challenges

- **Overfitting**: the network memorizes training data instead of general patterns.
- **Vanishing gradients**: in deep networks, gradients can shrink to near zero.
- **Computational cost**: training large models requires clusters of GPUs.

## Takeaway

Despite its relative mathematical simplicity, backpropagation underlies nearly every recent advance in AI, from image recognition to large language models.

## References

1. Rumelhart, Hinton & Williams, *Nature*, 1986.
2. Goodfellow, Bengio & Courville, *Deep Learning*, MIT Press, 2016.`,
    },
  },
  {
    slug: "quantum-computing-basics",
    field: "quantum",
    authorSlug: "sara-ahmadi",
    tags: [
      { slug: "quantum-computing", name_fa: "محاسبات کوانتومی", name_en: "Quantum Computing" },
      { slug: "qubits", name_fa: "کیوبیت", name_en: "Qubits" },
      { slug: "entanglement", name_fa: "درهم‌تنیدگی", name_en: "Entanglement" },
    ],
    featured: false,
    trending: false,
    views: 12980,
    publishedAt: "2026-04-08 00:00:00",
    fa: {
      title: "کامپیوترهای کوانتومی: فراتر از صفر و یک",
      excerpt: "کیوبیت‌ها چگونه هم‌زمان چند حالت را نمایش می‌دهند و این موضوع چه معنایی برای محاسبات دارد؟",
      content: `کامپیوترهای کلاسیک با بیت‌هایی کار می‌کنند که یا صفرند یا یک. کامپیوترهای کوانتومی از کیوبیت استفاده می‌کنند که می‌تواند در برهم‌نهی (superposition) هر دو حالت باشد.

## حالت یک کیوبیت

حالت کلی یک کیوبیت را می‌توان چنین نوشت:

$$
|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle, \\quad |\\alpha|^2 + |\\beta|^2 = 1
$$

اندازه‌گیری این کیوبیت با احتمال $|\\alpha|^2$ نتیجه صفر و با احتمال $|\\beta|^2$ نتیجه یک می‌دهد.

## درهم‌تنیدگی کوانتومی

وقتی دو کیوبیت درهم‌تنیده می‌شوند، اندازه‌گیری یکی بلافاصله وضعیت دیگری را تعیین می‌کند، حتی اگر کیلومترها فاصله داشته باشند. این پدیده پایه بسیاری از الگوریتم‌های کوانتومی است.

## مسیر یک الگوریتم کوانتومی

\`\`\`mermaid
graph LR
    A[آماده‌سازی کیوبیت‌ها] --> B[اعمال گیت‌های کوانتومی]
    B --> C[ایجاد برهم‌نهی و درهم‌تنیدگی]
    C --> D[اندازه‌گیری]
    D --> E[نتیجه کلاسیک]
\`\`\`

## چرا سریع‌تر است؟

الگوریتم‌هایی مانند شور (Shor) با بهره‌گیری از تداخل کوانتومی می‌توانند مسائلی مانند تجزیه اعداد بزرگ به عوامل اول را با سرعتی نمایی سریع‌تر از بهترین الگوریتم‌های کلاسیک شناخته‌شده حل کنند.

## محدودیت‌های فعلی

کیوبیت‌ها بسیار شکننده‌اند و نویز محیطی به‌سرعت باعث از دست رفتن اطلاعات کوانتومی (دی‌کوهرنس) می‌شود. تصحیح خطای کوانتومی یکی از مهم‌ترین چالش‌های مهندسی این حوزه است.

## منابع

1. Nielsen & Chuang, *Quantum Computation and Quantum Information*, Cambridge, 2010.
2. Shor, P. W., *SIAM Journal on Computing*, 1997.`,
    },
    en: {
      title: "Quantum Computers: Beyond Zero and One",
      excerpt: "How can qubits represent multiple states at once, and what does that mean for computation?",
      content: `Classical computers work with bits that are either zero or one. Quantum computers use qubits, which can exist in a superposition of both states at once.

## The State of a Single Qubit

The general state of a qubit can be written as:

$$
|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle, \\quad |\\alpha|^2 + |\\beta|^2 = 1
$$

Measuring this qubit yields zero with probability $|\\alpha|^2$ and one with probability $|\\beta|^2$.

## Quantum Entanglement

When two qubits become entangled, measuring one instantly determines the state of the other — even if they are kilometers apart. This phenomenon underlies many quantum algorithms.

## Anatomy of a Quantum Algorithm

\`\`\`mermaid
graph LR
    A[Prepare Qubits] --> B[Apply Quantum Gates]
    B --> C[Create Superposition & Entanglement]
    C --> D[Measurement]
    D --> E[Classical Result]
\`\`\`

## Why Is It Faster?

Algorithms like Shor's algorithm exploit quantum interference to solve problems such as factoring large numbers exponentially faster than the best known classical algorithms.

## Current Limitations

Qubits are extremely fragile, and environmental noise quickly causes loss of quantum information (decoherence). Quantum error correction remains one of the field's most important engineering challenges.

## References

1. Nielsen & Chuang, *Quantum Computation and Quantum Information*, Cambridge, 2010.
2. Shor, P. W., *SIAM Journal on Computing*, 1997.`,
    },
  },
];
