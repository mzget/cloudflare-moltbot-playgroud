export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Requested-With",
};

const FRONTEND_ORIGIN = "https://oaktree-agent-frontend.pages.dev";

/** Resolve the allowed CORS origin for non-MCP routes. */
export function resolveAllowedOrigin(origin: string | null): string {
  return origin === FRONTEND_ORIGIN || (origin && origin.startsWith("http://localhost:"))
    ? origin
    : FRONTEND_ORIGIN;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Clone a response (headers become mutable) and set the CORS origin header. */
export function withCors(response: Response, allowedOrigin: string): Response {
  const cloned = new Response(response.body, response);
  cloned.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  return cloned;
}

/** Parse a form-urlencoded or JSON request body into a flat param map. */
export async function parseBodyParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params: Record<string, string> = {};
    new URLSearchParams(await request.text()).forEach((v, k) => {
      params[k] = v;
    });
    return params;
  }
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, string>;
  }
  return {};
}

