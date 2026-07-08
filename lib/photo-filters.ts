// Heuristic for filtering out obvious non-trip images (screenshots, saved web
// images, etc.) so they don't clutter a trip's photo gallery or get pulled
// into auto-discovered trips. Deliberately conservative — false positives
// (real trip photos folded into a trip) are worse than a few missed junk
// images, since the whole point is not annoying the user.

const SCREENSHOT_NAME_RE = /screen\s?shot|screen[_-]?recording/i;

export interface ScreenableEntry {
  name: string;
  /** Whether Dropbox returned any media_info metadata for this file. */
  hasMediaInfo: boolean;
}

export function isLikelyScreenshot(entry: ScreenableEntry): boolean {
  if (SCREENSHOT_NAME_RE.test(entry.name)) return true;
  // Real camera/phone photos are almost always jpg/heic and carry Dropbox
  // media_info; a PNG with no media_info at all is usually a screenshot or
  // an image saved from a website/email, not a trip photo.
  if (/\.png$/i.test(entry.name) && !entry.hasMediaInfo) return true;
  return false;
}
