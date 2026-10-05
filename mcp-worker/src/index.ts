import { OaktreeMCP } from "./mcpAgent";
import { OaktreeChat } from "./chatAgent";
import { resolveAllowedOrigin, withCors } from "./http";
import { handleOAuthRoute } from "./routes/oauthRoutes";
import { handleMcpRoute, mcpFetch } from "./routes/mcpRoutes";
import { handleChatRoute } from "./routes/chatRoutes";
import { handleDatabaseChatRoute } from "./routes/databaseChatRoutes";

// Durable Object classes must be exported from the Worker entrypoint.
export { OaktreeMCP, OaktreeChat };

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // OAuth discovery + authorize/token endpoints
    const oauthResponse = await handleOAuthRoute(request, env, url);
    if (oauthResponse) return oauthResponse;

    // MCP routes: open CORS with MCP token protection
    const mcpResponse = await handleMcpRoute(request, env, ctx, url);
    if (mcpResponse) return mcpResponse;

    // Non-MCP routes: restricted CORS
    const allowedOrigin = resolveAllowedOrigin(request.headers.get("Origin"));

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-ID, x-session-id",
        },
      });
    }

    const chatResponse = await handleChatRoute(request, env, url, allowedOrigin);
    if (chatResponse) return chatResponse;

    const dbChatResponse = await handleDatabaseChatRoute(request, env, url, allowedOrigin);
    if (dbChatResponse) return dbChatResponse;

    return withCors(await mcpFetch(request, env, ctx), allowedOrigin);
  }
}
