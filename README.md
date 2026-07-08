# ✈️ Trips

A personal travel tracker: log your trips (name, location, dates, notes) and it
automatically finds the photos you took on each trip from your Dropbox — matched
by the date the photo was taken and, when the photo has GPS data, how close it
was to the trip's location.

## Features

- **Trip tracking** — name, location, start/end dates, duration, notes, and an
  upcoming / ongoing / past status on every trip.
- **Automatic geocoding** — type "Lisbon, Portugal" and the app resolves it to
  coordinates using OpenStreetMap (free, no API key needed).
- **Dropbox photo matching** — for each trip, the app scans your Dropbox for
  photos taken during the trip's dates. Photos with GPS metadata must also be
  within `PHOTO_MATCH_RADIUS_KM` (default 100 km) of the trip location; photos
  without GPS still match by date. Click any photo for a full-size view. Only a
  photo's real EXIF capture date counts as a confirmed match — photos with no
  capture date (only Dropbox's file-modified timestamp) show up in a separate
  "possible matches" section instead of being silently included, and likely
  screenshots (by filename or a media-less PNG) are hidden by default. Hide or
  restore any individual photo from a trip's gallery at any time.
- **Auto-discover trips** — a "Scan Dropbox for new trips" button (Settings)
  walks your whole Dropbox, groups GPS-tagged photos taken away from home into
  trip-shaped clusters (a gap of `TRIP_DISCOVERY_GAP_DAYS`, default 4, without
  an away photo starts a new trip; groups need at least
  `TRIP_DISCOVERY_MIN_PHOTOS`, default 3, photos), reverse-geocodes each one,
  and creates a Trip automatically. "Home" locations are configured in
  `lib/home-zones.ts` (currently Westerville, OH and Charlotte, NC, 100mi
  radius via `HOME_ZONE_RADIUS_MILES`) and are always skipped.
- **Local-first storage** — trips live in a SQLite database in `data/`, no
  external services required for the core tracker.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and add your first trip.

## Login (required for public hosting)

Set `AUTH_PASSWORD` in `.env.local` (or in your host's environment variables)
and the whole app — every page and API route — sits behind a login screen.
Sessions last 30 days via a signed httpOnly cookie; use **Log out** in the
header to end one early. Optionally set `AUTH_SECRET` to a long random string
so changing the password doesn't log everyone out.

With `AUTH_PASSWORD` unset the app runs open, which is fine on localhost.

## Deploying to Vercel

The app deploys to Vercel as-is with two caveats:

1. **Set `AUTH_PASSWORD`** (and ideally `AUTH_SECRET`) in the Vercel project's
   environment variables — never deploy this publicly without it.
2. **SQLite doesn't persist on Vercel.** Serverless filesystems are ephemeral,
   so trips and the Dropbox connection would vanish between deploys/restarts.
   Before going live, the data layer needs a hosted database — Turso is the
   near-drop-in choice for this SQLite schema (planned as its own milestone).
   Until then, treat Vercel deploys as previews.

Also update your Dropbox app's redirect URI to
`https://your-app.vercel.app/api/dropbox/callback` when you deploy.

## Connecting Dropbox (optional, but the fun part)

One-time setup — after this the app stays connected permanently via a
refresh token:

1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
   and click **Create app**.
2. Choose **Scoped access** → **Full Dropbox** (or App folder if you prefer),
   and name it anything (e.g. `my-trip-photos`).
3. On the **Permissions** tab, enable `files.metadata.read` and
   `files.content.read`, then click Submit.
4. On the **Settings** tab, add an **OAuth 2 redirect URI**:
   `http://localhost:3000/api/dropbox/callback`
5. Copy `.env.example` to `.env.local` and paste the **App key**:

   ```
   DROPBOX_APP_KEY=xxxxxxxxxxxxxxx
   DROPBOX_PHOTOS_PATH=/Camera Uploads   # or leave empty to scan everything
   ```

6. Restart the dev server, open **⚙️ Settings** in the app, and click
   **Connect Dropbox**. Approve access on Dropbox's page and you're done —
   every trip page now shows the photos you took during that trip, forever.

The refresh token is stored in the local SQLite database (`data/`, which is
gitignored). Use **Disconnect** on the Settings page to revoke it locally.
A static `DROPBOX_ACCESS_TOKEN` in `.env.local` still works as a legacy
fallback, but those tokens expire after a few hours.

## API

| Method | Route                       | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/trips`                | List trips                               |
| POST   | `/api/trips`                | Create trip (geocodes the location)      |
| GET    | `/api/trips/:id`            | Get one trip                             |
| PUT    | `/api/trips/:id`            | Update trip                              |
| DELETE | `/api/trips/:id`            | Delete trip                              |
| GET    | `/api/trips/:id/photos`     | Dropbox photos matched to the trip (confirmed / maybe / hiddenScreenshots) |
| GET    | `/api/photos/thumbnail`     | Proxy a Dropbox photo thumbnail          |
| POST   | `/api/photos/ignore`        | Hide/restore a photo (`{path, status}`, status = `ignored`\|`included`\|`reset`) |
| POST   | `/api/discover`             | Scan Dropbox and auto-create trips from photo clusters away from home |
| GET    | `/api/dropbox/connect`      | Start the Dropbox OAuth flow (PKCE)      |
| GET    | `/api/dropbox/callback`     | OAuth redirect target; stores the token  |
| GET    | `/api/dropbox/status`       | Connection status                        |
| POST   | `/api/dropbox/disconnect`   | Remove the stored connection             |
| POST   | `/api/auth/login`           | Password login; sets the session cookie  |
| POST   | `/api/auth/logout`          | Clear the session cookie                 |

All routes except `/login` and `/api/auth/login` require a session when
`AUTH_PASSWORD` is set (enforced in `proxy.ts`).

## Roadmap ideas

- **Email import** — parse booking confirmations (Expedia, Airbnb, airlines)
  from Gmail to create trips automatically, TripIt-style.
- **Map view** — pins for every trip on a world map.
- **Stats** — countries visited, days traveled per year, total miles flown.
- **Shared trips** — two-person household mode.
