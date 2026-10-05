import { describe, it, expect } from "vitest";
import { handleOAuthRoute } from "./oauthRoutes";
import { createAuthCode, createAccessToken, verifyAccessToken, computeSha256Base64Url } from "../oauth";

const env = { OAUTH_CLIENT_ID: "cid", OAUTH_CLIENT_SECRET: "sec" };
const REDIRECT = "http://localhost:3000/cb";

const call = (path: string, init: RequestInit = {}, e: any = env) => {
  const request = new Request(`https://w.example${path}`, init);
  return handleOAuthRoute(request, e, new URL(request.url));
};
const form = (params: Record<string, string>, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
  body: new URLSearchParams(params).toString(),
});

describe("handleOAuthRoute: routing & metadata", () => {
  it("returns null for non-OAuth paths", async () => {
    expect(await call("/mcp")).toBeNull();
  });

  it.each(["/.well-known/oauth-protected-resource", "/.well-known/oauth-authorization-server"])(
    "serves %s with CORS and handles OPTIONS",
    async (path) => {
      const res = (await call(path))!;
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(JSON.stringify(await res.json())).toContain("https://w.example");
      const opt = (await call(path, { method: "OPTIONS" }))!;
      expect(opt.status).toBe(200);
      expect(await opt.text()).toBe("");
    }
  );
});

