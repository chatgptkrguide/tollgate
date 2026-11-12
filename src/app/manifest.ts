import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tollgate",
    short_name: "Tollgate",
    description: "Catch scope creep in client messages and bill it with PayPal before you do the extra work.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#12161f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
