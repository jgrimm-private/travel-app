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

`lib/dropbox.ts` honors `DROPBOX_API_BASE` / `DROPBOX_CONTENT_BASE` overrides,
and `lib/dropbox-auth.ts` adds `DROPBOX_OAUTH_BASE` / `DROPBOX_WEB_BASE` for
the OAuth flow. To test the full connect-once flow, the mock must also serve:

- `GET /oauth2/authorize` → 302 back to the `redirect_uri` with
  `code` + `state` (simulates the user approving)
- `POST /oauth2/token` → `authorization_code` grant returns
  `{access_token, refresh_token, expires_in}`; `refresh_token` grant returns
  a new access token (count these to assert caching/refresh behavior)
- `POST /2/users/get_current_account` → `{name:{display_name}, email}`

Run with `DROPBOX_APP_KEY=test` plus all four base overrides pointing at the
mock and NO `DROPBOX_ACCESS_TOKEN`. Drive the browser: /settings → click
"Connect Dropbox" → should land on `/settings?dropbox=connected`. Then
restart the server and hit `/api/trips/1/photos` — it must succeed via one
refresh-token call (proves the connection survives restarts). Callback
probes: tampered `state`, missing cookie → `?dropbox=error`;
`?error=access_denied` → `?dropbox=denied`.
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

Trip coords fixture (geocoding blocked): set directly (storage is libsql;
better-sqlite3 is gone) —
`node -e "require('@libsql/client').createClient({url:'file:data/travel.db'}).execute('UPDATE trips SET lat=38.72,lng=-9.14 WHERE id=1')"`

## Testing auth

Auth (proxy.ts + /api/auth/*) activates only when AUTH_PASSWORD is set:
`AUTH_PASSWORD=swordfish npm start`. Assert: unauthed page → 307 to
`/login?from=<path>`; unauthed API → 401 JSON; wrong password → 401 (~500ms
delay); right password → `session` cookie, deep link honored after login;
`/login` while authed → 307 to `/`; tampered/expired cookie → 401; logout
kills the session. Without AUTH_PASSWORD everything must stay open (200s).
The login form password field is `#password`; errors are `p[role="alert"]`.
