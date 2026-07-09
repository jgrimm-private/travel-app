import { NextResponse } from "next/server";
import { getTrip } from "@/lib/db";
import { dropboxConfigured, findTripPhotos } from "@/lib/dropbox";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  const trip = Number.isInteger(id) ? await getTrip(id) : undefined;
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  if (!(await dropboxConfigured())) {
    return NextResponse.json({ configured: false, confirmed: [], maybe: [], hiddenScreenshots: [] });
  }
  try {
    const results = await findTripPhotos(trip);
    return NextResponse.json({ configured: true, ...results });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        confirmed: [],
        maybe: [],
        hiddenScreenshots: [],
        error: err instanceof Error ? err.message : "Dropbox error",
      },
      { status: 502 }
    );
  }
}
