"use client";

import { KeyboardEvent, PointerEvent, WheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  CoverageKind,
  CoverageSelection,
  coverageSummary,
  coverageForBoundary,
  geographyKey,
  geographyLabel,
  isNationalCoverage,
  nationalCoverage,
  normalizeSearch,
} from "@/lib/geographic-coverage";
import { CoverageMapFeature, EcuadorCoverageMap } from "./ecuador-coverage-map";

const MAP_WIDTH = 680;
const MAP_HEIGHT = 440;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

type BoundaryProperties = {
  shapeName: string;
  shapeID: string;
  shapeISO?: string;
  shapeType: "ADM1" | "ADM2";
};

type BoundaryFeature = Feature<Geometry, BoundaryProperties>;
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;

type CoverageOption = CoverageSelection & {
  feature: BoundaryFeature;
};

type CoverageSearchOption = CoverageSelection & {
  feature?: BoundaryFeature;
};

type MapTransform = {
  scale: number;
  x: number;
  y: number;
};

type GeographicCoveragePickerProps = {
  value: CoverageSelection[];
  onChange: (value: CoverageSelection[]) => void;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function GeographicCoveragePicker({ value, onChange }: GeographicCoveragePickerProps) {
  const [provinces, setProvinces] = useState<BoundaryFeature[]>([]);
  const [cantons, setCantons] = useState<BoundaryFeature[]>([]);
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [realMapState, setRealMapState] = useState<"loading" | "ready" | "fallback">("loading");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [transform, setTransform] = useState<MapTransform>({ scale: 1, x: 0, y: 0 });
  const [announcement, setAnnouncement] = useState(() => `Cobertura seleccionada: ${coverageSummary(value)}`);
  const searchRootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; originX: number; originY: number } | null>(null);
  const searchListId = "geographic-coverage-results";

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/data/ecuador-provinces.geojson").then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el mapa provincial");
        return response.json() as Promise<BoundaryCollection>;
      }),
      fetch("/data/ecuador-cantons.geojson").then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el mapa cantonal");
        return response.json() as Promise<BoundaryCollection>;
      }),
    ])
      .then(([provinceData, cantonData]) => {
        if (!mounted) return;
        if (!Array.isArray(provinceData.features) || !Array.isArray(cantonData.features)) throw new Error("Cartografía inválida");
        setProvinces(provinceData.features);
        setCantons(cantonData.features);
        setLoadState("ready");
      })
      .catch(() => {
        if (mounted) setLoadState("error");
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!resultsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) setResultsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [resultsOpen]);

  const options = useMemo<CoverageOption[]>(() => {
    if (!provinces.length) return [];
    const provinceOptions = provinces.map((feature) => {
      const label = geographyLabel(feature.properties.shapeName);
      return {
        key: geographyKey("province", label),
        kind: "province" as CoverageKind,
        label,
        feature,
      };
    });
    const cantonOptions = cantons.map((feature) => {
      const label = geographyLabel(feature.properties.shapeName);
      const context = coverageForBoundary(feature.properties.shapeID)?.context;
      return {
        key: geographyKey("city", label, context),
        kind: "city" as CoverageKind,
        label,
        context,
        feature,
      };
    });
    return [...provinceOptions, ...cantonOptions].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "province" ? -1 : 1;
      return left.label.localeCompare(right.label, "es-EC");
    });
  }, [cantons, provinces]);

  const filtered = useMemo<CoverageSearchOption[]>(() => {
    const search = normalizeSearch(query);
    const nationalMatches = !search || normalizeSearch("Nacional Ecuador todo el país cobertura nacional").includes(search);
    const localMatches = (!search ? options : options
      .filter((option) => normalizeSearch(`${option.label} ${option.context ?? ""} ${option.kind === "province" ? "provincia" : "ciudad canton"}`).includes(search))
    );
    return nationalMatches ? [nationalCoverage, ...localMatches] : localMatches;
  }, [options, query]);

  const nationalSelected = isNationalCoverage(value);
  const selectedOptionKeys = useMemo(() => new Set(value.map((item) => item.key)), [value]);
  const selectedCantonOptions = useMemo(
    () => options.filter((option) => option.kind === "city" && selectedOptionKeys.has(option.key)),
    [options, selectedOptionKeys],
  );
  const selectedProvinceKeys = useMemo(
    () => new Set(nationalSelected
      ? options.filter((item) => item.kind === "province").map((item) => item.key)
      : value.filter((item) => item.kind === "province").map((item) => item.key)),
    [nationalSelected, options, value],
  );
  const optionByShapeId = useMemo(
    () => new Map(options.map((option) => [option.feature.properties.shapeID, option])),
    [options],
  );
  const provinceMapFeatures = useMemo<CoverageMapFeature[]>(() => provinces.map((feature) => {
    const label = geographyLabel(feature.properties.shapeName);
    const key = geographyKey("province", label);
    return {
      ...feature,
      properties: { ...feature.properties, selectionKey: key, selected: nationalSelected || selectedOptionKeys.has(key) ? 1 : 0 },
    } as CoverageMapFeature;
  }), [nationalSelected, provinces, selectedOptionKeys]);
  const cantonMapFeatures = useMemo<CoverageMapFeature[]>(() => cantons.map((feature) => {
    const option = optionByShapeId.get(feature.properties.shapeID);
    const key = option?.key ?? geographyKey("city", geographyLabel(feature.properties.shapeName));
    return {
      ...feature,
      properties: { ...feature.properties, selectionKey: key, selected: selectedOptionKeys.has(key) ? 1 : 0, parentLabel: option?.context },
    } as CoverageMapFeature;
  }), [cantons, optionByShapeId, selectedOptionKeys]);

  const projection = useMemo(() => {
    if (!provinces.length) return null;
    const collection: BoundaryCollection = { type: "FeatureCollection", features: provinces };
    return geoMercator().fitExtent([[34, 28], [MAP_WIDTH - 34, MAP_HEIGHT - 28]], collection);
  }, [provinces]);
  const path = useMemo(() => projection ? geoPath(projection) : null, [projection]);

  function changeCoverage(next: CoverageSelection[], message: string) {
    onChange(next);
    setAnnouncement(message);
  }

  function focusOption(option: CoverageSearchOption) {
    setFocusedKey(option.key);
    if (option.kind === "country" || !option.feature) {
      setFocusedKey(null);
      setTransform({ scale: 1, x: 0, y: 0 });
      return;
    }
    if (!path) return;
    const [[x0, y0], [x1, y1]] = path.bounds(option.feature);
    const width = Math.max(1, x1 - x0);
    const height = Math.max(1, y1 - y0);
    const scale = clamp(0.72 / Math.max(width / MAP_WIDTH, height / MAP_HEIGHT), MIN_ZOOM, MAX_ZOOM);
    setTransform({
      scale,
      x: MAP_WIDTH / 2 - scale * ((x0 + x1) / 2),
      y: MAP_HEIGHT / 2 - scale * ((y0 + y1) / 2),
    });
  }

  function selectOption(option: CoverageSearchOption) {
    if (option.kind === "country") {
      changeCoverage([nationalCoverage], "Se seleccionó cobertura nacional para todo Ecuador.");
      setResultsOpen(false);
      setQuery("");
      focusOption(option);
      return;
    }
    const alreadySelected = selectedOptionKeys.has(option.key);
    const selection: CoverageSelection = { key: option.key, kind: option.kind, label: option.label, context: option.context };
    const parentKey = option.kind === "city" && option.context ? geographyKey("province", option.context) : null;
    const coveredByProvince = parentKey ? selectedOptionKeys.has(parentKey) : false;
    const currentValue = nationalSelected ? [] : value;
    const absorbedCantons = option.kind === "province" ? currentValue.filter((item) => item.kind === "city" && item.context === option.label) : [];
    const next = alreadySelected || coveredByProvince
      ? currentValue
      : option.kind === "province"
        ? [...currentValue.filter((item) => !(item.kind === "city" && item.context === option.label)), selection]
        : [...currentValue, selection];
    const message = alreadySelected
      ? `${option.label} ya forma parte de la cobertura.`
      : coveredByProvince
        ? `${option.label} ya está incluida dentro de ${option.context}.`
        : absorbedCantons.length
          ? `${option.label} se añadió y absorbió ${absorbedCantons.length} ${absorbedCantons.length === 1 ? "cantón ya seleccionado" : "cantones ya seleccionados"}.`
          : nationalSelected
            ? `Cobertura nacional se reemplazó por ${option.label}.`
            : `${option.label} se añadió a la cobertura.`;
    changeCoverage(next, message);
    setResultsOpen(false);
    setQuery("");
    focusOption(option);
  }

  function toggleProvince(option: CoverageOption) {
    if (selectedOptionKeys.has(option.key)) {
      changeCoverage(value.filter((item) => item.key !== option.key), `${option.label} se retiró de la cobertura.`);
    } else {
      selectOption(option);
    }
  }

  function removeSelection(selection: CoverageSelection) {
    changeCoverage(value.filter((item) => item.key !== selection.key), `${selection.label} se retiró de la cobertura.`);
    if (focusedKey === selection.key) setFocusedKey(null);
  }

  const handleRealMapState = useCallback((state: "loading" | "ready" | "fallback") => setRealMapState(state), []);
  function selectFromMap(key: string) {
    const option = options.find((candidate) => candidate.key === key);
    if (!option) return;
    if (selectedOptionKeys.has(key)) {
      changeCoverage(value.filter((item) => item.key !== key), `${option.label} se retiró de la cobertura.`);
      setFocusedKey(null);
      return;
    }
    selectOption(option);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => filtered.length ? Math.min(filtered.length - 1, current + 1) : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (resultsOpen && filtered[activeIndex]) selectOption(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setResultsOpen(false);
    }
  }

  function setZoom(nextScale: number, centerX = MAP_WIDTH / 2, centerY = MAP_HEIGHT / 2) {
    setTransform((current) => {
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      const contentX = (centerX - current.x) / current.scale;
      const contentY = (centerY - current.y) / current.scale;
      return { scale, x: centerX - contentX * scale, y: centerY - contentY * scale };
    });
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    if (!event.currentTarget.contains(document.activeElement)) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH;
    const centerY = ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT;
    setZoom(transform.scale * (event.deltaY < 0 ? 1.18 : 0.86), centerX, centerY);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "touch" && transform.scale <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    };
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = MAP_WIDTH / bounds.width;
    const ratioY = MAP_HEIGHT / bounds.height;
    setTransform((current) => ({
      ...current,
      x: drag.originX + (event.clientX - drag.clientX) * ratioX,
      y: drag.originY + (event.clientY - drag.clientY) * ratioY,
    }));
  }

  function endPointer(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <div className="geographic-coverage-field full-field">
      <div className="coverage-field-heading">
        <div>
          <span>Cobertura geográfica</span>
          <p>Selecciona todo Ecuador o combina provincias y cantones. El mapa se incorpora al criterio territorial del plan.</p>
        </div>
        <strong>{nationalSelected ? "Cobertura nacional" : `${value.length} ${value.length === 1 ? "zona" : "zonas"}`}</strong>
      </div>

      <div className="coverage-picker-shell">
        <div className="coverage-search-panel">
          <button
            type="button"
            className={`coverage-national-toggle ${nationalSelected ? "selected" : ""}`}
            aria-pressed={nationalSelected}
            onClick={() => nationalSelected
              ? changeCoverage([], "Se retiró la cobertura nacional.")
              : selectOption(nationalCoverage)}
          >
            <i aria-hidden="true">EC</i>
            <span><strong>Nacional</strong><small>Seleccionar todo Ecuador</small></span>
            <b aria-hidden="true">{nationalSelected ? "✓" : "→"}</b>
          </button>
          <div className="coverage-search" ref={searchRootRef}>
            <span aria-hidden="true">⌕</span>
            <input
              role="combobox"
              aria-label="Buscar provincia o cantón de Ecuador"
              aria-autocomplete="list"
              aria-expanded={resultsOpen}
              aria-controls={searchListId}
              aria-activedescendant={resultsOpen && filtered[activeIndex] ? `coverage-option-${activeIndex}` : undefined}
              placeholder="Ecuador, provincia o cantón"
              value={query}
              onFocus={() => setResultsOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setResultsOpen(true); }}
              onKeyDown={handleSearchKeyDown}
            />
            {resultsOpen && (
              <ul className="coverage-results" id={searchListId} role="listbox">
                {filtered.map((option, index) => (
                  <li className={index === activeIndex ? "active" : ""} key={option.key}>
                    <button id={`coverage-option-${index}`} role="option" aria-selected={selectedOptionKeys.has(option.key)} type="button" tabIndex={-1} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectOption(option)}>
                      <i className={option.kind} aria-hidden="true">{option.kind === "country" ? "EC" : option.kind === "province" ? "P" : "C"}</i>
                      <span><strong>{option.label}</strong><small>{option.kind === "country" ? "Todo Ecuador" : option.kind === "province" ? "Provincia" : `Cantón${option.context ? ` · ${option.context}` : ""}`}</small></span>
                      {selectedOptionKeys.has(option.key) && <b aria-hidden="true">✓</b>}
                    </button>
                  </li>
                ))}
                {loadState === "loading" && <li className="coverage-result-state">Cargando cobertura nacional…</li>}
                {loadState === "ready" && !filtered.length && <li className="coverage-result-state">No encontramos esa cobertura.</li>}
              </ul>
            )}
          </div>

          <div className="coverage-selection-summary">
            <span>Selección activa</span>
            <strong>{coverageSummary(value)}</strong>
          </div>
          <div className="coverage-chips">
            {value.map((selection) => (
              <button type="button" key={selection.key} onClick={() => removeSelection(selection)} aria-label={`Quitar ${selection.label}`}>
                <i className={selection.kind} aria-hidden="true" />
                <span>{selection.label}<small>{selection.kind === "country" ? "Todo Ecuador" : selection.kind === "province" ? "Provincia" : selection.context ?? "Cantón"}</small></span>
                <b aria-hidden="true">×</b>
              </button>
            ))}
            {!value.length && <p>Selecciona Nacional o busca una provincia o cantón.</p>}
          </div>
          <div className="coverage-map-legend" aria-label="Leyenda del mapa">
            <span><i className="selected" /> Seleccionado</span>
            <span><i /> Resto del mapa</span>
          </div>
          <p className="coverage-source">Mapa base: OpenStreetMap. Límites de planificación: geoBoundaries con fuentes INEC/OCHA. Validación comercial y municipal separada.</p>
        </div>

        <div className="ecuador-map-card">
          <div className="map-card-top">
            <div><span>Mapa real de Ecuador</span><strong>Busca, selecciona, amplía y arrastra</strong></div>
            <small>{loadState === "error" ? "Cartografía no disponible" : realMapState === "ready" ? "Calles + límites" : realMapState === "fallback" ? `Respaldo local · ${Math.round(transform.scale * 100)}%` : "Conectando mapa"}</small>
          </div>
          <div className={`map-stage ${realMapState === "ready" ? "real-map-ready" : ""}`}>
            {loadState === "loading" && <div className="map-loading"><span /><p>Cargando mapa nacional…</p></div>}
            {loadState === "error" && <div className="map-loading error"><strong>Cartografía temporalmente no disponible</strong><p>Recarga esta pantalla para volver a solicitar los límites de Ecuador.</p></div>}
            {loadState === "ready" && realMapState !== "fallback" && (
              <EcuadorCoverageMap
                provinces={provinceMapFeatures}
                cantons={cantonMapFeatures}
                focusedKey={focusedKey}
                onSelect={selectFromMap}
                onReadyChange={handleRealMapState}
              />
            )}
            {path && realMapState === "fallback" && (
              <svg
                className={`ecuador-map ${transform.scale > 1 ? "is-zoomed" : ""}`}
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                role="group"
                aria-label="Mapa interactivo de Ecuador por provincias y cantones seleccionados"
                tabIndex={0}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
              >
                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                  {provinces.map((feature) => {
                    const label = geographyLabel(feature.properties.shapeName);
                    const key = geographyKey("province", label);
                    const option = options.find((candidate) => candidate.key === key);
                    const selected = selectedProvinceKeys.has(key);
                    return (
                      <path
                        className={`province-shape ${selected ? "selected" : ""}`}
                        d={path(feature) ?? undefined}
                        vectorEffect="non-scaling-stroke"
                        role="button"
                        tabIndex={0}
                        aria-label={`${selected ? "Quitar" : "Seleccionar"} provincia de ${label}`}
                        aria-pressed={selected}
                        key={feature.properties.shapeID}
                        onClick={() => option && toggleProvince(option)}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && option) {
                            event.preventDefault();
                            toggleProvince(option);
                          }
                        }}
                      >
                        <title>{label}</title>
                      </path>
                    );
                  })}
                  {selectedCantonOptions.map((option) => (
                    <path
                      className="canton-shape selected"
                      d={path(option.feature) ?? undefined}
                      vectorEffect="non-scaling-stroke"
                      key={option.key}
                    >
                      <title>{option.label}{option.context ? `, ${option.context}` : ""}</title>
                    </path>
                  ))}
                </g>
              </svg>
            )}
            {realMapState === "fallback" && <div className="map-controls" aria-label="Controles del mapa">
              <button type="button" aria-label="Acercar" onClick={() => setZoom(transform.scale * 1.35)}>+</button>
              <button type="button" aria-label="Alejar" onClick={() => setZoom(transform.scale / 1.35)}>−</button>
              <button type="button" className="map-reset" aria-label="Restablecer mapa" onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}>↺</button>
            </div>}
            {realMapState === "fallback" && <div className="map-compass" aria-hidden="true"><span>N</span><i /></div>}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
