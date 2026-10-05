import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages } from "ai";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { getPortfolio, getWatchlist } from "./knowledge";
import { buildDataContext, buildSystemPrompt } from "./promptContext";

export class OaktreeChat extends AIChatAgent<any> {
  @callable()
  async deleteSession() {
    await this.destroy();
    return { success: true };
  }

  async onChatMessage(onFinish: any, options?: any) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai(this.env.chat_ai_model);

    // Fetch portfolio and watchlist context dynamically so the model has real-time data
    let dataContext = "";
    try {
      const [holdings, watchlist] = await Promise.all([
        getPortfolio(this.env as any).catch(() => []),
        getWatchlist(this.env as any).catch(() => [])
      ]);
      dataContext = buildDataContext(holdings, watchlist);
    } catch (err) {
      console.warn("Failed to fetch context for prompt:", err);
    }

    const result = streamText({
      model,
      messages: await convertToModelMessages(this.messages),
      system: buildSystemPrompt(dataContext),
      abortSignal: options?.abortSignal,
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}

