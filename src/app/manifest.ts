import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION_FA, SITE_NAME, SITE_NAME_FA } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME_FA} (${SITE_NAME})`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION_FA,
    start_url: "/fa",
    display: "standalone",
    background_color: "#05050A",
    theme_color: "#05050A",
    lang: "fa",
    dir: "rtl",
    categories: ["education", "news", "science"],
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
