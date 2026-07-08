import { NextResponse } from "next/server";
import { discoverTrips } from "@/lib/discover";
import { dropboxConfigured } from "@/lib/dropbox";

export async function POST() {
  if (!dropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox is not connected" }, { status: 400 });
  }
  try {
    const result = await discoverTrips();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dropbox error" },
      { status: 502 }
    );
  }
}
