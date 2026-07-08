// Photos taken near these "home" locations are never turned into auto-discovered
// trips (they're every-day photos, not travel). Coordinates are pre-resolved
// (via Nominatim, at setup time) so scanning doesn't depend on live geocoding.

import { haversineKm, MILES_TO_KM } from "./geo";

export interface HomeZone {
  label: string;
  lat: number;
  lng: number;
}

export const HOME_ZONES: HomeZone[] = [
  { label: "Westerville, OH 43082", lat: 40.126139, lng: -82.929529 },
  { label: "Charlotte, NC 28226", lat: 35.227209, lng: -80.843083 },
];

const RADIUS_MILES = Number(process.env.HOME_ZONE_RADIUS_MILES ?? "100");
export const RADIUS_KM = RADIUS_MILES * MILES_TO_KM;

/** True if the point falls within RADIUS_KM of any configured home zone. */
export function isNearHome(lat: number, lng: number): boolean {
  return HOME_ZONES.some((zone) => haversineKm(lat, lng, zone.lat, zone.lng) <= RADIUS_KM);
}
