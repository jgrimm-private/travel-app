import { NextResponse } from "next/server";
import { disconnect } from "@/lib/dropbox-auth";

export async function POST() {
  disconnect();
  return NextResponse.json({ ok: true });
}
