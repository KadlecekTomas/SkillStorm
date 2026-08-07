import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkillStorm — školní pokrok",
    short_name: "SkillStorm",
    description:
      "Jednoduchý školní prostor pro hodnocení, pokrok žáků a rodičovský přehled.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#047857",
    lang: "cs",
    categories: ["education", "productivity"],
  };
}
