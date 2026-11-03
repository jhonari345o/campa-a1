"use client";

import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

type CoverageMapProperties = {
  shapeName: string;
  shapeID: string;
  shapeISO?: string;
  shapeType: "ADM1" | "ADM2";
  selectionKey: string;
  selected: 0 | 1;
  parentLabel?: string;
};

export type CoverageMapFeature = Feature<Geometry, CoverageMapProperties>;

type EcuadorCoverageMapProps = {
  provinces: CoverageMapFeature[];
  cantons: CoverageMapFeature[];
  focusedKey: string | null;
  onSelect: (key: string) => void;
  onReadyChange: (state: "loading" | "ready" | "fallback") => void;
};

const ECUADOR_BOUNDS: [[number, number], [number, number]] = [
  [-95, -7],
  [-73, 4],
];
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

function featureCollection(features: CoverageMapFeature[]): FeatureCollection<Geometry, CoverageMapProperties> {
  return { type: "FeatureCollection", features };
}

function forEachPosition(coordinates: unknown, callback: (position: Position) => void) {
  if (!Array.isArray(coordinates)) return;
  if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    callback(coordinates as Position);
    return;
  }
  coordinates.forEach((child) => forEachPosition(child, callback));
}

function boundsForFeatures(features: CoverageMapFeature[]): [[number, number], [number, number]] | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  features.forEach((feature) => {
    if (feature.geometry.type === "GeometryCollection") {
      feature.geometry.geometries.forEach((geometry) => {
        if (geometry.type !== "GeometryCollection") forEachPosition(geometry.coordinates, include);
      });
      return;
    }
    forEachPosition(feature.geometry.coordinates, include);
  });

  function include(position: Position) {
    const [longitude, latitude] = position;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }

  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

