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
  without GPS still match by date. Click any photo for a full-size view.
- **Local-first storage** — trips live in a SQLite database in `data/`, no
  external services required for the core tracker.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and add your first trip.

## Connecting Dropbox (optional, but the fun part)

1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
   and click **Create app**.
2. Choose **Scoped access** → **Full Dropbox** (or App folder if you prefer),
   and name it anything (e.g. `my-trip-photos`).
3. On the **Permissions** tab, enable `files.metadata.read` and
   `files.content.read`, then click Submit.
4. On the **Settings** tab, click **Generate access token**.
5. Copy `.env.example` to `.env.local` and paste the token:

   ```
   DROPBOX_ACCESS_TOKEN=sl.xxxxxxxx
   DROPBOX_PHOTOS_PATH=/Camera Uploads   # or leave empty to scan everything
   ```

6. Restart the dev server. Every trip page now shows the photos you took
   during that trip.

> Note: tokens generated this way expire after a few hours. For long-lived
> access, set up the OAuth refresh-token flow — a good next milestone.

## API

| Method | Route                       | Purpose                                  |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/trips`                | List trips                               |
| POST   | `/api/trips`                | Create trip (geocodes the location)      |
| GET    | `/api/trips/:id`            | Get one trip                             |
| PUT    | `/api/trips/:id`            | Update trip                              |
| DELETE | `/api/trips/:id`            | Delete trip                              |
| GET    | `/api/trips/:id/photos`     | Dropbox photos matched to the trip       |
| GET    | `/api/photos/thumbnail`     | Proxy a Dropbox photo thumbnail          |

## Roadmap ideas

- **Email import** — parse booking confirmations (Expedia, Airbnb, airlines)
  from Gmail to create trips automatically, TripIt-style.
- **Map view** — pins for every trip on a world map.
- **Auto-detected trips** — cluster Dropbox photos by time and place to
  suggest trips you never entered.
- **Stats** — countries visited, days traveled per year, total miles flown.
- **Shared trips** — two-person household mode.
