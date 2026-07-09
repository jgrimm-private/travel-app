const GRADIENT_COUNT = 6;

/** Deterministic postcard-banner gradient for a trip, keyed by a stable
 * string (its location) so the same trip always looks the same. */
export function cardGradientClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `card-gradient-${Math.abs(hash) % GRADIENT_COUNT}`;
}
