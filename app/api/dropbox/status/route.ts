import { NextResponse } from "next/server";
import { connectionStatus } from "@/lib/dropbox-auth";

export async function GET() {
  return NextResponse.json(connectionStatus());
}
