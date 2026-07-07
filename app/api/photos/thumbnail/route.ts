import { NextResponse } from "next/server";
import { dropboxConfigured, getThumbnail } from "@/lib/dropbox";

export async function GET(request: Request) {
  if (!dropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/")) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }
  const size = url.searchParams.get("size") === "large" ? "w2048h1536" : "w640h480";
  try {
    const image = await getThumbnail(path, size);
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "thumbnail failed" },
      { status: 502 }
    );
  }
}
