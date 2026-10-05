import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb } from "../testHelpers";
import { signJwt } from "../testHelpers";

const agents = vi.hoisted(() => ({
  routeAgentRequest: vi.fn(),
  getAgentByName: vi.fn(),
}));
vi.mock("agents", () => agents);

import { handleChatRoute } from "./chatRoutes";

const ORIGIN = "https://o";
const call = (path: string, init: RequestInit = {}, env: any = { IS_LOCAL: "true" }) => {
  const request = new Request(`http://x${path}`, init);
  return handleChatRoute(request, env, new URL(request.url), ORIGIN);
};
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("handleChatRoute: routing", () => {
  it("returns null for unmatched paths and methods", async () => {
    expect(await call("/other")).toBeNull();
    expect(await call("/chat/sessions", { method: "DELETE" })).toBeNull();
  });
});

describe("handleChatRoute: /agents/", () => {
  it("returns 401 with CORS when unauthenticated", async () => {
    const res = (await call("/agents/chat/abc", {}, { JWT_SECRET: "s" }))!;
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("rejects access to another user's session", async () => {
    const token = await signJwt({ email: "a@b.c" }, "s");
    const res = (await call(`/agents/chat/someone_else?token=${token}`, {}, { JWT_SECRET: "s" }))!;
    expect(res.status).toBe(403);
    expect(agents.routeAgentRequest).not.toHaveBeenCalled();
  });

  it("routes own session (exact and prefixed) and adds CORS", async () => {
    const token = await signJwt({ email: "a@b.c" }, "s");
    agents.routeAgentRequest.mockResolvedValue(new Response("ok"));
    for (const name of ["a_b_c", "a_b_c--uuid"]) {
      const res = (await call(`/agents/chat/${name}?token=${token}`, {}, { JWT_SECRET: "s" }))!;
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    }
  });

  it("skips ownership check in local mode", async () => {
    agents.routeAgentRequest.mockResolvedValue(new Response("ok"));
    const res = (await call("/agents/chat/anything"))!;
    expect(res.status).toBe(200);
  });

  it("returns null when the agent router has no match", async () => {
    agents.routeAgentRequest.mockResolvedValue(null);
    expect(await call("/agents/chat/anything")).toBeNull();
  });
});

describe("handleChatRoute: GET /chat/sessions", () => {
  it("requires auth", async () => {
    expect((await call("/chat/sessions", {}, { JWT_SECRET: "s" }))!.status).toBe(401);
  });

  it("lists sessions for the user after ensuring schema", async () => {
    const { db, calls } = createFakeDb({ results: [{ id: "1", title: "t" }] });
    const res = (await call("/chat/sessions", {}, { IS_LOCAL: "true", DB: db }))!;
    expect(await res.json()).toEqual({ sessions: [{ id: "1", title: "t" }] });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(calls[0].sql).toContain("CREATE TABLE IF NOT EXISTS agent_chat_sessions");
    expect(calls[1].sql).toContain("CREATE INDEX");
    expect(calls[2].args).toEqual(["local@example.com"]);
  });

  it("returns 500 on database failure", async () => {
    const { db } = createFakeDb({ failOn: /CREATE TABLE/ });
    const res = (await call("/chat/sessions", {}, { IS_LOCAL: "true", DB: db }))!;
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db failure" });
  });
});

describe("handleChatRoute: POST /chat/sessions", () => {
  it("creates a session with the given title", async () => {
    const { db, calls } = createFakeDb();
    const res = (await call("/chat/sessions", post({ title: "Hello" }), { IS_LOCAL: "true", DB: db }))!;
    const body: any = await res.json();
    expect(body.title).toBe("Hello");
    expect(body.id).toMatch(/^local_example_com--[0-9a-f-]{36}$/);
    const insert = calls.find((c) => c.sql.startsWith("INSERT"))!;
    expect(insert.args).toEqual([body.id, "local@example.com", "Hello"]);
  });

  it("defaults the title to 'New Chat' when empty", async () => {
    const { db } = createFakeDb();
    const res = (await call("/chat/sessions", post({ title: "" }), { IS_LOCAL: "true", DB: db }))!;
    expect(((await res.json()) as any).title).toBe("New Chat");
  });

  it("returns 500 on invalid JSON body", async () => {
    const { db } = createFakeDb();
    const res = (await call("/chat/sessions", { method: "POST", body: "{" }, { IS_LOCAL: "true", DB: db }))!;
    expect(res.status).toBe(500);
  });

  it("requires auth", async () => {
    expect((await call("/chat/sessions", post({}), { JWT_SECRET: "s" }))!.status).toBe(401);
  });
});

describe("handleChatRoute: POST /chat/sessions/delete", () => {
  const env = (db: any) => ({ IS_LOCAL: "true", DB: db, OAKTREE_CHAT: {} });

  it("requires auth", async () => {
    expect((await call("/chat/sessions/delete", post({ id: "x" }), { JWT_SECRET: "s" }))!.status).toBe(401);
  });

  it("forbids deleting another user's session", async () => {
    const { db, calls } = createFakeDb();
    const res = (await call("/chat/sessions/delete", post({ id: "other--1" }), env(db)))!;
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("deletes from D1 and destroys the Durable Object", async () => {
    const { db, calls } = createFakeDb();
    const deleteSession = vi.fn().mockResolvedValue({ success: true });
    agents.getAgentByName.mockResolvedValue({ deleteSession });
    const res = (await call("/chat/sessions/delete", post({ id: "local_example_com--1" }), env(db)))!;
    expect(await res.json()).toEqual({ success: true });
    expect(calls[0].args).toEqual(["local_example_com--1", "local@example.com"]);
    expect(deleteSession).toHaveBeenCalled();
  });

  it("still succeeds when Durable Object destruction fails", async () => {
    const { db } = createFakeDb();
    agents.getAgentByName.mockRejectedValue(new Error("do down"));
    const res = (await call("/chat/sessions/delete", post({ id: "local_example_com" }), env(db)))!;
    expect(await res.json()).toEqual({ success: true });
    expect(console.error).toHaveBeenCalled();
  });

  it("returns 500 when the D1 delete fails", async () => {
    const { db } = createFakeDb({ failOn: /DELETE/ });
    const res = (await call("/chat/sessions/delete", post({ id: "local_example_com--1" }), env(db)))!;
    expect(res.status).toBe(500);
  });
});
