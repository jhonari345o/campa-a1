export type MediaGroup = "television" | "radio" | "ooh" | "press" | "digital" | "influencers";

function comparable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function mediaGroupForLabel(label: string): MediaGroup | null {
  const value = comparable(label);
  const digitalTerms = [
    "meta",
    "google",
    "whatsapp",
    "tiktok",
    "linkedin",
    "spotify",
    "pinterest",
    "programmatic",
    "buscador",
    "redes sociales",
    "streaming",
    "sitios y apps",
  ];
  if (digitalTerms.some((key) => value.includes(key))) return "digital";
  if (value.includes("tv") || value.includes("television")) return "television";
  if (value.includes("radio")) return "radio";
  if (value.includes("prensa") || value.includes("revista") || value.includes("periodico")) return "press";
  if (value.includes("via publica") || value.includes("exterior") || value.includes("ooh")) return "ooh";
  if (value.includes("influencer")) return "influencers";
  return null;
}
