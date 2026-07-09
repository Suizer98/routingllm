const earthRadiusKm = 6371;

export function haversineKm(
  start: [number, number],
  end: [number, number],
) {
  const lat1 = (start[1] * Math.PI) / 180;
  const lat2 = (end[1] * Math.PI) / 180;
  const deltaLat = lat2 - lat1;
  const deltaLon = ((end[0] - start[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function pathLengthKm(coordinates: [number, number][]) {
  let total = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    total += haversineKm(coordinates[index - 1], coordinates[index]);
  }

  return total;
}

export function offsetPoint(
  point: [number, number],
  bearingRadians: number,
  distanceKm: number,
): [number, number] {
  const angularDistance = distanceKm / earthRadiusKm;
  const lat1 = (point[1] * Math.PI) / 180;
  const lon1 = (point[0] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export function bearingRadians(
  start: [number, number],
  end: [number, number],
) {
  const lat1 = (start[1] * Math.PI) / 180;
  const lat2 = (end[1] * Math.PI) / 180;
  const deltaLon = ((end[0] - start[0]) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return Math.atan2(y, x);
}

export function isWaypointAlongCorridor(
  waypoint: [number, number],
  start: [number, number],
  end: [number, number],
  maxDetourRatio = 1.4,
  maxDetourKm = 60,
) {
  const directDistance = haversineKm(start, end);
  const viaWaypoint =
    haversineKm(start, waypoint) + haversineKm(waypoint, end);

  return viaWaypoint <= directDistance * maxDetourRatio + maxDetourKm;
}

export function isReasonableRoute(
  coordinates: [number, number][],
  start: [number, number],
  end: [number, number],
  maxDetourRatio = 1.45,
  maxDetourKm = 80,
) {
  if (coordinates.length < 2) {
    return false;
  }

  const directDistance = haversineKm(start, end);
  const routeDistance = pathLengthKm(coordinates);

  return routeDistance <= directDistance * maxDetourRatio + maxDetourKm;
}
