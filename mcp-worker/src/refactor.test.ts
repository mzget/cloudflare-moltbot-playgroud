import { describe, it, expect } from "vitest";
import { normalizeEmailSession, isOwnSession } from "./sessionId";
import { buildDataContext, buildSystemPrompt } from "./promptContext";
import { isSelectQuery, isValidTableName } from "./sqlGuards";
import { resolveAllowedOrigin, withCors, parseBodyParams, jsonResponse } from "./http";
import { verifyJwt } from "./jwtAuth";
import { signJwt } from "./testHelpers";

describe("sessionId", () => {
  it("normalizes unsafe chars and caps at 64", () => {
    expect(normalizeEmailSession("a.b@c.com")).toBe("a_b_c_com");
    expect(normalizeEmailSession("x".repeat(100))).toHaveLength(64);
  });
  it("accepts own sessions and rejects others", () => {
    expect(isOwnSession("a_b", "a_b")).toBe(true);
    expect(isOwnSession("a_b--uuid", "a_b")).toBe(true);
    expect(isOwnSession("a_bc--uuid", "a_b")).toBe(false);
    expect(isOwnSession("", "a_b")).toBe(false);
  });
});

describe("buildDataContext", () => {
  it("returns empty string for null/empty inputs", () => {
    expect(buildDataContext(null, undefined)).toBe("");
    expect(buildDataContext([], [])).toBe("");
  });
  it("includes only whitelisted portfolio fields", () => {
    const out = buildDataContext([{ symbol: "AAPL", shares: 1, secret: "x" }], []);
    expect(out).toContain("AAPL");
    expect(out).not.toContain("secret");
    expect(out).not.toContain("Watchlist");
  });
  it("includes watchlist and appends to prompt", () => {
    const ctx = buildDataContext([], [{ symbol: "MSFT", target_price: 400 }]);
    expect(ctx).toContain("MSFT");
    expect(buildSystemPrompt(ctx).endsWith(ctx)).toBe(true);
  });
});

describe("sqlGuards", () => {
  it("detects SELECT queries", () => {
    expect(isSelectQuery("  SELECT 1")).toBe(true);
    expect(isSelectQuery("DELETE FROM t")).toBe(false);
  });
  it("validates table names", () => {
    expect(isValidTableName("my_table1")).toBe(true);
    expect(isValidTableName("t; DROP TABLE x")).toBe(false);
    expect(isValidTableName("")).toBe(false);
  });
});

describe("http helpers", () => {
  it("resolves allowed origin", () => {
    expect(resolveAllowedOrigin("http://localhost:4321")).toBe("http://localhost:4321");
    expect(resolveAllowedOrigin("https://evil.com")).toBe("https://oaktree-agent-frontend.pages.dev");
    expect(resolveAllowedOrigin(null)).toBe("https://oaktree-agent-frontend.pages.dev");
  });
  it("builds JSON responses with merged headers", async () => {
    const res = jsonResponse({ a: 1 }, 201, { "X-T": "1" });
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("X-T")).toBe("1");
    expect(await res.json()).toEqual({ a: 1 });
  });
  it("sets CORS header on cloned response", () => {
    const res = withCors(new Response("x", { status: 401 }), "https://o");
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://o");
  });
  it("parses form, json, and unknown bodies", async () => {
    const form = new Request("http://x", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "a=1&b=2" });
    expect(await parseBodyParams(form)).toEqual({ a: "1", b: "2" });
    const json = new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":"1"}' });
    expect(await parseBodyParams(json)).toEqual({ a: "1" });
    expect(await parseBodyParams(new Request("http://x", { method: "POST" }))).toEqual({});
  });
});

describe("verifyJwt", () => {
  it("accepts a valid token", async () => {
    const t = await signJwt({ email: "a@b.c" }, "s");
    expect((await verifyJwt(t, "s")).email).toBe("a@b.c");
  });
  it("rejects wrong secret, malformed, and expired tokens", async () => {
    const t = await signJwt({ email: "a@b.c" }, "s");
    expect(await verifyJwt(t, "other")).toBeNull();
    expect(await verifyJwt("abc", "s")).toBeNull();
    const expired = await signJwt({ email: "a@b.c", exp: 1 }, "s");
    expect(await verifyJwt(expired, "s")).toBeNull();
  });
});
