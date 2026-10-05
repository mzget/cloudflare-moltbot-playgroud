import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  streamText: vi.fn(),
  getPortfolio: vi.fn(),
  getWatchlist: vi.fn(),
}));

vi.mock("@cloudflare/ai-chat", () => ({
  AIChatAgent: class {
    messages: any[] = [{ id: "m" }];
    env: any = { AI: {}, chat_ai_model: "chat-model" };
    destroy = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock("agents", () => ({ callable: () => () => {} }));
vi.mock("ai", () => ({
  streamText: m.streamText,
  convertToModelMessages: async (msgs: unknown) => ({ converted: msgs }),
}));
vi.mock("workers-ai-provider", () => ({ createWorkersAI: () => (name: string) => `model:${name}` }));
vi.mock("./knowledge", () => ({ getPortfolio: m.getPortfolio, getWatchlist: m.getWatchlist }));

import { OaktreeChat } from "./chatAgent";

const toUIMessageStreamResponse = vi.fn(() => new Response("stream"));
const make = (): any => new (OaktreeChat as any)({}, {});

beforeEach(() => {
  vi.clearAllMocks();
  m.streamText.mockReturnValue({ toUIMessageStreamResponse });
  m.getPortfolio.mockResolvedValue([]);
  m.getWatchlist.mockResolvedValue([]);
});

describe("OaktreeChat", () => {
  it("deleteSession destroys the DO state", async () => {
    const chat = make();
    expect(await chat.deleteSession()).toEqual({ success: true });
    expect(chat.destroy).toHaveBeenCalled();
  });

  it("streams a response using the configured model and conversation", async () => {
    const chat = make();
    const abortSignal = new AbortController().signal;
    const onFinish = vi.fn();
    const res = await chat.onChatMessage(onFinish, { abortSignal });
    expect(await res.text()).toBe("stream");
    expect(m.streamText).toHaveBeenCalledWith(
      expect.objectContaining({ model: "model:chat-model", messages: { converted: [{ id: "m" }] }, abortSignal, onFinish })
    );
  });

  it("injects portfolio and watchlist context into the system prompt", async () => {
    m.getPortfolio.mockResolvedValue([{ symbol: "AAPL", shares: 2, secret: "x" }]);
    m.getWatchlist.mockResolvedValue([{ symbol: "MSFT", target_price: 400 }]);
    await make().onChatMessage(vi.fn());
    const { system } = m.streamText.mock.calls[0][0];
    expect(system).toContain("AAPL");
    expect(system).toContain("MSFT");
    expect(system).not.toContain("secret");
  });

  it("falls back to an empty list when a data source rejects", async () => {
    m.getPortfolio.mockRejectedValue(new Error("d1"));
    m.getWatchlist.mockResolvedValue([{ symbol: "MSFT" }]);
    await make().onChatMessage(vi.fn());
    const { system } = m.streamText.mock.calls[0][0];
    expect(system).toContain("MSFT");
    expect(system).not.toContain("Current Portfolio");
  });

  it("still answers (without context) when context loading throws synchronously", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.getPortfolio.mockImplementation(() => { throw new Error("sync"); });
    const res = await make().onChatMessage(vi.fn());
    expect(res).toBeInstanceOf(Response);
    expect(warn).toHaveBeenCalled();
    expect(m.streamText.mock.calls[0][0].system).not.toContain("Current Portfolio");
  });
});

