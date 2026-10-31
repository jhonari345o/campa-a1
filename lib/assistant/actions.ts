export type AssistantAction = {
  kind: "prepare_campaign";
  network: "instagram" | "facebook";
  budget: number | null;
  objective: "Alcance" | "Tráfico" | "Mensajes" | "Ventas";
  postUrl: string | null;
};

export function detectAssistantAction(message: string): AssistantAction | null {
  const normalized = normalize(message);
  if (!/paut|promocion|anunci|campana/.test(normalized)) return null;
  const url = message.match(/https?:\/\/[^\s<>]+/i)?.[0]?.replace(/[),.;]+$/, "") ?? null;
  const network = /facebook|fb\.com|facebook\.com/.test(normalized) ? "facebook" : "instagram";
  if (!/instagram|facebook|reel|post|publicacion|video|foto|historia/.test(normalized) && !url) return null;
  const amountMatches = [...message.matchAll(/(?:\$|usd\s*)?([0-9]+(?:[.,][0-9]{1,2})?)/gi)];
  const budget = amountMatches
    .map((match) => Number(match[1].replace(",", ".")))
    .find((value) => Number.isFinite(value) && value > 0 && value <= 1_000_000) ?? null;
  const objective = /venta|compra|conversion/.test(normalized)
    ? "Ventas"
    : /mensaje|whatsapp|conversacion/.test(normalized)
      ? "Mensajes"
      : /trafico|visita|clic/.test(normalized)
        ? "Tráfico"
        : "Alcance";
  return { kind: "prepare_campaign", network, budget, objective, postUrl: url };
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
