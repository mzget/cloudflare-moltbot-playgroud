/**
 * notebooklm-bridge/src/bridge.js
 *
 * A lightweight HTTP server that bridges the local notebooklm-mcp (stdio MCP server)
 * to a simple REST API. Expose this via Cloudflare Tunnel so the mcp-worker can reach it.
 *
 * Endpoints:
 *   POST /ask           { question: string, notebookUrl?: string } → { answer: string }
 *   GET  /health        → { status: "ok", ready: boolean }
 *   GET  /tools         → { tools: string[] }
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import http from "node:http";

const PORT = process.env.PORT || 3100;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || ""; // Optional shared secret

// ─── MCP Client Setup ───────────────────────────────────────────────────────

let mcpClient = null;
let mcpReady = false;
let availableTools = [];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connectMCP() {
  console.log("[bridge] Connecting to notebooklm-mcp...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "notebooklm-mcp@latest"],
    env: { ...process.env },
  });

  mcpClient = new Client(
    { name: "oaktree-bridge", version: "1.0.0" },
    {
      capabilities: {},
      // notebooklm-mcp boots a headless Chrome (~40s). Set a long global
      // timeout so the initialize handshake doesn't fail before Chrome is ready.
      requestTimeout: 120_000,
    }
  );

  await mcpClient.connect(transport);
  console.log("[bridge] 🔌 Transport connected. Waiting for notebooklm-mcp to initialize (Chrome startup takes ~40s)...");

  // ── Retry listTools until the server (Chrome) is fully ready ──────────────
  // notebooklm-mcp boots a headless Chrome browser which takes 30-60 seconds.
  // The default SDK timeout is ~10s, so we poll with backoff instead.
  const MAX_ATTEMPTS = 15;   // up to ~2.5 minutes total
  const RETRY_DELAY_MS = 10_000; // 10s between retries
  const LIST_TIMEOUT_MS = 20_000; // 20s per attempt

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[bridge] 🔍 Discovering tools (attempt ${attempt}/${MAX_ATTEMPTS})...`);
      const { tools } = await mcpClient.listTools({}, { timeout: LIST_TIMEOUT_MS });
      availableTools = tools.map((t) => t.name);
      mcpReady = true;
      console.log(`[bridge] ✅ Ready! ${availableTools.length} tools available: ${availableTools.join(", ")}`);
      return;
    } catch (err) {
      const remaining = MAX_ATTEMPTS - attempt;
      if (remaining === 0) throw err;
      console.log(`[bridge] ⏳ Not ready yet (${err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s... (${remaining} attempts left)`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function checkAuth(req) {
  if (!BRIDGE_SECRET) return true; // No secret set — open
  const authHeader = req.headers["authorization"] || "";
  return authHeader === `Bearer ${BRIDGE_SECRET}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" });
    res.end();
    return;
  }

  // ── GET /health ────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJSON(res, 200, { status: "ok", ready: mcpReady, tools: availableTools });
  }

  // ── GET /tools ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/tools") {
    return sendJSON(res, 200, { tools: availableTools });
  }

  // ── POST /ask ──────────────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/ask") {
    if (!checkAuth(req)) {
      return sendJSON(res, 401, { error: "Unauthorized" });
    }

    if (!mcpReady) {
      return sendJSON(res, 503, { error: "NotebookLM MCP not ready yet. Try again in a few seconds." });
    }

    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJSON(res, 400, { error: "Invalid JSON body" });
    }

    const { question, notebookUrl, notebookId } = body;
    if (!question) {
      return sendJSON(res, 400, { error: "Missing required field: question" });
    }

    console.log(`[bridge] /ask → question="${question.slice(0, 80)}..."`);

    try {
      // Call notebooklm-mcp's ask_question tool
      const toolArgs = { question };
      if (notebookUrl) toolArgs.notebook_url = notebookUrl;
      if (notebookId) toolArgs.notebook_id = notebookId;

      const result = await mcpClient.callTool({
        name: "ask_question",
        arguments: toolArgs,
      }, undefined, { timeout: 120_000 }); // 120s — browser tab takes time

      // Extract text content from the MCP response
      const content = result.content || [];
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      console.log(`[bridge] /ask ← answer length: ${text.length} chars`);
      return sendJSON(res, 200, { answer: text, question });
    } catch (err) {
      console.error("[bridge] MCP call error:", err);
      return sendJSON(res, 500, { error: err.message || "MCP tool call failed" });
    }
  }

  // ── POST /add_source ───────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/add_source") {
    if (!checkAuth(req)) return sendJSON(res, 401, { error: "Unauthorized" });
    if (!mcpReady) return sendJSON(res, 503, { error: "MCP not ready" });

    let body;
    try { body = await readBody(req); } catch { return sendJSON(res, 400, { error: "Invalid JSON" }); }

    const { type, content, notebookUrl, notebookId, title } = body;
    if (!type || !content) return sendJSON(res, 400, { error: "Missing type or content" });

    try {
      const toolArgs = { type, content };
      if (notebookUrl) toolArgs.notebook_url = notebookUrl;
      if (notebookId) toolArgs.notebook_id = notebookId;
      if (title) toolArgs.title = title;

      const result = await mcpClient.callTool({ name: "add_source", arguments: toolArgs });
      const text = (result.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
      return sendJSON(res, 200, { result: text });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 404 fallback
  sendJSON(res, 404, { error: "Not found", availableEndpoints: ["/health", "/tools", "/ask", "/add_source"] });
});

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[bridge] 🚀 HTTP bridge running on http://localhost:${PORT}`);
  console.log(`[bridge] Endpoints: GET /health | GET /tools | POST /ask | POST /add_source`);
  if (BRIDGE_SECRET) {
    console.log(`[bridge] 🔒 Auth enabled (BRIDGE_SECRET is set)`);
  } else {
    console.log(`[bridge] ⚠️  No BRIDGE_SECRET set — bridge is open. Set env var BRIDGE_SECRET for security.`);
  }
});

// Spawn MCP connection (async — server starts first, then MCP connects)
connectMCP().catch((err) => {
  console.error("[bridge] ❌ Failed to connect to notebooklm-mcp:", err.message);
  console.error("[bridge] Make sure 'npx notebooklm-mcp@latest' can run in your environment.");
});
