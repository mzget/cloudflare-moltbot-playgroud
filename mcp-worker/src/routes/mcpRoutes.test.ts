import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAccessToken } from "../oauth";

const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../mcpAgent", () => ({ OaktreeMCP: { serve: vi.fn(() => ({ fetch: m.fetch })) } }));

import { handleMcpRoute } from "./mcpRoutes";

const call = (path: string, init: RequestInit = {}, env: any = {}) => {
  const request = new Request(`https://w.example${path}`, init);
  return handleMcpRoute(request, env, {} as any, new URL(request.url));
};

beforeEach(() => {
  m.fetch.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleMcpRoute", () => {
  it("returns null for non-MCP paths", async () => {
    expect(await call("/chat/sessions")).toBeNull();
  });

  it("answers OPTIONS preflight echoing the origin", async () => {
    const res = (await call("/mcp", { method: "OPTIONS", headers: { Origin: "https://c.example" } }))!;
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://c.example");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("falls back to wildcard origin on OPTIONS without Origin", async () => {
    const res = (await call("/mcp", { method: "OPTIONS" }))!;
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns a JSON-RPC 401 with WWW-Authenticate when the token is missing", async () => {
    const res = (await call("/mcp", {}, { MCP_SECRET: "s" }))!;
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("https://w.example/.well-known/oauth-protected-resource");
    expect(await res.json()).toMatchObject({ jsonrpc: "2.0", error: { code: -32000 }, id: null });
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", async () => {
    const res = (await call("/mcp", { headers: { Authorization: "Bearer nope" } }, { MCP_SECRET: "s" }))!;
    expect(res.status).toBe(401);
  });

  it("forwards to the MCP agent with a valid token and sets CORS headers", async () => {
    m.fetch.mockResolvedValue(new Response("ok"));
    const token = await createAccessToken("cid", "s");
    const res = (await call("/mcp", { headers: { Authorization: `Bearer ${token}`, Origin: "https://c.example" } }, { MCP_SECRET: "s" }))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://c.example");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("mcp-session-id");
  });

  it("skips auth when MCP_SECRET is not configured", async () => {
    m.fetch.mockResolvedValue(new Response("ok"));
    const res = (await call("/mcp/sse"))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns a JSON-RPC 500 when the agent throws", async () => {
    m.fetch.mockRejectedValue(new Error("boom"));
    const res = (await call("/mcp"))!;
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: -32603, message: "Internal error" } });
    expect(console.error).toHaveBeenCalled();
  });
});
