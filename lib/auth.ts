// Password login with stateless HMAC-signed session tokens.
//
// Auth is enabled by setting AUTH_PASSWORD (do this for any public deployment).
// Without it the app is open — fine for localhost. Uses Web Crypto only, so it
// runs in both the proxy (edge-compatible) and Node route handlers.

const enc = new TextEncoder();

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export function authEnabled(): boolean {
  return Boolean(process.env.AUTH_PASSWORD);
}

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(): Promise<CryptoKey> {
  // AUTH_SECRET decouples session validity from the password; without it,
  // sessions are invalidated whenever the password changes (a fine default).
  const secret = process.env.AUTH_SECRET || `travel-app-sessions:${process.env.AUTH_PASSWORD}`;
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(data: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(data)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Token format: "<expiresMs>.<hmac(expiresMs)>" */
export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return `${expires}.${await sign(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expires = token.slice(0, dot);
  if (!/^\d{1,15}$/.test(expires) || Number(expires) < Date.now()) return false;
  return constantTimeEqual(await sign(expires), token.slice(dot + 1));
}

export async function checkPassword(password: string): Promise<boolean> {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return false;
  // Compare HMACs rather than the strings so the comparison is constant-time
  // regardless of password length.
  return constantTimeEqual(await sign(`pw:${password}`), await sign(`pw:${expected}`));
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 86_400;
