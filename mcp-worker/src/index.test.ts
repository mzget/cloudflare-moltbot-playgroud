import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  oauth: vi.fn(),
  mcp: vi.fn(),
  chat: vi.fn(),
  dbChat: vi.fn(),
  mcpFetch: vi.fn(),
}));

vi.mock("./mcpAgent", () => ({ OaktreeMCP: class OaktreeMCP {} }));
vi.mock("./chatAgent", () => ({ OaktreeChat: class OaktreeChat {} }));
vi.mock("./routes/oauthRoutes", () => ({ handleOAuthRoute: m.oauth }));
vi.mock("./routes/mcpRoutes", () => ({ handleMcpRoute: m.mcp, mcpFetch: m.mcpFetch }));
vi.mock("./routes/chatRoutes", () => ({ handleChatRoute: m.chat }));
vi.mock("./routes/databaseChatRoutes", () => ({ handleDatabaseChatRoute: m.dbChat }));

import worker, { OaktreeMCP, OaktreeChat } from "./index";

const FRONTEND = "https://oaktree-agent-frontend.pages.dev";
const fetchWith = (path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://w.example${path}`, init), {}, {} as any);

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of [m.oauth, m.mcp, m.chat, m.dbChat]) fn.mockResolvedValue(null);
  m.mcpFetch.mockResolvedValue(new Response("fallback"));
});

describe("worker entrypoint", () => {
  it("exports the Durable Object classes", () => {
    expect(OaktreeMCP.name).toBe("OaktreeMCP");
    expect(OaktreeChat.name).toBe("OaktreeChat");
  });

  it("short-circuits on an OAuth response", async () => {
    m.oauth.mockResolvedValue(new Response("oauth"));
    expect(await (await fetchWith("/oauth/token")).text()).toBe("oauth");
    expect(m.mcp).not.toHaveBeenCalled();
  });

  it("short-circuits on an MCP response", async () => {
    m.mcp.mockResolvedValue(new Response("mcp"));
    expect(await (await fetchWith("/mcp")).text()).toBe("mcp");
    expect(m.chat).not.toHaveBeenCalled();
  });

  it("answers non-MCP preflight with the resolved origin", async () => {
    const res = await fetchWith("/chat/sessions", { method: "OPTIONS", headers: { Origin: "http://localhost:4321" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:4321");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Session-ID");
    expect(m.chat).not.toHaveBeenCalled();
  });

  it("defaults the preflight origin to the frontend for unknown origins", async () => {
    const res = await fetchWith("/x", { method: "OPTIONS", headers: { Origin: "https://evil.com" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(FRONTEND);
  });

  it("delegates to chat routes, passing the allowed origin", async () => {
    m.chat.mockResolvedValue(new Response("chat"));
    expect(await (await fetchWith("/chat/sessions")).text()).toBe("chat");
    expect(m.chat.mock.calls[0][3]).toBe(FRONTEND);
    expect(m.dbChat).not.toHaveBeenCalled();
  });

  it("delegates to database chat routes", async () => {
    m.dbChat.mockResolvedValue(new Response("db"));
    expect(await (await fetchWith("/database-chat/status")).text()).toBe("db");
    expect(m.mcpFetch).not.toHaveBeenCalled();
  });

  it("falls back to the MCP fetch handler with CORS applied", async () => {
    const res = await fetchWith("/unknown");
    expect(await res.text()).toBe("fallback");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(FRONTEND);
  });
});
