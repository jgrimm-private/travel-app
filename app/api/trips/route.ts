import { NextResponse } from "next/server";
import { createTrip, listTrips } from "@/lib/db";
import { geocode } from "@/lib/geocode";
import { validateTripInput } from "@/lib/validate";

export async function GET() {
  return NextResponse.json(await listTrips());
}

export async function POST(request: Request) {
  const input = validateTripInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }
  const coords = await geocode(input.location);
  const trip = await createTrip(input, coords);
  return NextResponse.json(trip, { status: 201 });
}
