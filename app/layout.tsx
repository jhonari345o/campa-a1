import type { Metadata } from "next";
import localFont from "next/font/local";
import "leaflet/dist/leaflet.css";
import "@/components/geography/coverage.css";
import "./globals.css";
import "./workspace-theme.css";
import "./campaign-library.css";
import "./account-settings.css";
import "./media-strategy.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://admavericks.one";

const nunito = localFont({
  src: [
    { path: "./fonts/nunito-sans-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/nunito-sans-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/nunito-sans-latin.woff2", weight: "800", style: "normal" },
    { path: "./fonts/nunito-sans-latin.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-nunito",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/brand/ad-mavericks-mark.png",
    shortcut: "/brand/ad-mavericks-mark.png",
    apple: "/brand/ad-mavericks-mark.png",
  },
  title: {
    default: "Ad Mavericks One — Tu central de medios del nuevo siglo",
    template: "%s · Ad Mavericks One",
  },
  description:
    "Ad Mavericks convierte una operacion compleja de medios en una experiencia clara, segura y facil de comprender. Planificacion, compra y control de pauta publicitaria en Ecuador.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "Ad Mavericks One — Tu central de medios del nuevo siglo",
    description:
      "Planificacion, catalogo y gestion de medios para Ecuador.",
    type: "website",
    locale: "es_EC",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Ad Mavericks One — Tu central de medios del nuevo siglo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ad Mavericks One — Tu central de medios del nuevo siglo",
    description: "Planificacion, catalogo y gestion de medios para Ecuador.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={nunito.variable}>
      <body className="font-sans antialiased text-forest-ink">{children}</body>
    </html>
  );
}
