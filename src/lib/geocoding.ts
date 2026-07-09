import type { RouteEndpoint, RouteEndpointId } from "@/types/location";

type OsrmNearestResponse = {
  code: string;
  waypoints: Array<{
    location: [number, number];
  }>;
};

export function createRouteEndpoint(
  id: RouteEndpointId,
  label: string,
  shortLabel: string,
  coordinate: [number, number],
): RouteEndpoint {
  return {
    id,
    label,
    shortLabel,
    query: label,
    coordinate,
    resolvedCoordinate: null,
  };
}

export const DEFAULT_START = createRouteEndpoint(
  "start",
  "Singapore",
  "SG",
  [103.8198, 1.3521],
);

export const DEFAULT_END = createRouteEndpoint(
  "end",
  "Kuala Lumpur",
  "KL",
  [101.6869, 3.139],
);

export function endpointCoordinate(endpoint: RouteEndpoint): [number, number] {
  return endpoint.resolvedCoordinate ?? endpoint.coordinate;
}

export function shortLabelFromPlace(label: string) {
  const words = label
    .split(",")[0]
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "???";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

export async function geocodePlace(
  query: string,
): Promise<{ coordinate: [number, number]; label: string } | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "routingllm/0.1",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as NominatimResult[];
  const hit = results[0];
  if (!hit) {
    return null;
  }

  return {
    coordinate: [Number(hit.lon), Number(hit.lat)],
    label: hit.display_name.split(",").slice(0, 2).join(",").trim(),
  };
}

export async function snapToRoadNetwork(
  coordinate: [number, number],
): Promise<[number, number]> {
  const [lng, lat] = coordinate;
  const url = `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`;

  const response = await fetch(url);
  if (!response.ok) {
    return coordinate;
  }

  const data = (await response.json()) as OsrmNearestResponse;
  const snapped = data.waypoints?.[0]?.location;
  if (data.code !== "Ok" || !snapped) {
    return coordinate;
  }

  return snapped;
}

export async function resolveRouteEndpoint(
  endpoint: RouteEndpoint,
): Promise<RouteEndpoint> {
  const resolvedCoordinate = await snapToRoadNetwork(endpoint.coordinate);
  return {
    ...endpoint,
    resolvedCoordinate,
  };
}

export async function resolveRouteEndpoints(
  start: RouteEndpoint,
  end: RouteEndpoint,
): Promise<{ start: RouteEndpoint; end: RouteEndpoint }> {
  const [resolvedStart, resolvedEnd] = await Promise.all([
    resolveRouteEndpoint(start),
    resolveRouteEndpoint(end),
  ]);

  return {
    start: resolvedStart,
    end: resolvedEnd,
  };
}
