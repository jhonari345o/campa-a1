import Image from "next/image";
import styles from "./OohPlanPhoto.module.css";

export function OohPlanPhoto({ photo, title }: {
  photo: { assetId: string; kind: "asset" | "format" }; title: string;
}) {
  if (!/^[a-z0-9-]{1,150}$/.test(photo.assetId)) return null;
  const url = `/api/ooh/images/${encodeURIComponent(photo.assetId)}`;
  return <figure className={styles.photo}>
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar fotografía de ${title}`}>
      <Image src={url} alt={photo.kind === "format" ? `Vista del circuito o formato: ${title}` : title} width={1400} height={900} unoptimized/>
      <span>Ampliar fotografía ↗</span>
    </a>
    {photo.kind === "format" && <figcaption>Vista del circuito o formato</figcaption>}
  </figure>;
}
