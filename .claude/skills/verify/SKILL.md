---
name: verify
description: Build, run, and drive the travel-app to verify changes end-to-end.
---

# Verifying travel-app changes

## Build & run

```bash
npm install
npm run build        # production build (better-sqlite3 is serverExternalPackages)
npm start            # serves on :3000; SQLite db auto-created in data/
```

Dev mode (`npm run dev`) works too but `npm start` is more stable for driving.

## Drive the surface

- API: `curl http://localhost:3000/api/trips` (see README for full route table).
  POST/PUT geocode via nominatim.openstreetmap.org — blocked in sandboxes
  without that host allowlisted; trips still save with `lat/lng: null`
  (graceful fallback, not a bug).
- UI: Playwright with the pre-installed Chromium
  (`executablePath: '/opt/pw-browsers/chromium'`). Key selectors: form fields
  use `#name #location #start_date #end_date #notes`; form errors render as
  `p[role="alert"]` (plain `[role="alert"]` also hits Next's route announcer).

## Testing Dropbox photo matching without real Dropbox

`lib/dropbox.ts` honors `DROPBOX_API_BASE` / `DROPBOX_CONTENT_BASE` overrides.
Run a local mock that serves `/files/list_folder` (entries with
`media_info.metadata.time_taken` + optional `location`) and
`/files/get_thumbnail_v2` (any JPEG bytes), then:

```bash
DROPBOX_ACCESS_TOKEN=test DROPBOX_API_BASE=http://localhost:9099 \
  DROPBOX_CONTENT_BASE=http://localhost:9099 npm start
curl http://localhost:3000/api/trips/1/photos
```

Matching rules to assert: in-date-range + GPS within PHOTO_MATCH_RADIUS_KM
(default 100) → `date+location`; in-range without GPS → `date`; GPS too far
or out of range → excluded; non-image extensions filtered.

Trip coords fixture (geocoding blocked): set directly —
`node -e "require('better-sqlite3')('data/travel.db').prepare('UPDATE trips SET lat=38.72,lng=-9.14 WHERE id=1').run()"`
