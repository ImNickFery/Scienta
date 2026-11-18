# Scienta — Premium Scientific Publication Platform

A dark, cinematic, bilingual (Persian RTL / English LTR) scientific publishing
platform built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/fa` or `/en` based on
your browser's `Accept-Language` header.

```bash
npm run build && npm run start   # production build
```

## What's implemented

- **i18n**: `/fa` (RTL) and `/en` (LTR) via an App Router `[locale]` segment,
  middleware-based locale detection, full dictionaries in
  `src/lib/i18n/dictionaries`. Language switcher preserves the current path.
- **Design system**: color tokens, gradients, glass panels, glow/elevation
  utilities in `src/app/globals.css` under `@theme` (Tailwind v4 CSS-first
  config) — matches the purple/orange/red aurora palette on `#05050A` /
  `#0D0D15` backgrounds.
- **Content**: MDX articles in `src/content/articles/{locale}/*.mdx` with
  frontmatter (gray-matter), reading-time calculation, KaTeX math
  (`remark-math` + `rehype-katex`), Mermaid diagrams (custom preprocessing
  step + client-side `mermaid` render), GFM tables, syntax-highlighted code
  blocks (`rehype-pretty-code` + Shiki) with copy buttons, and styled
  callouts.
- **Pages**: Home, Articles (listing), Article detail, Categories (tag
  cloud) + detail, Fields (scientific taxonomy) + detail, Search (client-side
  instant filter), About, Contact, Authors + detail, Privacy, Terms — all in
  both locales, all statically generated (74 pages at build time).
- **Article page**: hero, sticky reading-progress bar, sticky table of
  contents with scroll-spy highlighting, font-size / reading-width / focus
  mode controls, author box, share buttons (X, LinkedIn, copy link),
  citation copy, print stylesheet (usable as a "PDF export" via the browser
  print dialog), prev/next navigation, related articles.
- **SEO**: per-page metadata, Open Graph/Twitter cards, canonical +
  hreflang alternates, JSON-LD (Article/ScholarlyArticle, Organization,
  Breadcrumb), `sitemap.ts`, `robots.ts`.
- **Motion**: canvas starfield with mouse parallax, CSS aurora blobs,
  floating equation decorations, card hover/lift, respects
  `prefers-reduced-motion` throughout.

## What's stubbed / needs your input before shipping

- **Fonts**: this sandbox can't reach Google Fonts, so `globals.css` falls
  back to system fonts. Swap in real fonts by adding, in
  `src/app/[locale]/layout.tsx`:
  ```ts
  import { Vazirmatn } from "next/font/google";
  import { Inter } from "next/font/google";
  const vazirmatn = Vazirmatn({ subsets: ["arabic"], variable: "--font-body" });
  const inter = Inter({ subsets: ["latin"], variable: "--font-latin-body" });
  ```
  and apply the variable classNames to `<body>`.
- **Images**: article covers and author avatars are gradient placeholders.
  Drop real files into `/public/covers` and `/public/authors` and update the
  `cover`/`avatar` fields in content files — then swap the placeholder divs
  in `ArticleCard`/`AuthorBox` for `next/image`.
- **Content**: only 3 real sample articles per locale exist (black holes,
  neural networks, quantum computing) to prove out the whole pipeline. Add
  more `.mdx` files to `src/content/articles/{locale}/` — every page reads
  from disk, so new articles show up automatically everywhere (home,
  listing, field, category, sitemap).
- **Search**: current implementation is a simple in-browser substring
  filter over all articles (fine at this content scale). For real fuzzy
  search at scale, swap `SearchClient` for something like Fuse.js or an
  external index (Algolia/Meilisearch).
- **Newsletter/contact forms**: UI only, not wired to a backend — connect
  to your provider of choice (Resend, ConvertKit, a serverless function,
  etc).
- **OG images**: `/api/og` route folder exists but is empty — wire up
  `@vercel/og` (already installed) for dynamic per-article social cards.

## Project structure

```
src/
  app/
    [locale]/            # all locale-aware routes (layout owns <html dir=...>)
    sitemap.ts, robots.ts
  components/
    ui/                  # Button, Badge, Container, SectionHeading
    layout/               # Navbar, Footer, LanguageSwitcher
    home/                 # Hero, FieldGrid, ArticleSection
    article/              # ArticleCard, TOC, ReadingProgress, ShareBar, ...
    mdx/                  # MDX component overrides, Mermaid, CodeBlock, Callout
    animations/           # Starfield, AuroraBackground, FloatingFormulas
  content/
    articles/{fa,en}/*.mdx
    authors.ts, fields.ts
  lib/
    content.ts            # filesystem MDX loader/query layer
    render-mdx.tsx         # MDX to React compile pipeline
    seo.ts                 # metadata + JSON-LD builders
    i18n/                  # locale config + dictionaries
  types/
```
