// Verifies Clerk session tokens inside the worker.
//
// Follows Clerk's "manual JWT verification" guide: the browser sends the
// short-lived session token (RS256 JWT) as a Bearer token, and we check its
// signature against Clerk's public key, its expiry, and which site issued it.
// Uses only Web Crypto, so it runs natively on Cloudflare Workers.

import type { Env } from "./env";
import { HttpError } from "./http";

export type SessionClaims = {
  userId: string;
  sessionId: string | null;
  email: string | null;
};

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtPayload = {
  sub?: string;
  sid?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  azp?: string;
  email?: string;
  sts?: string;
};
type Jwk = JsonWebKey & { kid?: string };

const CLOCK_SKEW_SECONDS = 5;
const JWKS_CACHE_MS = 60 * 60 * 1000;

let jwksCache: { url: string; keys: Jwk[]; fetchedAt: number } | null = null;
const keyCache = new Map<string, CryptoKey>();

export async function authenticate(request: Request, env: Env): Promise<SessionClaims> {
  const token = readToken(request);
  if (!token) {
    throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "invalid_token", "The session token is malformed.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson<JwtHeader>(encodedHeader);
  const payload = decodeJson<JwtPayload>(encodedPayload);

  if (header.alg !== "RS256") {
    throw new HttpError(401, "invalid_token", "Unsupported token algorithm.");
  }

  const key = await getVerificationKey(env, header.kid);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!valid) {
    throw new HttpError(401, "invalid_token", "The session token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now - CLOCK_SKEW_SECONDS) {
    throw new HttpError(401, "token_expired", "Your session token has expired.");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new HttpError(401, "invalid_token", "The session token is not active yet.");
  }
  if (!payload.sub) {
    throw new HttpError(401, "invalid_token", "The session token has no user.");
  }
  if (payload.sts === "pending") {
    throw new HttpError(401, "session_pending", "Please finish signing in first.");
  }

  // `azp` is the origin of the page that requested the token. Only accept
  // tokens minted for this site (or explicitly configured extra origins).
  if (payload.azp) {
    const allowed = authorizedParties(request, env);
    if (!allowed.includes(payload.azp)) {
      throw new HttpError(401, "invalid_token", "This token was issued for another site.");
    }
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid ?? null,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

function readToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() || null;
  }

  // Same-origin requests also carry Clerk's `__session` cookie.
  const cookie = request.headers.get("Cookie") ?? "";
  const match = /(?:^|;\s*)__session=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

function authorizedParties(request: Request, env: Env): string[] {
  const configured = (env.CLERK_AUTHORIZED_PARTIES ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [new URL(request.url).origin, ...configured];
}

async function getVerificationKey(env: Env, kid: string | undefined): Promise<CryptoKey> {
  // Option 1: the PEM public key from the Clerk dashboard (no network call).
  if (env.CLERK_JWT_KEY) {
    const cacheKey = `pem:${env.CLERK_JWT_KEY}`;
    const cached = keyCache.get(cacheKey);
    if (cached) return cached;

    const key = await crypto.subtle.importKey(
      "spki",
      pemToBytes(env.CLERK_JWT_KEY),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keyCache.set(cacheKey, key);
    return key;
  }

  // Option 2: Clerk's public JWKS endpoint for this instance.
  if (!kid) {
    throw new HttpError(401, "invalid_token", "The session token has no key id.");
  }

  const cached = keyCache.get(`kid:${kid}`);
  if (cached) return cached;

  const url = jwksUrl(env);
  let jwk = (await loadJwks(url, false)).find((candidate) => candidate.kid === kid);

  // Clerk may have rotated keys since we cached them.
  if (!jwk) {
    jwk = (await loadJwks(url, true)).find((candidate) => candidate.kid === kid);
  }
  if (!jwk) {
    throw new HttpError(401, "invalid_token", "Unknown session token key.");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  keyCache.set(`kid:${kid}`, key);
  return key;
}

async function loadJwks(url: string, forceRefresh: boolean): Promise<Jwk[]> {
  const fresh = jwksCache && jwksCache.url === url && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS;
  if (fresh && !forceRefresh && jwksCache) {
    return jwksCache.keys;
  }

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new HttpError(503, "auth_unavailable", "Could not reach Clerk to verify the session.");
  }

  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache = { url, keys, fetchedAt: Date.now() };
  return keys;
}

/** pk_test_Y2xlcmsuZXhhbXBsZS5jb20k -> https://clerk.example.com/.well-known/jwks.json */
export function jwksUrl(env: Env): string {
  const host = frontendApiHost(env.CLERK_PUBLISHABLE_KEY);
  return `https://${host}/.well-known/jwks.json`;
}

export function frontendApiHost(publishableKey: string | undefined): string {
  const match = /^pk_(?:test|live)_(.+)$/.exec((publishableKey ?? "").trim());
  if (!match) {
    throw new HttpError(500, "config_error", "CLERK_PUBLISHABLE_KEY is missing or invalid.");
  }

  const decoded = new TextDecoder().decode(base64UrlToBytes(match[1]));
  const host = decoded.replace(/\$$/, "");
  if (!/^[a-z0-9.-]+$/i.test(host)) {
    throw new HttpError(500, "config_error", "CLERK_PUBLISHABLE_KEY is missing or invalid.");
  }
  return host;
}

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
  } catch {
    throw new HttpError(401, "invalid_token", "The session token is malformed.");
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  return base64UrlToBytes(body);
}
