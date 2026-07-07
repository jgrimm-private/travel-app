import { NextRequest, NextResponse } from "next/server";
import { completeConnection, exchangeCode, fetchAccountInfo } from "@/lib/dropbox-auth";

const OAUTH_COOKIE = "dbx_oauth";

function settingsRedirect(origin: string, result: string): NextResponse {
  const res = NextResponse.redirect(`${origin}/settings?dropbox=${result}`);
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/dropbox" });
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (searchParams.get("error")) {
    // User clicked "Deny" on Dropbox's consent page.
    return settingsRedirect(origin, "denied");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookie = request.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !cookie) {
    return settingsRedirect(origin, "error");
  }

  let saved: { state: string; verifier: string };
  try {
    saved = JSON.parse(cookie);
  } catch {
    return settingsRedirect(origin, "error");
  }
  if (saved.state !== state) {
    return settingsRedirect(origin, "error");
  }

  try {
    const { refresh_token, access_token } = await exchangeCode({
      code,
      verifier: saved.verifier,
      redirectUri: `${origin}/api/dropbox/callback`,
    });
    const account = await fetchAccountInfo(access_token);
    completeConnection({
      refresh_token,
      account_name: account.name,
      account_email: account.email,
    });
    return settingsRedirect(origin, "connected");
  } catch (err) {
    console.error("Dropbox OAuth callback failed:", err);
    return settingsRedirect(origin, "error");
  }
}
