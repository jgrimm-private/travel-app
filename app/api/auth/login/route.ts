import { NextResponse } from "next/server";
import {
  authEnabled,
  checkPassword,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ error: "auth is not enabled" }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!(await checkPassword(password))) {
    // Small fixed delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const url = new URL(request.url);
  const secure =
    request.headers.get("x-forwarded-proto") === "https" || url.protocol === "https:";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
