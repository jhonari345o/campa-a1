import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://admavericks.one";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
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
