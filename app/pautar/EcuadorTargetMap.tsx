"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Circle as LeafletCircle,
  CircleMarker as LeafletCircleMarker,
  LayerGroup as LeafletLayerGroup,
  Map as LeafletMap,
} from "leaflet";

export type GeoTarget = {
  scope: "radius" | "country";
  label: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
};

const ECUADOR_CENTER = { latitude: -1.8312, longitude: -78.1834 };
const ECUADOR_LOCATIONS = [
  { label: "Guayaquil", province: "Guayas", latitude: -2.170998, longitude: -79.922359 },
  { label: "Quito", province: "Pichincha", latitude: -0.180653, longitude: -78.467834 },
  { label: "Cuenca", province: "Azuay", latitude: -2.900128, longitude: -79.005896 },
  { label: "Manta", province: "Manabí", latitude: -0.967653, longitude: -80.70891 },
  { label: "Loja", province: "Loja", latitude: -3.99313, longitude: -79.20422 },
  { label: "Machala", province: "El Oro", latitude: -3.258111, longitude: -79.955392 },
  { label: "Ambato", province: "Tungurahua", latitude: -1.24908, longitude: -78.61675 },
  { label: "Santo Domingo", province: "Santo Domingo de los Tsáchilas", latitude: -0.25305, longitude: -79.17536 },
  { label: "Portoviejo", province: "Manabí", latitude: -1.05458, longitude: -80.45445 },
  { label: "Esmeraldas", province: "Esmeraldas", latitude: 0.96818, longitude: -79.65172 },
  { label: "Riobamba", province: "Chimborazo", latitude: -1.66355, longitude: -78.65465 },
  { label: "Ibarra", province: "Imbabura", latitude: 0.35171, longitude: -78.12233 },
  { label: "Quevedo", province: "Los Ríos", latitude: -1.02251, longitude: -79.4604 },
  { label: "Babahoyo", province: "Los Ríos", latitude: -1.80217, longitude: -79.53443 },
  { label: "Salinas", province: "Santa Elena", latitude: -2.21452, longitude: -80.95151 },
  { label: "Santa Elena", province: "Santa Elena", latitude: -2.22622, longitude: -80.85873 },
  { label: "Milagro", province: "Guayas", latitude: -2.13404, longitude: -79.59415 },
  { label: "Daule", province: "Guayas", latitude: -1.86218, longitude: -79.97767 },
  { label: "Samborondón", province: "Guayas", latitude: -1.96276, longitude: -79.72402 },
  { label: "Durán", province: "Guayas", latitude: -2.17328, longitude: -79.83117 },
  { label: "Latacunga", province: "Cotopaxi", latitude: -0.93521, longitude: -78.61554 },
  { label: "Tulcán", province: "Carchi", latitude: 0.81187, longitude: -77.71727 },
  { label: "Tena", province: "Napo", latitude: -0.9938, longitude: -77.81286 },
  { label: "Puyo", province: "Pastaza", latitude: -1.49238, longitude: -77.99814 },
  { label: "Nueva Loja", province: "Sucumbíos", latitude: 0.08472, longitude: -76.88278 },
  { label: "Macas", province: "Morona Santiago", latitude: -2.30868, longitude: -78.11135 },
  { label: "Puerto Ayora", province: "Galápagos", latitude: -0.74358, longitude: -90.31567 },
] as const;

const QUICK_LOCATIONS = ECUADOR_LOCATIONS.slice(0, 6);

