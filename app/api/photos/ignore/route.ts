import { NextResponse } from "next/server";
import { clearPhotoOverride, setPhotoOverride } from "@/lib/db";

const VALID_STATUSES = ["ignored", "included", "reset"] as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = body?.path;
  const status = body?.status;

  if (typeof path !== "string" || path.trim() === "") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  if (status === "reset") {
    await clearPhotoOverride(path);
  } else {
    await setPhotoOverride(path, status as "ignored" | "included");
  }
  return NextResponse.json({ ok: true });
}
