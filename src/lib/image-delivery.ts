/**
 * Resolves responsive `src` / `srcSet` / `sizes` attributes for article cards.
 *
 * Bundled stock covers under `/images/articles/<slug>.webp` (1376x768, ~140-189 KB)
 * have matching pre-generated 480x268 thumbnails (`~15-27 KB`) under
 * `/images/articles/thumbs/<slug>_thumb.webp`. Serving those thumbnails on mobile
 * and compact/default cards cuts card image transfer by ~80% without losing
 * sharpness. User-uploaded covers (`/uploads/...`) and remote URLs pass through
 * unchanged.
 */

const BUNDLED_ARTICLE_COVER_RE = /^\/images\/articles\/([a-z0-9-]+)\.webp$/i;

const KNOWN_THUMB_SLUGS = new Set([
  "black-hole-horizon",
  "black-hole-spacetime",
  "crispr-dna-helix",
  "jwst-deep-galaxies",
  "mrna-lipid-nanoparticle",
  "neural-network-synapse",
  "particle-collider-tracks",
  "quantum-cryostat-chip",
  "quantum-entanglement-waves",
  "riemann-complex-surface",
]);

export type ArticleCardSize = "default" | "large" | "compact";

export interface ResponsiveCardImage {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
}

export function resolveArticleCardImage(
  coverSrc: string,
  size: ArticleCardSize = "default"
): ResponsiveCardImage {
  const match = BUNDLED_ARTICLE_COVER_RE.exec(coverSrc);
  const slug = match?.[1]?.toLowerCase();

  if (slug && KNOWN_THUMB_SLUGS.has(slug)) {
    const thumbSrc = `/images/articles/thumbs/${slug}_thumb.webp`;
    if (size === "compact") {
      return {
        src: thumbSrc,
        width: 480,
        height: 268,
      };
    }

    if (size === "large") {
      return {
        src: coverSrc,
        srcSet: `${thumbSrc} 480w, ${coverSrc} 1376w`,
        sizes: "(max-width: 640px) 440px, (max-width: 1024px) 640px, 760px",
        width: 1376,
        height: 768,
      };
    }

    return {
      src: thumbSrc,
      srcSet: `${thumbSrc} 480w, ${coverSrc} 1376w`,
      sizes: "(max-width: 640px) 440px, (max-width: 1024px) 45vw, 400px",
      width: 480,
      height: 268,
    };
  }

  return {
    src: coverSrc,
    width: size === "compact" ? 160 : 1200,
    height: size === "compact" ? 160 : 675,
  };
}
