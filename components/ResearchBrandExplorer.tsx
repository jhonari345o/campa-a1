"use client";

import { useId, useRef, useState, useTransition } from "react";
import { consultarMarcas } from "@/app/planificador/research-actions";
import type { ResearchBrandPage, ResearchPeriod } from "@/lib/infomedia";

const money = (value: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => new Intl.NumberFormat("es-EC", { style: "percent", maximumFractionDigits: 1 }).format(value);

export function ResearchBrandExplorer({ categoryId, dataThrough, period }: { categoryId: string; dataThrough: string; period: ResearchPeriod }) {
  const searchId = useId();
  const inFlight = useRef(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResearchBrandPage | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const rows = result?.rows ?? period.topBrands;
  function load(search: string, page: number) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    start(async () => {
      try {
        const response = await consultarMarcas(categoryId, period.year, search, page, dataThrough);
        if (response.ok) setResult(response.result);
        else setError(response.error);
      } catch {
        setError("No pudimos cargar las marcas. Vuelve a intentarlo.");
      } finally {
        inFlight.current = false;
      }
    });
  }
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return <article aria-busy={pending}>
    <h3>{result ? "Marcas de la categoría" : "Principales marcas"}</h3>
    {result && <div className="mb-4">
      <label htmlFor={searchId} className="mb-2 block text-xs font-bold">Buscar marca en este período</label>
      <div className="flex flex-wrap gap-2">
        <input id={searchId} type="search" maxLength={100} value={query} disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-border bg-fog px-3 py-2 text-sm"
          placeholder="Nombre de la marca" onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!pending) load(query, 1); } }} />
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => load(query, 1)}>Buscar</button>
        {result.query && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setQuery(""); load("", 1); }}>Ver todas</button>}
      </div>
    </div>}
    <div role="status" className="mb-2 text-xs text-muted">
      {pending ? "Cargando marcas…" : result ? `${result.total} ${result.total === 1 ? "marca" : "marcas"}${result.query ? ` para “${result.query}”` : ""} · ${period.periodLabel}` : ""}
    </div>
    {error && <p role="alert" className="mb-3 text-sm">{error} {result && "Se mantienen los resultados de la última consulta completada."}</p>}
    <div className="infomedia-table-wrap"><table>
      <caption className="sr-only">Inversión y participación de marcas · {period.periodLabel}</caption>
      <thead><tr><th scope="col">Marca</th><th scope="col">Inversión estimada</th><th scope="col">SOI</th><th scope="col">SOA</th></tr></thead>
      <tbody>{rows.map((item, index) => <tr key={`${item.brand}-${index}`}><th scope="row">{item.brand}</th><td>{money(item.estimatedInvestment)}</td><td>{percent(item.soi)}</td><td>{percent(item.soa)}</td></tr>)}</tbody>
    </table></div>
    {!rows.length && <p className="py-4 text-sm">{result?.query ? "No hay marcas que coincidan con esta búsqueda en el período seleccionado." : "No hay marcas disponibles para este período."}</p>}
    {result ? <nav className="my-4 flex flex-wrap items-center justify-between gap-2" aria-label="Páginas de marcas">
      <button type="button" className="btn btn-secondary" disabled={pending || result.page <= 1} onClick={() => load(result.query, result.page - 1)}>Anterior</button>
      <span className="text-xs">Página {result.page} de {pages}</span>
      <button type="button" className="btn btn-secondary" disabled={pending || result.page >= pages} onClick={() => load(result.query, result.page + 1)}>Siguiente</button>
    </nav> : <button type="button" className="btn btn-secondary my-4" disabled={pending} onClick={() => load("", 1)}>Explorar todas las marcas</button>}
    <small>SOI: participación de inversión. SOA: participación de avisos. Se calculan sobre toda la categoría del período y no cambian al buscar. Ninguna equivale a alcance.</small>
  </article>;
}