describe("handleOAuthRoute: /oauth/authorize", () => {
  const q = (o: Record<string, string>) => `/oauth/authorize?${new URLSearchParams(o)}`;

  it("handles OPTIONS", async () => {
    expect((await call("/oauth/authorize", { method: "OPTIONS" }))!.status).toBe(200);
  });

  it("GET rejects wrong client_id and bad redirect_uri", async () => {
    const r1 = (await call(q({ client_id: "bad", redirect_uri: REDIRECT })))!;
    expect(r1.status).toBe(400);
    expect(await r1.text()).toContain("Invalid client_id");
    const r2 = (await call(q({ client_id: "cid", redirect_uri: "https://evil.com/cb" })))!;
    expect(r2.status).toBe(400);
    expect(await r2.text()).toContain("Invalid redirect_uri");
  });

  it("GET renders the authorize HTML", async () => {
    const res = (await call(q({ client_id: "cid", redirect_uri: REDIRECT, state: "st" })))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("<html");
  });

  it("GET uses the default client id when env has none", async () => {
    const res = (await call(q({ client_id: "oaktree-gemini", redirect_uri: REDIRECT }), {}, {}))!;
    expect(res.status).toBe(200);
  });

  it("POST (form) redirects with code and state", async () => {
    const res = (await call("/oauth/authorize", form({ client_id: "cid", redirect_uri: REDIRECT, state: "st" })))!;
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location")!);
    expect(loc.searchParams.get("code")).toBeTruthy();
    expect(loc.searchParams.get("state")).toBe("st");
  });

  it("POST (json) falling back to query params, omitting empty state", async () => {
    const res = (await call(
      `/oauth/authorize?client_id=cid&redirect_uri=${encodeURIComponent(REDIRECT)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    ))!;
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("Location")!).searchParams.has("state")).toBe(false);
  });

  it("POST rejects invalid client and redirect", async () => {
    expect((await call("/oauth/authorize", form({ client_id: "x", redirect_uri: REDIRECT })))!.status).toBe(400);
    expect((await call("/oauth/authorize", form({ client_id: "cid", redirect_uri: "https://evil.com" })))!.status).toBe(400);
  });

  it("returns null for unsupported methods", async () => {
    expect(await call("/oauth/authorize", { method: "PUT" })).toBeNull();
  });
});

describe("handleOAuthRoute: /oauth/token", () => {
  const code = (extra: object = {}) =>
    createAuthCode({ clientId: "cid", redirectUri: REDIRECT, ...extra } as any, "sec");
  const tokenReq = (params: Record<string, string>) =>
    call("/oauth/token", form({ client_id: "cid", client_secret: "sec", ...params }));
  const errorOf = async (res: Response | null) => ((await res!.json()) as any).error;

  it("handles OPTIONS and rejects non-POST", async () => {
    expect((await call("/oauth/token", { method: "OPTIONS" }))!.status).toBe(200);
    expect((await call("/oauth/token"))!.status).toBe(405);
  });

  it("rejects missing or wrong credentials", async () => {
    const none = await call("/oauth/token", form({ grant_type: "authorization_code" }));
    expect(none!.status).toBe(401);
    expect(await errorOf(none)).toBe("invalid_client");
    const wrong = await call("/oauth/token", form({ client_id: "cid", client_secret: "nope" }));
    expect(wrong!.status).toBe(401);
  });

  it("accepts Basic auth credentials", async () => {
    const res = await call(
      "/oauth/token",
      form({ grant_type: "authorization_code", code: await code(), redirect_uri: REDIRECT }, { Authorization: `Basic ${btoa("cid:sec")}` })
    );
    expect(res!.status).toBe(200);
  });

  it("rejects unsupported grant types and missing code", async () => {
    const g = await tokenReq({ grant_type: "password" });
    expect(g!.status).toBe(400);
    expect(await errorOf(g)).toBe("unsupported_grant_type");
    const m = await tokenReq({ grant_type: "authorization_code" });
    expect(await errorOf(m)).toBe("invalid_request");
  });

  it("rejects invalid codes and codes issued for another client", async () => {
    const bad = await tokenReq({ grant_type: "authorization_code", code: "garbage" });
    expect(await errorOf(bad)).toBe("invalid_grant");
    const other = await createAuthCode({ clientId: "someone", redirectUri: REDIRECT } as any, "sec");
    expect(await errorOf(await tokenReq({ grant_type: "authorization_code", code: other }))).toBe("invalid_grant");
  });

  it("rejects redirect_uri mismatch", async () => {
    const res = await tokenReq({ grant_type: "authorization_code", code: await code(), redirect_uri: "http://localhost:1/other" });
    expect(await errorOf(res)).toBe("invalid_grant");
  });

  it("enforces PKCE verifier presence and correctness", async () => {
    const challenge = await computeSha256Base64Url("verifier");
    const c = await code({ codeChallenge: challenge, codeChallengeMethod: "S256" });
    const missing = await tokenReq({ grant_type: "authorization_code", code: c });
    expect(await errorOf(missing)).toBe("invalid_request");
    const wrong = await tokenReq({ grant_type: "authorization_code", code: c, code_verifier: "nope" });
    expect(await errorOf(wrong)).toBe("invalid_grant");
  });

  it("issues a valid access token (with and without PKCE)", async () => {
    const challenge = await computeSha256Base64Url("verifier");
    const pkce = await tokenReq({
      grant_type: "authorization_code",
      code: await code({ codeChallenge: challenge, codeChallengeMethod: "S256" }),
      code_verifier: "verifier",
    });
    const plain = await tokenReq({ grant_type: "authorization_code", code: await code() });
    for (const res of [pkce, plain]) {
      expect(res!.status).toBe(200);
      const body: any = await res!.json();
      expect(body).toMatchObject({ token_type: "Bearer", expires_in: 2592000, scope: "mcp" });
      expect(await verifyAccessToken(body.access_token, "sec")).toBeTruthy();
    }
  });

  it("falls back to MCP_SECRET when OAUTH_CLIENT_SECRET is unset", async () => {
    const e = { OAUTH_CLIENT_ID: "cid", MCP_SECRET: "mcp" };
    const res = await call("/oauth/token", form({ grant_type: "authorization_code", client_id: "cid", client_secret: "mcp", code: await createAuthCode({ clientId: "cid", redirectUri: REDIRECT } as any, "mcp") }), e);
    expect(res!.status).toBe(200);
    expect(await createAccessToken("cid", "mcp")).toBeTruthy();
  });
});
