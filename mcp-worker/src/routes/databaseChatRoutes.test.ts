import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  streamText: vi.fn(),
  createDbTools: vi.fn(() => ({ fake: "tools" })),
}));
vi.mock("ai", () => ({
  streamText: m.streamText,
  convertToModelMessages: async (msgs: unknown) => ({ converted: msgs }),
}));
vi.mock("workers-ai-provider", () => ({ createWorkersAI: () => (name: string) => `model:${name}` }));
vi.mock("../dbTools", () => ({ createDbTools: m.createDbTools }));

import { handleDatabaseChatRoute } from "./databaseChatRoutes";

const ORIGIN = "https://o";
const call = (path: string, init: RequestInit = {}, env: any = { IS_LOCAL: "true" }) => {
  const request = new Request(`http://x${path}`, init);
  return handleDatabaseChatRoute(request, env, new URL(request.url), ORIGIN);
};

beforeEach(() => vi.clearAllMocks());

describe("handleDatabaseChatRoute", () => {
  it("returns null for unmatched routes", async () => {
    expect(await call("/other")).toBeNull();
    expect(await call("/database-chat")).toBeNull(); // GET on chat endpoint
    expect(await call("/database-chat/status", { method: "POST" })).toBeNull();
  });

  describe("GET /database-chat/status", () => {
    it("requires auth", async () => {
      const res = (await call("/database-chat/status", {}, { JWT_SECRET: "s" }))!;
      expect(res.status).toBe(401);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    });

    it.each([["true", true], ["false", false], [undefined, false]])(
      "reports enabled for ENABLE_DATABASE_AGENT=%s",
      async (flag, expected) => {
        const res = (await call("/database-chat/status", {}, { IS_LOCAL: "true", ENABLE_DATABASE_AGENT: flag }))!;
        expect(await res.json()).toEqual({ enabled: expected });
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
      }
    );
  });

  describe("POST /database-chat", () => {
    const post = (env: any) =>
      call("/database-chat", { method: "POST", body: JSON.stringify({ messages: [{ id: "1" }] }) }, env);

    it("requires auth", async () => {
      expect((await post({ JWT_SECRET: "s" }))!.status).toBe(401);
    });

    it("returns 403 when the database agent is disabled", async () => {
      const res = (await post({ IS_LOCAL: "true" }))!;
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("disabled");
      expect(m.streamText).not.toHaveBeenCalled();
    });

    it("streams with db tools, model and CORS headers when enabled", async () => {
      const toUIMessageStreamResponse = vi.fn(() => new Response("stream"));
      m.streamText.mockReturnValue({ toUIMessageStreamResponse });
      const res = (await post({ IS_LOCAL: "true", ENABLE_DATABASE_AGENT: "true", AI: {}, db_ai_model: "m1" }))!;
      expect(await res.text()).toBe("stream");
      const args = m.streamText.mock.calls[0][0];
      expect(args).toMatchObject({
        model: "model:m1",
        messages: { converted: [{ id: "1" }] },
        tools: { fake: "tools" },
        maxSteps: 5,
      });
      expect(args.system).toContain("Cloudflare DB Agent");
      expect(toUIMessageStreamResponse).toHaveBeenCalledWith({ headers: { "Access-Control-Allow-Origin": ORIGIN } });
    });
  });
});
