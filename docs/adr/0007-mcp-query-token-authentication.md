# 0007. MCP Query Token Authentication and Open CORS for MCP Endpoints

To connect Oaktree MCP with Gemini Spark (Custom Apps) and other external AI agent environments that only accept a single URL endpoint and lack custom HTTP header configuration:
1. The MCP endpoint enforces authentication by accepting the secret access token via either the `Authorization: Bearer <token>` header or URL query parameters (`?token=<token>` or `?key=<token>`). All requests lacking a valid token matching `MCP_SECRET` are rejected with HTTP 401 Unauthorized.
2. For `/mcp*` routes, Cross-Origin Resource Sharing (CORS) is configured to permit any origin (`*` or dynamic reflection) and expose standard MCP headers (`mcp-session-id`, `mcp-protocol-version`, `Accept`, etc.), as endpoint authorization and data protection are strictly governed by the MCP Access Token.
3. Authentication employs a hybrid session-binding model: the initial handshake requires a valid MCP Access Token and marks the Durable Object session as authenticated. Subsequent requests containing an authenticated `mcp-session-id` are permitted even if the client omits query parameters, while requests with invalid tokens or unauthenticated sessions are strictly rejected.

