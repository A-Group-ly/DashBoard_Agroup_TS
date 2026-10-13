// Tests for Clerk session-token verification (no network, no database).
// Run with: npm test
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { describe, it } from "node:test";

import { authenticate, frontendApiHost } from "../worker/auth";
import type { Env } from "../worker/env";
import { HttpError } from "../worker/http";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

const env = {
  CLERK_JWT_KEY: publicPem,
  CLERK_PUBLISHABLE_KEY: "pk_test_" + Buffer.from("example.clerk.accounts.dev$").toString("base64"),
  CLERK_SECRET_KEY: "sk_test_unused",
  DATABASE_URL: "postgres://unused",
} as Env;

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

function sign(payload: Record<string, unknown>, key = privateKey): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test" }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${b64url(signer.sign(key))}`;
}

const now = () => Math.floor(Date.now() / 1000);

function request(token?: string, origin = "https://dash.example.com") {
  return new Request(`${origin}/api/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function rejects(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    assert.equal(error.status, 401);
    return true;
  });
}

describe("authenticate", () => {
  it("accepts a valid token for this site", async () => {
    const token = sign({
      sub: "user_123",
      sid: "sess_1",
      exp: now() + 60,
      iat: now(),
      azp: "https://dash.example.com",
    });
    const claims = await authenticate(request(token), env);
    assert.equal(claims.userId, "user_123");
    assert.equal(claims.sessionId, "sess_1");
  });

  it("reads the __session cookie when there is no Authorization header", async () => {
    const token = sign({ sub: "user_cookie", exp: now() + 60 });
    const req = new Request("https://dash.example.com/api/me", {
      headers: { Cookie: `theme=dark; __session=${token}` },
    });
    assert.equal((await authenticate(req, env)).userId, "user_cookie");
  });

  it("rejects a missing token", async () => {
    await rejects(authenticate(request(), env), "unauthenticated");
  });

  it("rejects an expired token", async () => {
    await rejects(authenticate(request(sign({ sub: "u", exp: now() - 120 })), env), "token_expired");
  });

  it("rejects a token signed by another key", async () => {
    await rejects(
      authenticate(request(sign({ sub: "u", exp: now() + 60 }, otherKey)), env),
      "invalid_token",
    );
  });

  it("rejects a tampered payload", async () => {
    const token = sign({ sub: "user_a", exp: now() + 60 });
    const [header, , signature] = token.split(".");
    const forged = `${header}.${b64url(JSON.stringify({ sub: "user_admin", exp: now() + 60 }))}.${signature}`;
    await rejects(authenticate(request(forged), env), "invalid_token");
  });

  it("rejects a token minted for a different site (azp)", async () => {
    const token = sign({ sub: "u", exp: now() + 60, azp: "https://evil.example" });
    await rejects(authenticate(request(token), env), "invalid_token");
  });

  it("accepts extra origins from CLERK_AUTHORIZED_PARTIES", async () => {
    const token = sign({ sub: "u", exp: now() + 60, azp: "http://localhost:5173" });
    const devEnv = { ...env, CLERK_AUTHORIZED_PARTIES: "http://localhost:5173/" };
    const claims = await authenticate(request(token, "http://localhost:8787"), devEnv);
    assert.equal(claims.userId, "u");
  });

  it("verifies with Clerk's JWKS when no PEM key is set", async () => {
    const jwk = publicKey.export({ format: "jwk" });
    const realFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: "test", alg: "RS256", use: "sig" }] }));
    }) as typeof fetch;

    try {
      const jwksEnv = { ...env, CLERK_JWT_KEY: undefined };
      const claims = await authenticate(request(sign({ sub: "user_jwks", exp: now() + 60 })), jwksEnv);
      assert.equal(claims.userId, "user_jwks");
      assert.equal(requestedUrl, "https://example.clerk.accounts.dev/.well-known/jwks.json");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("frontendApiHost", () => {
  it("decodes the Clerk frontend API host from the publishable key", () => {
    assert.equal(frontendApiHost(env.CLERK_PUBLISHABLE_KEY), "example.clerk.accounts.dev");
  });

  it("rejects a missing key", () => {
    assert.throws(() => frontendApiHost(undefined));
  });
});
