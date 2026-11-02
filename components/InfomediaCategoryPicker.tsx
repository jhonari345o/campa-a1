"use client";
import { useId, useRef, useState } from "react";
import { resolveCategory, searchCategories, type InfomediaCategory } from "@/lib/infomedia";

export function InfomediaCategoryPicker({ categories, initialId = "", initialLabel = "", error, onSelect, initialYear = 0, showPeriod = false }: {
  initialYear?: number; showPeriod?: boolean;
  categories: InfomediaCategory[]; initialId?: string; initialLabel?: string; error?: string;
  onSelect?: (category: InfomediaCategory | null) => void;
}) {
  const initial = resolveCategory(categories, initialId, initialLabel);
  const [selected, setSelected] = useState(initial ?? null);
  const [year, setYear] = useState(initial?.periods?.some((item) => item.year === initialYear) ? initialYear : initial?.periods?.[0]?.year ?? 0);
  const [query, setQuery] = useState(initial?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const results = searchCategories(categories, query);
  function choose(category: InfomediaCategory) {
    setSelected(category); setYear(category.periods?.[0]?.year ?? 0); setQuery(category.label); setOpen(false); setActive(0); onSelect?.(category);
  }
  function move(index: number) {
    const next = Math.max(0, Math.min(results.length - 1, index));
    setActive(next);
    listRef.current?.querySelectorAll('[role="option"]')[next]?.scrollIntoView({ block: "nearest" });
  }
  return <div className="infomedia-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>Categoría *</label>
    <input type="hidden" name="categoryId" value={selected?.id ?? ""} />
    {showPeriod && <input type="hidden" name="referenceYear" value={year} />}
    <input type="hidden" name="keyword" value={selected?.label ?? ""} />
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open && results[active] ? `${id}-option-${active}` : undefined}
      aria-describedby={`${id}-help`} autoComplete="off" required disabled={!categories.length}
      placeholder="Busca una categoría…" value={query}
      onFocus={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setSelected(null); onSelect?.(null); setOpen(true); setActive(0); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true); move(active + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Enter" && open) {
          event.preventDefault(); if (results[active]) choose(results[active]);
        } else if (open && (event.key === "Home" || event.key === "End")) {
          event.preventDefault(); move(event.key === "Home" ? 0 : results.length - 1);
        }
      }} />
    {open && categories.length > 0 && <div ref={listRef} id={`${id}-list`} role="listbox" aria-label="Categorías" className="infomedia-options">
      {results.map((category, index) => <button key={category.id} id={`${id}-option-${index}`} type="button" role="option"
        aria-selected={selected?.id === category.id} className={index === active ? "is-active" : ""}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(category)}>{category.label}</button>)}
      {!results.length && <p role="status">Sin coincidencias. Prueba con otra palabra de la categoría.</p>}
    </div>}
    {showPeriod && selected?.periods?.length ? <label className="infomedia-period-field">Período para el análisis<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{selected.periods.map((period) => <option key={period.year} value={period.year}>{period.label}</option>)}</select></label> : null}
    <small id={`${id}-help`}>{error || (selected ? "Categoría seleccionada" : initialLabel && !initial ? `Selección anterior: ${initialLabel}. Elige su categoría específica.` : `${categories.length} categorías · escribe y selecciona una opción`)}</small>
  </div>;
}
