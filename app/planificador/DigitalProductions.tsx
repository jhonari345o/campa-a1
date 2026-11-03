"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { digitalProductionGroups } from "@/lib/digital-productions";
import type { CatalogProduct } from "@/lib/catalog-shopping";
import { catalogMoney, catalogTax, CatalogInlineProduct } from "./CatalogShopping";
import styles from "./DigitalProductions.module.css";

export function DigitalProductions({ products }: { products: CatalogProduct[] }) {
  const groups = useMemo(() => digitalProductionGroups(products), [products]);
  const [network, setNetwork] = useState("Todos"), [query, setQuery] = useState("");
  const networks = ["Todos", ...new Set(groups.map(group => group.network))];
  const shown = groups.filter(group => (network === "Todos" || group.network === network)
    && `${group.name} ${group.network} ${group.description}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  return <section className={styles.section} aria-label="Medios digitales">
    <header className={styles.heading}><div><p>Medios digitales</p><h2>Programas con voz propia</h2><span>Elige producciones, contenidos y paquetes para tu marca.</span></div><strong>{groups.length} programas</strong></header>
    <div className={styles.filters}><div role="group" aria-label="Canales digitales">{networks.map(value => <button type="button" key={value} aria-pressed={network === value} onClick={() => setNetwork(value)}>{value}</button>)}</div><label>Buscar programa<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Programa o canal"/></label></div>
    <div className={styles.grid}>{shown.map(group => <Production key={group.id} group={group}/>)}</div>
    {!shown.length && <p className={styles.empty}>No hay programas que coincidan con tu búsqueda.</p>}
  </section>;
}

function Production({ group }: { group: ReturnType<typeof digitalProductionGroups>[number] }) {
  const [selected, setSelected] = useState(group.packages[0].key);
  const product = group.packages.find(product => product.key === selected) ?? group.packages[0];
  return <article className={styles.card}>
    <div className={styles.cover}>{group.image && <Image src={group.image} alt={`Portada de ${group.name}`} fill sizes="(max-width: 700px) 100vw, 480px" unoptimized/>}</div>
    <div className={styles.body}><p className={styles.network}>{group.network}</p><h3>{group.name}</h3><p className={styles.description}>{group.description}</p>
      {group.packages.length > 1 && <div className={styles.packages} role="group" aria-label={`Paquetes de ${group.name}`}>{group.packages.map(option => <button type="button" key={option.key} aria-pressed={option.key === product.key} onClick={() => setSelected(option.key)}>{option.name}</button>)}</div>}
      <div className={styles.offer}><div><strong>{catalogMoney(product.priceCents)}</strong><span>{product.unit}</span></div>{product.taxIncluded != null && <small>{catalogTax(product.taxIncluded)}</small>}</div>
      <p className={styles.packageName}>{product.name}{product.digitalProduction?.programsPerPeriod ? ` · ${product.digitalProduction.programsPerPeriod} programas` : ""}</p>
      <ul className={styles.rights}>{product.digitalProduction?.rights.map((right, index) => <li key={index}>{right}</li>)}</ul>
      {product.conditions && <p className={styles.conditions}>{product.conditions}</p>}
      <div className={styles.purchase}><CatalogInlineProduct productKey={product.key} label={product.unit === "mes" ? "Meses" : "Cantidad"}/></div>
    </div>
  </article>;
}
