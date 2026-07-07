import { NextResponse } from "next/server";
import { appKeyConfigured, buildAuthorizeUrl, generatePkce } from "@/lib/dropbox-auth";

const OAUTH_COOKIE = "dbx_oauth";

export async function GET(request: Request) {
  if (!appKeyConfigured()) {
    return NextResponse.json(
      {
        error:
          "DROPBOX_APP_KEY is not set. Create an app at https://www.dropbox.com/developers/apps and add its key to .env.local — see the README.",
      },
      { status: 503 }
    );
  }
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/dropbox/callback`;
  const { verifier, challenge, state } = generatePkce();

  const res = NextResponse.redirect(buildAuthorizeUrl({ redirectUri, state, challenge }));
  // PKCE verifier + state live in a short-lived cookie until the callback.
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/dropbox",
  });
  return res;
}