export function EcuadorCoverageMap({ provinces, cantons, focusedKey, onSelect, onReadyChange }: EcuadorCoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  const focusedRef = useRef(focusedKey);
  const dataRef = useRef({ provinces, cantons });
  const allFeatures = useMemo(() => [...provinces, ...cantons], [cantons, provinces]);
  const dataReady = provinces.length > 0 && cantons.length > 0;

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { focusedRef.current = focusedKey; }, [focusedKey]);
  useEffect(() => { dataRef.current = { provinces, cantons }; }, [cantons, provinces]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !dataReady) return;
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimeout: number | null = null;
    let settled = false;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [-78.4, -1.55],
        zoom: 5,
        minZoom: 3,
        maxZoom: 14,
        maxBounds: ECUADOR_BOUNDS,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
        attributionControl: false,
        locale: {
          "Map.Title": "Mapa interactivo de cobertura en Ecuador",
          "NavigationControl.ZoomIn": "Acercar",
          "NavigationControl.ZoomOut": "Alejar",
          "AttributionControl.ToggleAttribution": "Mostrar atribuciones",
          "CooperativeGesturesHandler.WindowsHelpText": "Usa Ctrl y desplaza para ampliar el mapa",
          "CooperativeGesturesHandler.MacHelpText": "Usa ⌘ y desplaza para ampliar el mapa",
          "CooperativeGesturesHandler.MobileHelpText": "Usa dos dedos para mover el mapa",
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "geoBoundaries" }), "bottom-right");
      loadTimeout = window.setTimeout(() => {
        if (settled || !map) return;
        onReadyChange("fallback");
        map.remove();
        if (mapRef.current === map) mapRef.current = null;
        map = null;
      }, 10000);

      map.once("load", () => {
        if (!map) return;
        try {
          const currentData = dataRef.current;
          const firstSymbolLayerId = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
          map.addSource("ecuador-provinces", { type: "geojson", data: featureCollection(currentData.provinces), promoteId: "shapeID" });
          map.addSource("ecuador-cantons", { type: "geojson", data: featureCollection(currentData.cantons), promoteId: "shapeID" });

          map.addLayer({
            id: "ecuador-provinces-fill",
            type: "fill",
            source: "ecuador-provinces",
            paint: {
              "fill-color": ["case", ["==", ["get", "selected"], 1], "#ff735c", "#aeb7b2"],
              "fill-opacity": ["case", ["==", ["get", "selected"], 1], 0.76, 0.38],
            },
          }, firstSymbolLayerId);
          map.addLayer({
            id: "ecuador-provinces-line",
            type: "line",
            source: "ecuador-provinces",
            paint: { "line-color": ["case", ["==", ["get", "selected"], 1], "#7f211a", "#ffffff"], "line-width": ["case", ["==", ["get", "selected"], 1], 2.1, 1] },
          }, firstSymbolLayerId);
          map.addLayer({
            id: "ecuador-cantons-fill",
            type: "fill",
            source: "ecuador-cantons",
            paint: { "fill-color": "#ef4135", "fill-opacity": ["case", ["==", ["get", "selected"], 1], 0.64, 0] },
          }, firstSymbolLayerId);
          map.addLayer({
            id: "ecuador-cantons-line",
            type: "line",
            source: "ecuador-cantons",
            minzoom: 6.3,
            paint: {
              "line-color": ["case", ["==", ["get", "selected"], 1], "#721912", "rgba(82, 99, 91, .42)"],
              "line-width": ["case", ["==", ["get", "selected"], 1], 2.5, 0.55],
            },
          }, firstSymbolLayerId);
          map.addLayer({
            id: "ecuador-cantons-hit",
            type: "fill",
            source: "ecuador-cantons",
            minzoom: 7.2,
            paint: { "fill-color": "#000000", "fill-opacity": 0 },
          }, firstSymbolLayerId);

          const handleProvinceClick = (event: maplibregl.MapLayerMouseEvent) => {
            if (map && map.getZoom() >= 7.2) return;
            const key = event.features?.[0]?.properties?.selectionKey;
            if (typeof key === "string") selectRef.current(key);
          };
          const handleCantonClick = (event: maplibregl.MapLayerMouseEvent) => {
            const key = event.features?.[0]?.properties?.selectionKey;
            if (typeof key === "string") selectRef.current(key);
          };
          const showPointer = () => { if (map) map.getCanvas().style.cursor = "pointer"; };
          const clearPointer = () => { if (map) map.getCanvas().style.cursor = ""; };
          map.on("click", "ecuador-provinces-fill", handleProvinceClick);
          map.on("click", "ecuador-cantons-hit", handleCantonClick);
          map.on("mouseenter", "ecuador-provinces-fill", showPointer);
          map.on("mouseleave", "ecuador-provinces-fill", clearPointer);
          map.on("mouseenter", "ecuador-cantons-hit", showPointer);
          map.on("mouseleave", "ecuador-cantons-hit", clearPointer);

          const currentFeatures = [...currentData.provinces, ...currentData.cantons];
          const currentSelection = currentFeatures.filter((feature) => feature.properties.selected === 1);
          const focused = focusedRef.current ? currentFeatures.find((feature) => feature.properties.selectionKey === focusedRef.current) : null;
          const initialTargets = focused ? [focused] : currentSelection.length ? currentSelection : currentData.provinces;
          const initialBounds = boundsForFeatures(initialTargets);
          if (initialBounds) map.fitBounds(initialBounds, { padding: focused || currentSelection.length ? 72 : 34, duration: 0, maxZoom: focused?.properties.shapeType === "ADM2" ? 10.2 : 7.2 });
          settled = true;
          if (loadTimeout) window.clearTimeout(loadTimeout);
          onReadyChange("ready");
        } catch {
          if (loadTimeout) window.clearTimeout(loadTimeout);
          onReadyChange("fallback");
          map.remove();
          if (mapRef.current === map) mapRef.current = null;
          map = null;
        }
      });

      map.once("error", () => {
        if (settled) return;
        onReadyChange("fallback");
      });

      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(containerRef.current);
    } catch {
      onReadyChange("fallback");
    }

    return () => {
      if (loadTimeout) window.clearTimeout(loadTimeout);
      resizeObserver?.disconnect();
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [dataReady, onReadyChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("ecuador-provinces")) return;
    (map.getSource("ecuador-provinces") as GeoJSONSource | undefined)?.setData(featureCollection(provinces));
    (map.getSource("ecuador-cantons") as GeoJSONSource | undefined)?.setData(featureCollection(cantons));
  }, [cantons, provinces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("ecuador-provinces")) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const selected = allFeatures.filter((feature) => feature.properties.selected === 1);
    const focused = focusedKey ? allFeatures.find((feature) => feature.properties.selectionKey === focusedKey) : null;
    const targets = focused ? [focused] : selected.length ? selected : provinces;
    const bounds = boundsForFeatures(targets);
    if (bounds) map.fitBounds(bounds, { padding: focused || selected.length ? 72 : 34, duration: reducedMotion ? 0 : 700, maxZoom: focused?.properties.shapeType === "ADM2" ? 10.2 : 7.2 });
  }, [allFeatures, focusedKey, provinces]);

  return <div className="coverage-maplibre" ref={containerRef} role="region" aria-label="Mapa real e interactivo de Ecuador" />;
}
