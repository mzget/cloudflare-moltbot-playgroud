import { describe, it, expect } from "vitest";
import { authenticateRequest, requireAuth } from "./jwtAuth";
import { signJwt } from "./testHelpers";

const SECRET = "test-secret";
const req = (url = "http://x/p", headers: Record<string, string> = {}) => new Request(url, { headers });

describe("authenticateRequest", () => {
  it("bypasses auth when IS_LOCAL", async () => {
    expect(await authenticateRequest(req(), { IS_LOCAL: "true" })).toEqual({ email: "local@example.com" });
  });

  it("returns 401 when token is missing", async () => {
    const res = await authenticateRequest(req(), { JWT_SECRET: SECRET });
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect(await (res as Response).text()).toContain("Missing");
  });

  it("ignores non-Bearer authorization headers", async () => {
    const res = await authenticateRequest(req("http://x/p", { Authorization: "Basic abc" }), { JWT_SECRET: SECRET });
    expect((res as Response).status).toBe(401);
  });

  it("accepts a Bearer token", async () => {
    const token = await signJwt({ email: "a@b.c" }, SECRET);
    const res = await authenticateRequest(req("http://x/p", { Authorization: `Bearer ${token}` }), { JWT_SECRET: SECRET });
    expect(res).toEqual({ email: "a@b.c" });
  });

  it("accepts a token from the query string", async () => {
    const token = await signJwt({ email: "q@b.c" }, SECRET);
    const res = await authenticateRequest(req(`http://x/p?token=${token}`), { JWT_SECRET: SECRET });
    expect(res).toEqual({ email: "q@b.c" });
  });

  it("rejects invalid signature and payload without email", async () => {
    const bad = await signJwt({ email: "a@b.c" }, "other");
    expect(((await authenticateRequest(req(`http://x/p?token=${bad}`), { JWT_SECRET: SECRET })) as Response).status).toBe(401);
    const noEmail = await signJwt({ sub: "1" }, SECRET);
    expect(((await authenticateRequest(req(`http://x/p?token=${noEmail}`), { JWT_SECRET: SECRET })) as Response).status).toBe(401);
  });

  it("falls back to the dev secret when JWT_SECRET is unset", async () => {
    const token = await signJwt({ email: "d@b.c" }, "dev-secret-key-123456");
    expect(await authenticateRequest(req(`http://x/p?token=${token}`), {})).toEqual({ email: "d@b.c" });
  });
});

describe("requireAuth", () => {
  it("returns the user on success", async () => {
    expect(await requireAuth(req(), { IS_LOCAL: "true" }, "https://o")).toEqual({ email: "local@example.com" });
  });

  it("adds CORS header to the 401 response", async () => {
    const res = (await requireAuth(req(), { JWT_SECRET: SECRET }, "https://o")) as Response;
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://o");
  });
});
