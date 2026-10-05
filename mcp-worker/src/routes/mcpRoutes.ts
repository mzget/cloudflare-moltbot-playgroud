import { validateMcpToken } from "../auth";
import { OaktreeMCP } from "../mcpAgent";
import { jsonResponse } from "../http";

export const mcpFetch = OaktreeMCP.serve("/mcp", {
  binding: "OAKTREE_MCP",
  transport: "auto"
}).fetch;

const MCP_EXPOSE_HEADERS = "mcp-session-id, WWW-Authenticate";

const jsonRpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

/** MCP routes: open CORS with MCP token protection. Returns null when not an /mcp path. */
export async function handleMcpRoute(
  request: Request,
  env: any,
  ctx: ExecutionContext,
  url: URL
): Promise<Response | null> {
  if (!url.pathname.startsWith("/mcp")) return null;

  const baseUrl = `${url.protocol}//${url.host}`;
  const mcpOrigin = request.headers.get("Origin") || "*";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": mcpOrigin,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version, X-Session-ID, x-session-id",
        "Access-Control-Expose-Headers": MCP_EXPOSE_HEADERS,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Validate MCP Access Token BEFORE calling mcpFetch to avoid WebSocket DO hang
  const secret = env.MCP_SECRET;
  if (secret) {
    const authResult = await validateMcpToken(request, secret);
    if (!authResult.isValid) {
      return jsonResponse(
        jsonRpcError(-32000, "Unauthorized: Invalid or missing MCP access token"),
        401,
        {
          "Access-Control-Allow-Origin": mcpOrigin,
          "Access-Control-Expose-Headers": MCP_EXPOSE_HEADERS,
          "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        }
      );
    }
  }

  try {
    const response = await mcpFetch(request, env, ctx);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", mcpOrigin);
    newResponse.headers.set("Access-Control-Expose-Headers", MCP_EXPOSE_HEADERS);
    return newResponse;
  } catch (err: any) {
    console.error("mcpFetch error:", err);
    return jsonResponse(jsonRpcError(-32603, "Internal error"), 500, {
      "Access-Control-Allow-Origin": mcpOrigin,
    });
  }
}

