export type TvOfferKind = "programa" | "paquete" | "formato";

export type TvOffer = {
  id: string;
  kind: TvOfferKind;
  day: string;
  title: string;
  schedule: string;
  priceUsd: number | null;
  unit: string;
  market?: string;
  note?: string;
};

export type TvRateCatalog = {
  channelSlug: string;
  lastVerified: string;
  priceBasis: string;
  sourceNote: string;
  offers: TvOffer[];
};

