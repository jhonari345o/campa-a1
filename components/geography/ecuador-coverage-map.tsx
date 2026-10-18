"use client";

import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeoJSON, Map as LeafletMap, PathOptions } from "leaflet";

type CoverageMapProperties = {
  shapeName: string;
  shapeID: string;
  shapeType: "ADM1" | "ADM2";
  selectionKey: string;
  selected: 0 | 1;
  parentLabel?: string;
};
export type CoverageMapFeature = Feature<Geometry, CoverageMapProperties>;
type Props = {
  provinces: CoverageMapFeature[];
  cantons: CoverageMapFeature[];
  focusedKey: string | null;
  onSelect: (key: string) => void;
  onReadyChange: (state: "loading" | "ready" | "fallback") => void;
};

function positions(coordinates: unknown, include: (position: Position) => void) {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") include(coordinates);
  else coordinates.forEach((child) => positions(child, include));
}

export function EcuadorCoverageMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef<{ provinces: GeoJSON; cantons: GeoJSON } | null>(null);
  const current = useRef(props);
  const redraw = useRef<(() => void) | null>(null);
  const dataReady = props.provinces.length > 0 && props.cantons.length > 0;
  useEffect(() => { current.current = props; redraw.current?.(); }, [props]);

  useEffect(() => {
    if (!container.current || !dataReady) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      const instance = L.map(container.current, {
        minZoom: 3, maxZoom: 14, scrollWheelZoom: false,
        maxBounds: [[-7, -95], [4, -73]], maxBoundsViscosity: 0.8,
      });
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · geoBoundaries',
      }).addTo(instance);
      const style = (feature?: Feature<Geometry, CoverageMapProperties>): PathOptions => ({
        color: feature?.properties.selected ? "#7f211a" : "#ffffff",
        weight: feature?.properties.selected ? 2 : 1,
        fillColor: feature?.properties.selected ? "#ff735c" : "#aeb7b2",
        fillOpacity: feature?.properties.selected ? 0.65 : feature?.properties.shapeType === "ADM2" ? 0 : 0.24,
      });
      function makeLayer(kind: "ADM1" | "ADM2") {
        return L.geoJSON<CoverageMapProperties>(undefined, {
          style,
          onEachFeature(feature, layer) {
            // Use text nodes, never provider-supplied HTML, in map labels.
            const label = document.createElement("span");
            label.textContent = feature.properties.shapeName;
            layer.bindTooltip(label);
            layer.on("click", () => {
              if (kind === "ADM1" && instance.getZoom() >= 7) return;
              current.current.onSelect(feature.properties.selectionKey);
            });
          },
        });
      }
      const provinceLayer = makeLayer("ADM1").addTo(instance);
      const cantonLayer = makeLayer("ADM2");
      layers.current = { provinces: provinceLayer, cantons: cantonLayer };
      const updateCantonVisibility = () => {
        if (instance.getZoom() >= 7) cantonLayer.addTo(instance);
        else cantonLayer.remove();
      };
      instance.on("zoomend", updateCantonVisibility);
      let lastViewport = "";
      redraw.current = () => {
        const { provinces, cantons, focusedKey } = current.current;
        const collection = (features: CoverageMapFeature[]): FeatureCollection<Geometry, CoverageMapProperties> => ({ type: "FeatureCollection", features });
        provinceLayer.clearLayers().addData(collection(provinces));
        // At country scale, selected cantons must remain visible as complete polygons.
        const shownCantons = instance.getZoom() >= 7 ? cantons : cantons.filter((feature) => feature.properties.selected === 1);
        cantonLayer.clearLayers().addData(collection(shownCantons));
        if (shownCantons.some((feature) => feature.properties.selected) || instance.getZoom() >= 7) cantonLayer.addTo(instance);
        else cantonLayer.remove();
        const all = [...provinces, ...cantons];
        const selected = all.filter((feature) => feature.properties.selected === 1);
        const focus = focusedKey ? all.find((feature) => feature.properties.selectionKey === focusedKey) : undefined;
        const viewportKey = `${focusedKey ?? ""}|${selected.map((feature) => feature.properties.selectionKey).join(",")}`;
        if (viewportKey === lastViewport && lastViewport) return;
        lastViewport = viewportKey;
        const targets = focus ? [focus] : selected.length ? selected : provinces;
        const bounds = L.latLngBounds([]);
        const include = ([longitude, latitude]: Position) => {
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) bounds.extend([latitude, longitude]);
        };
        for (const feature of targets) {
          if (feature.geometry.type === "GeometryCollection") {
            for (const geometry of feature.geometry.geometries) if (geometry.type !== "GeometryCollection") positions(geometry.coordinates, include);
          } else positions(feature.geometry.coordinates, include);
        }
        if (bounds.isValid()) instance.fitBounds(bounds, { padding: [24, 24], maxZoom: focus?.properties.shapeType === "ADM2" ? 10 : 8, animate: false });
      };
      instance.on("zoomend", () => {
        const data = current.current.cantons;
        const collection: FeatureCollection<Geometry, CoverageMapProperties> = {type:"FeatureCollection",features: instance.getZoom() >= 7 ? data : data.filter((f) => f.properties.selected)};
        cantonLayer.clearLayers().addData(collection);
        if (instance.getZoom() >= 7 || data.some((f) => f.properties.selected)) cantonLayer.addTo(instance);
      });
      redraw.current();
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      current.current.onReadyChange("ready");
    }).catch(() => { if (!cancelled) current.current.onReadyChange("fallback"); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      redraw.current = null;
      map.current?.remove();
      map.current = null;
      layers.current = null;
    };
  }, [dataReady]);
  return <div ref={container} className="coverage-map-canvas" role="region" aria-label="Mapa de Ecuador con provincias y cantones seleccionados" />;
}
