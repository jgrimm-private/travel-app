import { NextRequest, NextResponse } from "next/server";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Routes reachable without a session (the login page and the login call itself).
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function proxy(request: NextRequest) {
  if (!authEnabled()) {
    // Fail closed on Vercel: never let a hosted deployment run wide open.
    // Locally (no VERCEL env) the app stays usable without a password.
    if (process.env.VERCEL) {
      return new NextResponse(
        "This deployment has no AUTH_PASSWORD configured. Set AUTH_PASSWORD " +
          "(and AUTH_SECRET) in the Vercel project's environment variables, " +
          "then redeploy.",
        { status: 503, headers: { "Content-Type": "text/plain" } }
      );
    }
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const authed = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    // Already logged in? Skip the login page.
    if (authed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
