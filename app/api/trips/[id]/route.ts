import { NextResponse } from "next/server";
import { deleteTrip, getTrip, updateTrip } from "@/lib/db";
import { geocode } from "@/lib/geocode";
import { validateTripInput } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  const trip = id !== null ? await getTrip(id) : undefined;
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  return NextResponse.json(trip);
}

export async function PUT(request: Request, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  const existing = id !== null ? await getTrip(id) : undefined;
  if (!existing || id === null) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }
  const input = validateTripInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }
  // Only re-geocode when the location text changed, to keep edits fast.
  const coords =
    input.location === existing.location && existing.lat != null && existing.lng != null
      ? { lat: existing.lat, lng: existing.lng }
      : await geocode(input.location);
  return NextResponse.json(await updateTrip(id, input, coords));
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const id = parseId((await ctx.params).id);
  if (id === null || !(await deleteTrip(id))) {
    return NextResponse.json({ error: "trip not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
