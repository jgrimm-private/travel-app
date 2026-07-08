// Geocoding via OpenStreetMap Nominatim (free, no API key).
// https://nominatim.org/release-docs/latest/api/Search/

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export async function geocode(place: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", place);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, {
      // Nominatim's usage policy requires an identifying User-Agent.
      headers: { "User-Agent": "travel-app/0.1 (personal trip tracker)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (results.length === 0) return null;
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      display_name: results[0].display_name,
    };
  } catch {
    // Geocoding is best-effort: a trip without coordinates still works,
    // it just falls back to date-only photo matching.
    return null;
  }
}

export interface ReverseGeocodeResult {
  display_name: string;
  /** Short "City, Region, Country" label, best-effort. */
  label: string;
}

/** Reverse geocode a point to a human-readable place, e.g. for naming an
 * auto-discovered trip from a cluster of photo GPS coordinates. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-app/0.1 (personal trip tracker)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const result = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    if (!result.display_name) return null;
    const addr = result.address ?? {};
    const cityOrRegion = addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state;
    const country = addr.country;
    const label = [cityOrRegion, country].filter(Boolean).join(", ") || result.display_name;
    return { display_name: result.display_name, label };
  } catch {
    return null;
  }
}
