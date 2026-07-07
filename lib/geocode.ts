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