export function EcuadorTargetMap({ value, onChange }: { value: GeoTarget | null; onChange: (target: GeoTarget) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const centerRef = useRef<LeafletCircleMarker | null>(null);
  const countryLayerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [place, setPlace] = useState("");
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const clearLayers = useCallback(() => {
    circleRef.current?.remove();
    centerRef.current?.remove();
    countryLayerRef.current?.remove();
    circleRef.current = null;
    centerRef.current = null;
    countryLayerRef.current = null;
  }, []);

  const drawTarget = useCallback((target: GeoTarget | null) => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    if (!target) { clearLayers(); return; }

    if (target.scope === "country") {
      clearLayers();
      countryLayerRef.current = leaflet.layerGroup([
        leaflet.rectangle([[-5.15, -81.15], [1.55, -75.15]], { color: "#007d00", weight: 3, fillColor: "#00a100", fillOpacity: 0.13 }),
        leaflet.rectangle([[-1.75, -92.1], [0.8, -89.1]], { color: "#007d00", weight: 3, fillColor: "#00a100", fillOpacity: 0.13 }),
      ]).addTo(map);
      map.fitBounds([[-5.6, -92.5], [2, -74.5]], { padding: [12, 12] });
      return;
    }

    countryLayerRef.current?.remove();
    countryLayerRef.current = null;
    const center: [number, number] = [target.latitude, target.longitude];
    if (circleRef.current) {
      circleRef.current.setLatLng(center).setRadius(target.radiusKm * 1000);
      centerRef.current?.setLatLng(center);
      return;
    }
    circleRef.current = leaflet.circle(center, {
      radius: target.radiusKm * 1000,
      color: "#007d00",
      fillColor: "#00a100",
      fillOpacity: 0.18,
      weight: 3,
    }).addTo(map);
    centerRef.current = leaflet.circleMarker(center, {
      radius: 6,
      color: "#ffffff",
      fillColor: "#17281f",
      fillOpacity: 1,
      weight: 3,
    }).addTo(map);
  }, [clearLayers]);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; drawTarget(value); }, [drawTarget, value]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(containerRef.current, {
        minZoom: 5,
        maxZoom: 15,
        maxBounds: [[-6.2, -93.5], [2.7, -74.2]],
        maxBoundsViscosity: 0.8,
      }).setView([-1.7, -78.4], 6);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", ({ latlng }) => {
        const previous = valueRef.current;
        onChangeRef.current({
          scope: "radius",
          label: "Punto seleccionado",
          latitude: roundCoordinate(latlng.lat),
          longitude: roundCoordinate(latlng.lng),
          radiusKm: previous?.scope === "radius" ? previous.radiusKm : 25,
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
      countryLayerRef.current = null;
      leafletRef.current = null;
    };
  }, [drawTarget]);

  function selectLocation(location: (typeof ECUADOR_LOCATIONS)[number]) {
    const target: GeoTarget = {
      scope: "radius",
      label: `${location.label}, ${location.province}`,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: value?.scope === "radius" ? value.radiusKm : 25,
    };
    setPlace(location.label);
    setPlaceError(null);
    onChange(target);
    mapRef.current?.flyTo([target.latitude, target.longitude], location.province === "Galápagos" ? 8 : 10);
  }

  function findPlace() {
    const needle = comparable(place.trim());
    if (!needle) { setPlaceError("Escribe una ciudad o cantón de Ecuador."); return; }
    const match = ECUADOR_LOCATIONS.find((item) => comparable(`${item.label} ${item.province}`) === needle)
      ?? ECUADOR_LOCATIONS.find((item) => comparable(`${item.label} ${item.province}`).includes(needle));
    if (!match) {
      setPlaceError("No encontré esa ubicación en el directorio. Puedes marcar el punto directamente en el mapa.");
      return;
    }
    selectLocation(match);
  }

  function selectCountry() {
    setPlace("Todo Ecuador");
    setPlaceError(null);
    onChange({ scope: "country", label: "Todo Ecuador", ...ECUADOR_CENTER, radiusKm: 0 });
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setPlaceError("Este navegador no permite obtener la ubicación."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (!isInsideEcuador(coords.latitude, coords.longitude)) {
          setPlaceError("La ubicación detectada está fuera del área de Ecuador.");
          return;
        }
        const target: GeoTarget = {
          scope: "radius",
          label: "Mi ubicación",
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
          radiusKm: value?.scope === "radius" ? value.radiusKm : 25,
        };
        setPlace("Mi ubicación");
        setPlaceError(null);
        onChange(target);
        mapRef.current?.flyTo([target.latitude, target.longitude], 11);
      },
      () => { setLocating(false); setPlaceError("No pudimos obtener tu ubicación. Revisa el permiso del navegador o busca una ciudad."); },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  function changeRadius(radiusKm: number) {
    if (!value || value.scope !== "radius") return;
    onChange({ ...value, radiusKm });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={(event) => { event.preventDefault(); findPlace(); }} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-xs font-black text-forest">
          Buscar ciudad o cantón
          <input
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            list="ecuador-locations"
            placeholder="Ej. Guayaquil, Quito o Manta"
            className="mt-1 w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-normal outline-none focus:border-signal"
          />
          <datalist id="ecuador-locations">{ECUADOR_LOCATIONS.map((item) => <option key={item.label} value={item.label}>{item.province}</option>)}</datalist>
        </label>
        <button type="submit" className="btn btn-secondary self-end">Ubicar</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={selectCountry} className={`rounded-full border px-3 py-1.5 text-xs font-black ${value?.scope === "country" ? "border-signal bg-signal/15 text-signal-dark" : "border-border bg-white text-forest"}`}>🇪🇨 Todo Ecuador</button>
        <button type="button" onClick={useMyLocation} disabled={locating} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-black text-forest disabled:opacity-50">{locating ? "Ubicando…" : "◎ Usar mi ubicación"}</button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Ubicaciones rápidas">
        {QUICK_LOCATIONS.map((location) => (
          <button key={location.label} type="button" onClick={() => selectLocation(location)} className={`rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${value?.label.startsWith(location.label) ? "border-signal bg-signal/15 text-signal-dark" : "border-border bg-white text-forest hover:border-signal"}`}>
            {value?.label.startsWith(location.label) ? "✓ " : ""}📍 {location.label}
          </button>
        ))}
      </div>
      {placeError && <p className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs font-bold text-forest">{placeError}</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-fog shadow-inner">
        <div ref={containerRef} className="h-[320px] w-full" role="application" aria-label="Mapa de Ecuador para seleccionar el centro de la pauta" />
      </div>

      <div className="rounded-xl border border-border bg-fog p-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="target-radius" className="text-xs font-black text-forest">Cobertura geográfica</label>
          <output htmlFor="target-radius" className="text-sm font-black text-signal-dark">
            {!value ? "Selecciona una ubicación" : value.scope === "country" ? "Todo Ecuador" : `${value.radiusKm} km alrededor`}
          </output>
        </div>
        {value?.scope !== "country" && (
          <>
            <input id="target-radius" type="range" min="1" max="200" step="1" disabled={!value} value={value?.radiusKm ?? 25} onInput={(event) => changeRadius(Number(event.currentTarget.value))} className="mt-2 w-full accent-[#00a100] disabled:opacity-40" />
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 15, 30, 60, 100].map((radius) => <button key={radius} type="button" disabled={!value} onClick={() => changeRadius(radius)} className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-black text-forest disabled:opacity-40">{radius} km</button>)}
            </div>
          </>
        )}
        <p className="mt-2 text-[11px] text-muted">Busca una ciudad, usa tu ubicación, marca el mapa o selecciona cobertura nacional.</p>
        {value && <p className="mt-2 text-xs font-bold text-forest">{value.scope === "country" ? "Todo Ecuador · segmentación nacional" : `${value.label} · ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)} · radio ${value.radiusKm} km`}</p>}
      </div>
    </div>
  );
}

function comparable(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isInsideEcuador(latitude: number, longitude: number) {
  return latitude >= -6.2 && latitude <= 2.7 && longitude >= -93.5 && longitude <= -74.2;
}
