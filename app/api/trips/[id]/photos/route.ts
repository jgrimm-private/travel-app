import { NextResponse } from "next/server";
import { getTrip } from "@/lib/db";
import { dropboxConfigured, findTripPhotos } from "@/lib/dropbox";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const trip = Number.isInteger(id) ? getTrip(id) : undefined;
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  if (!dropboxConfigured()) {
    return NextResponse.json({ configured: false, photos: [] });
  }
  try {
    const photos = await findTripPhotos(trip);
    return NextResponse.json({ configured: true, photos });
  } catch (err) {
    return NextResponse.json(
      { configured: true, photos: [], error: err instanceof Error ? err.message : "Dropbox error" },
      { status: 502 }
    );
  }
}
