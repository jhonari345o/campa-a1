"use client";

import { useEffect, useRef } from "react";
import type {
  Circle as LeafletCircle,
  CircleMarker as LeafletCircleMarker,
  Map as LeafletMap,
} from "leaflet";

export type GeoTarget = {
  label: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
};

const QUICK_LOCATIONS = [
  { label: "Guayaquil", latitude: -2.170998, longitude: -79.922359 },
  { label: "Quito", latitude: -0.180653, longitude: -78.467834 },
  { label: "Cuenca", latitude: -2.900128, longitude: -79.005896 },
  { label: "Manta", latitude: -0.967653, longitude: -80.70891 },
  { label: "Loja", latitude: -3.99313, longitude: -79.20422 },
  { label: "Galapagos", latitude: -0.953769, longitude: -90.965601 },
];

export function EcuadorTargetMap({
  value,
  onChange,
}: {
  value: GeoTarget | null;
  onChange: (target: GeoTarget) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const centerRef = useRef<LeafletCircleMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
    drawTarget(value);
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = leaflet;

      const map = leaflet
        .map(containerRef.current, {
          minZoom: 5,
          maxZoom: 15,
          maxBounds: [
            [-6.2, -93.5],
            [2.7, -74.2],
          ],
          maxBoundsViscosity: 0.8,
        })
        .setView([-1.7, -78.4], 6);

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      map.on("click", ({ latlng }) => {
        const previous = valueRef.current;
        onChangeRef.current({
          label: "Punto seleccionado",
          latitude: roundCoordinate(latlng.lat),
          longitude: roundCoordinate(latlng.lng),
          radiusKm: previous?.radiusKm ?? 25,
        });
      });

      mapRef.current = map;
      drawTarget(valueRef.current);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      circleRef.current = null;
      centerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  function drawTarget(target: GeoTarget | null) {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;

    if (!target) {
      circleRef.current?.remove();
      centerRef.current?.remove();
      circleRef.current = null;
      centerRef.current = null;
      return;
    }

    const center: [number, number] = [target.latitude, target.longitude];
    if (circleRef.current) {
      circleRef.current.setLatLng(center).setRadius(target.radiusKm * 1000);
      centerRef.current?.setLatLng(center);
      return;
    }

    circleRef.current = leaflet
      .circle(center, {
        radius: target.radiusKm * 1000,
        color: "#007d00",
        fillColor: "#00a100",
        fillOpacity: 0.18,
        weight: 3,
      })
      .addTo(map);
    centerRef.current = leaflet
      .circleMarker(center, {
        radius: 6,
        color: "#ffffff",
        fillColor: "#17281f",
        fillOpacity: 1,
        weight: 3,
      })
      .addTo(map);
  }

  function selectLocation(location: (typeof QUICK_LOCATIONS)[number]) {
    const target = {
      ...location,
      radiusKm: value?.radiusKm ?? 25,
    };
    onChange(target);
    mapRef.current?.flyTo([target.latitude, target.longitude], target.label === "Galapagos" ? 8 : 10);
  }

  function changeRadius(radiusKm: number) {
    if (!value) return;
    onChange({ ...value, radiusKm });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Ubicaciones rapidas">
        {QUICK_LOCATIONS.map((location) => (
          <button
            key={location.label}
            type="button"
            onClick={() => selectLocation(location)}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-black transition-colors " +
              (value?.label === location.label
                ? "border-signal bg-signal/15 text-signal-dark"
                : "border-border bg-white text-forest hover:border-signal")
            }
          >
            {value?.label === location.label ? "✓ " : ""}📍 {location.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-fog shadow-inner">
        <div
          ref={containerRef}
          className="h-[320px] w-full"
          role="application"
          aria-label="Mapa de Ecuador para seleccionar el centro de la pauta"
        />
      </div>

      <div className="rounded-xl border border-border bg-fog p-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="target-radius" className="text-xs font-black text-forest">
            Radio de alcance
          </label>
          <output htmlFor="target-radius" className="text-sm font-black text-signal-dark">
            {value ? `${value.radiusKm} km` : "Selecciona un punto"}
          </output>
        </div>
        <input
          id="target-radius"
          type="range"
          min="1"
          max="200"
          step="1"
          disabled={!value}
          value={value?.radiusKm ?? 25}
          onInput={(event) => changeRadius(Number(event.currentTarget.value))}
          className="mt-2 w-full accent-[#00a100] disabled:opacity-40"
        />
        <p className="mt-1 text-[11px] text-muted">
          Haz clic en el mapa para mover el centro y ajusta el circulo entre 1 y 200 km.
        </p>
        {value && (
          <p className="mt-2 text-xs font-bold text-forest">
            {value.label} · {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)} · radio {value.radiusKm} km
          </p>
        )}
      </div>
    </div>
  );
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
