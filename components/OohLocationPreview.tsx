"use client";

import { useState } from "react";
import type { OohGeoRecommendation } from "@/lib/detailed-plan";
import styles from "./OohLocationPreview.module.css";

export function OohLocationPreview({ title, geo }: { title: string; geo: OohGeoRecommendation }) {
  const [mapOpen, setMapOpen] = useState(false);
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  const latitude = geo.latitude.toFixed(6);
  const longitude = geo.longitude.toFixed(6);
  const embedUrl = embedKey
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(embedKey)}&q=${encodeURIComponent(`${latitude},${longitude}`)}&zoom=17&maptype=satellite`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${geo.longitude - 0.006}%2C${geo.latitude - 0.004}%2C${geo.longitude + 0.006}%2C${geo.latitude + 0.004}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return <section className={styles.location} aria-label={`Ubicación: ${title}`}>
    <div className={styles.heading}>
      <div><strong>{geo.locationStatus === "inventory" ? "Ubicación del elemento" : "Zona propuesta"}</strong><p>{title}</p></div>
      <div className={styles.links}>
        <a href={geo.mapUrl} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
        <a href={geo.streetViewUrl} target="_blank" rel="noopener noreferrer">Vista de calle ↗</a>
      </div>
    </div>
    <details className={styles.map} onToggle={event => setMapOpen(event.currentTarget.open)}>
      <summary>{mapOpen ? "Ocultar mapa" : "Ver mapa de ubicación"}</summary>
      {mapOpen && <iframe src={embedUrl} title={`Mapa de ${title}`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />}
    </details>
  </section>;
}
