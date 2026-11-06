function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates.length ? [geometry.coordinates[0]] : [];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap((polygon) => polygon.length ? [polygon[0]] : []);
  if (geometry.type === "GeometryCollection") return geometry.geometries.flatMap(outerRings);
  return [];
}

function pointOnSegment([x, y], [ax, ay], [bx, by]) {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (x - ax) * (x - bx) + (y - ay) * (y - by);
  return dot <= 1e-9;
}

function ringContainsPoint(ring, point) {
  if (!ring?.length) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    const intersects = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(polygon, point) {
  if (!polygon?.length || !ringContainsPoint(polygon[0], point)) return false;
  return !polygon.slice(1).some((hole) => ringContainsPoint(hole, point));
}

export function geometryContainsPoint(geometry, point) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return polygonContainsPoint(geometry.coordinates, point);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygonContainsPoint(polygon, point));
  if (geometry.type === "GeometryCollection") return geometry.geometries.some((child) => geometryContainsPoint(child, point));
  return false;
}

function planarRingCentroid(ring) {
  if (!ring?.length) return null;
  let areaTwice = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x0, y0] = ring[previous];
    const [x1, y1] = ring[index];
    const cross = x0 * y1 - x1 * y0;
    areaTwice += cross;
    centroidX += (x0 + x1) * cross;
    centroidY += (y0 + y1) * cross;
  }
  if (Math.abs(areaTwice) < 1e-12) {
    const usable = ring.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (!usable.length) return null;
    return [
      usable.reduce((sum, [x]) => sum + x, 0) / usable.length,
      usable.reduce((sum, [, y]) => sum + y, 0) / usable.length,
    ];
  }
  return [centroidX / (3 * areaTwice), centroidY / (3 * areaTwice)];
}

function representativePoints(feature) {
  const points = [];
  for (const ring of outerRings(feature.geometry)) {
    const centroid = planarRingCentroid(ring);
    if (centroid && geometryContainsPoint(feature.geometry, centroid)) points.push(centroid);
    const step = Math.max(1, Math.floor(ring.length / 24));
    for (let index = 0; index < ring.length; index += step) {
      const point = ring[index];
      if (Number.isFinite(point?.[0]) && Number.isFinite(point?.[1])) points.push(point);
    }
  }
  return points;
}

export function findParentBoundary(child, parents) {
  const samples = representativePoints(child);
  if (!samples.length) return undefined;
  let best;
  let bestScore = 0;
  for (const candidate of parents) {
    const score = samples.reduce(
      (total, point) => total + (geometryContainsPoint(candidate.geometry, point) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
