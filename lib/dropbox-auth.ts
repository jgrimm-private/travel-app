// Dropbox OAuth 2 with PKCE and refresh tokens: connect once, stay connected.
//
// The one-time flow: /api/dropbox/connect redirects to Dropbox's consent page
// (with token_access_type=offline so we get a refresh token), the callback
// exchanges the code and stores the refresh token in SQLite. From then on
// getAccessToken() mints short-lived access tokens automatically.

import crypto from "node:crypto";
import { clearDropboxAuth, getDropboxAuth, saveDropboxAuth } from "./db";

// Overridable so tests can point at a mock server.
const OAUTH_BASE = process.env.DROPBOX_OAUTH_BASE ?? "https://api.dropboxapi.com";
const WEB_BASE = process.env.DROPBOX_WEB_BASE ?? "https://www.dropbox.com";
const API_BASE = process.env.DROPBOX_API_BASE ?? "https://api.dropboxapi.com/2";

export function appKeyConfigured(): boolean {
  return Boolean(process.env.DROPBOX_APP_KEY);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(args: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(`${WEB_BASE}/oauth2/authorize`);
  url.searchParams.set("client_id", process.env.DROPBOX_APP_KEY!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("code_challenge", args.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("state", args.state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({ ...params, client_id: process.env.DROPBOX_APP_KEY! });
  if (process.env.DROPBOX_APP_SECRET) body.set("client_secret", process.env.DROPBOX_APP_SECRET);
  const res = await fetch(`${OAUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Dropbox token request failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

// Access tokens are short-lived; cache one in memory until just before expiry.
let cached: { token: string; expiresAt: number } | null = null;

function cacheToken(token: TokenResponse): string {
  cached = {
    token: token.access_token,
    expiresAt: Date.now() + Math.max(token.expires_in - 60, 10) * 1000,
  };
  return token.access_token;
}

export async function exchangeCode(args: {
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<{ refresh_token: string; access_token: string }> {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code: args.code,
    code_verifier: args.verifier,
    redirect_uri: args.redirectUri,
  });
  if (!token.refresh_token) {
    throw new Error("Dropbox did not return a refresh token");
  }
  cacheToken(token);
  return { refresh_token: token.refresh_token, access_token: token.access_token };
}

export async function fetchAccountInfo(
  accessToken: string
): Promise<{ name: string | null; email: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/users/get_current_account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { name: null, email: null };
    const account = (await res.json()) as {
      name?: { display_name?: string };
      email?: string;
    };
    return { name: account.name?.display_name ?? null, email: account.email ?? null };
  } catch {
    return { name: null, email: null };
  }
}

export async function completeConnection(args: {
  refresh_token: string;
  account_name: string | null;
  account_email: string | null;
}): Promise<void> {
  await saveDropboxAuth(args);
}

export async function disconnect(): Promise<void> {
  await clearDropboxAuth();
  cached = null;
}

export interface ConnectionStatus {
  connected: boolean;
  source: "oauth" | "env" | null;
  account_name: string | null;
  account_email: string | null;
  connected_at: string | null;
  app_key_configured: boolean;
}

export async function connectionStatus(): Promise<ConnectionStatus> {
  const auth = await getDropboxAuth();
  if (auth) {
    return {
      connected: true,
      source: "oauth",
      account_name: auth.account_name,
      account_email: auth.account_email,
      connected_at: auth.connected_at,
      app_key_configured: appKeyConfigured(),
    };
  }
  if (process.env.DROPBOX_ACCESS_TOKEN) {
    return {
      connected: true,
      source: "env",
      account_name: null,
      account_email: null,
      connected_at: null,
      app_key_configured: appKeyConfigured(),
    };
  }
  return {
    connected: false,
    source: null,
    account_name: null,
    account_email: null,
    connected_at: null,
    app_key_configured: appKeyConfigured(),
  };
}

export async function dropboxConnected(): Promise<boolean> {
  return (await connectionStatus()).connected;
}

/**
 * Returns a valid access token, refreshing via the stored refresh token when
 * needed. Falls back to a static DROPBOX_ACCESS_TOKEN env var if no OAuth
 * connection exists (legacy setup).
 */
export async function getAccessToken(): Promise<string> {
  const auth = await getDropboxAuth();
  if (!auth) {
    const envToken = process.env.DROPBOX_ACCESS_TOKEN;
    if (envToken) return envToken;
    throw new Error("Dropbox is not connected");
  }
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: auth.refresh_token,
  });
  return cacheToken(token);
}
