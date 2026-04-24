#!/usr/bin/env node

/**
 * MCP Server for ClearSale — Brazilian fraud prevention.
 *
 * ClearSale (founded 2001, São Paulo) pioneered fraud analytics in Brazil.
 * Every major BR ecommerce uses ClearSale or a competitor (Konduto, Legiti).
 * The product ingests merchant orders, returns a fraud score + decision
 * (APROVADO / REPROVADO / EM_ANALISE), and closes the ML loop via status
 * updates and chargeback notifications from the merchant.
 *
 * This is the first entry in the CodeSpar `fraud` category. Future entries
 * (Konduto, Legiti, Sift, Cybersource) will follow the same shape:
 *   analyze order → get decision → post-decision feedback.
 *
 * Tools (8):
 *   send_order_for_analysis          — submit an order for risk analysis
 *   get_order_analysis               — retrieve the current decision state
 *   update_order_status              — feed the merchant's final decision back
 *   list_orders                      — list orders with filters
 *   create_chargeback_notification   — report a confirmed chargeback
 *   get_order_score                  — fraud score only (0-100)
 *   create_device_fingerprint_session— start a device fingerprint session
 *   get_device_fingerprint           — retrieve captured device characteristics
 *
 * Authentication
 *   Bearer token. ClearSale's developer portal recommends a server-side
 *   Authorization: Bearer <API_KEY> for the Guardian / fraud scoring APIs.
 *
 * Environment
 *   CLEARSALE_API_KEY   — API key / bearer token (required, secret)
 *   CLEARSALE_BASE_URL  — optional; defaults to https://api.clearsale.com.br
 *
 * Docs: https://developers.clearsale.com.br
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.CLEARSALE_API_KEY || "";
const BASE_URL = process.env.CLEARSALE_BASE_URL || "https://api.clearsale.com.br";

async function clearsaleRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ClearSale API ${res.status}: ${err}`);
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const server = new Server(
  { name: "mcp-clearsale", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_order_for_analysis",
      description: "Submit an order to ClearSale for fraud analysis. Returns a score (0-100) and a decision (APROVADO / REPROVADO / EM_ANALISE). Include as much signal as possible — billing + shipping, IP, device, items, and payment — to improve the decision.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Merchant-side order id (must be unique and stable — used to correlate future status updates and chargebacks)" },
          date: { type: "string", description: "Order creation timestamp in ISO-8601 (e.g. 2026-04-21T14:32:00Z)" },
          email: { type: "string", description: "Buyer's email address" },
          total_items: { type: "number", description: "Number of items in the order" },
          total_order: { type: "number", description: "Total order amount in BRL (major units, e.g. 199.90)" },
          ip: { type: "string", description: "Buyer's IP address at order time (IPv4 or IPv6)" },
          payment: {
            type: "array",
            description: "One or more payment methods used on this order (card, boleto, pix). Card details MUST be tokenized — never pass a raw PAN.",
            items: { type: "object" },
          },
          items: {
            type: "array",
            description: "Line items: each with sku, name, category, quantity, unit_price.",
            items: { type: "object" },
          },
          customer_billing: {
            type: "object",
            description: "Billing customer: name, document (CPF/CNPJ), birth_date, phone, and address fields (street, number, city, state, zip_code).",
          },
          customer_shipping: {
            type: "object",
            description: "Shipping customer: name, document, phone, and address fields. Same schema as customer_billing.",
          },
          session_id: { type: "string", description: "Optional device fingerprint session_id from create_device_fingerprint_session. Dramatically improves decision quality." },
        },
        required: ["id", "date", "email", "total_items", "total_order", "ip", "payment", "items", "customer_billing", "customer_shipping"],
      },
    },
    {
      name: "get_order_analysis",
      description: "Retrieve the current analysis state of an order previously sent to ClearSale. Useful when the initial response was EM_ANALISE and the decision is made asynchronously.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Merchant-side order id used in send_order_for_analysis" },
        },
        required: ["id"],
      },
    },
    {
      name: "update_order_status",
      description: "Notify ClearSale of the merchant's final decision on an order (APROVADO / CANCELADO / DEVOLVIDO). This feeds the ML model and is required for accurate future decisions on the same buyer.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Merchant-side order id" },
          status: { type: "string", enum: ["APROVADO", "CANCELADO", "DEVOLVIDO"], description: "Merchant's final decision for this order" },
          reason: { type: "string", description: "Free-text reason for the status change (recommended for CANCELADO and DEVOLVIDO)" },
        },
        required: ["id", "status"],
      },
    },
    {
      name: "list_orders",
      description: "List orders submitted to ClearSale with optional filters. Use for dashboards, reconciliation, and reviewing pending manual decisions.",
      inputSchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Inclusive lower bound, ISO-8601 date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Inclusive upper bound, ISO-8601 date (YYYY-MM-DD)" },
          status: { type: "string", description: "Filter by decision status (APROVADO, REPROVADO, EM_ANALISE)" },
          page: { type: "number", description: "Page number (starts at 1)" },
          per_page: { type: "number", description: "Page size" },
          filters: { type: "object", description: "Additional pass-through filters serialized as query params" },
        },
      },
    },
    {
      name: "create_chargeback_notification",
      description: "Report a confirmed chargeback back to ClearSale. Critical for model tuning: unreported chargebacks degrade future decision quality for similar buyers.",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Merchant-side order id the chargeback applies to" },
          chargeback_date: { type: "string", description: "Date the chargeback was confirmed (ISO-8601 date)" },
          chargeback_reason: { type: "string", description: "Issuer / acquirer reason code or free-text reason" },
          amount: { type: "number", description: "Chargeback amount in BRL (major units)" },
        },
        required: ["order_id", "chargeback_date", "chargeback_reason", "amount"],
      },
    },
    {
      name: "get_order_score",
      description: "Fetch only the fraud score (numeric 0-100) for an order. Lighter than get_order_analysis when the full decision envelope isn't needed.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Merchant-side order id" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_device_fingerprint_session",
      description: "Start a device fingerprint session. Returns a session_token the client embeds via ClearSale's browser JS SDK to capture device characteristics. Pass the same session_id into send_order_for_analysis to link the device to the order.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "Merchant-generated session id (UUID recommended). Reuse this value in send_order_for_analysis.session_id." },
          user_agent: { type: "string", description: "Browser User-Agent header observed at session start" },
          ip: { type: "string", description: "Client IP observed at session start" },
        },
        required: ["session_id", "user_agent", "ip"],
      },
    },
    {
      name: "get_device_fingerprint",
      description: "Retrieve captured device characteristics for a fingerprint session (OS, browser, timezone, canvas/WebGL hash, suspected emulator, etc).",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "session_id originally passed to create_device_fingerprint_session" },
        },
        required: ["session_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send_order_for_analysis":
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("POST", "/orders", args), null, 2) }] };
      case "get_order_analysis": {
        const id = encodeURIComponent(String((args as { id: string }).id));
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("GET", `/orders/${id}`), null, 2) }] };
      }
      case "update_order_status": {
        const a = args as { id: string; status: string; reason?: string };
        const id = encodeURIComponent(String(a.id));
        const body: Record<string, unknown> = { status: a.status };
        if (a.reason) body.reason = a.reason;
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("POST", `/orders/${id}/status`, body), null, 2) }] };
      }
      case "list_orders": {
        const a = (args ?? {}) as Record<string, unknown>;
        const params = new URLSearchParams();
        if (a.start_date) params.set("start_date", String(a.start_date));
        if (a.end_date) params.set("end_date", String(a.end_date));
        if (a.status) params.set("status", String(a.status));
        if (a.page !== undefined) params.set("page", String(a.page));
        if (a.per_page !== undefined) params.set("per_page", String(a.per_page));
        if (a.filters && typeof a.filters === "object") {
          for (const [k, v] of Object.entries(a.filters as Record<string, unknown>)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
          }
        }
        const qs = params.toString();
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("GET", `/orders${qs ? `?${qs}` : ""}`), null, 2) }] };
      }
      case "create_chargeback_notification":
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("POST", "/chargebacks", args), null, 2) }] };
      case "get_order_score": {
        const id = encodeURIComponent(String((args as { id: string }).id));
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("GET", `/orders/${id}/score`), null, 2) }] };
      }
      case "create_device_fingerprint_session":
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("POST", "/fingerprint/sessions", args), null, 2) }] };
      case "get_device_fingerprint": {
        const sid = encodeURIComponent(String((args as { session_id: string }).session_id));
        return { content: [{ type: "text", text: JSON.stringify(await clearsaleRequest("GET", `/fingerprint/sessions/${sid}`), null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

async function main() {
  if (process.argv.includes("--http") || process.env.MCP_HTTP === "true") {
    const { default: express } = await import("express");
    const { randomUUID } = await import("node:crypto");
    const app = express();
    app.use(express.json());
    const transports = new Map<string, StreamableHTTPServerTransport>();
    app.get("/health", (_req: unknown, res: { json: (body: unknown) => unknown }) => res.json({ status: "ok", sessions: transports.size }));
    app.post("/mcp", async (req: { headers: Record<string, string | string[] | undefined>; body: unknown }, res: { status: (code: number) => { json: (body: unknown) => unknown } }) => {
      const sid = req.headers["mcp-session-id"] as string | undefined;
      if (sid && transports.has(sid)) { await transports.get(sid)!.handleRequest(req as never, res as never, req.body); return; }
      if (!sid && isInitializeRequest(req.body)) {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, t); } });
        t.onclose = () => { if (t.sessionId) transports.delete(t.sessionId); };
        const s = new Server({ name: "mcp-clearsale", version: "0.1.0" }, { capabilities: { tools: {} } });
        (server as unknown as { _requestHandlers: Map<unknown, unknown> })._requestHandlers.forEach((v, k) => (s as unknown as { _requestHandlers: Map<unknown, unknown> })._requestHandlers.set(k, v));
        (server as unknown as { _notificationHandlers?: Map<unknown, unknown> })._notificationHandlers?.forEach((v, k) => (s as unknown as { _notificationHandlers: Map<unknown, unknown> })._notificationHandlers.set(k, v));
        await s.connect(t);
        await t.handleRequest(req as never, res as never, req.body); return;
      }
      res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request" }, id: null });
    });
    app.get("/mcp", async (req: { headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => { send: (body: string) => unknown } }) => { const sid = req.headers["mcp-session-id"] as string; if (sid && transports.has(sid)) await transports.get(sid)!.handleRequest(req as never, res as never); else res.status(400).send("Invalid session"); });
    app.delete("/mcp", async (req: { headers: Record<string, string | string[] | undefined> }, res: { status: (code: number) => { send: (body: string) => unknown } }) => { const sid = req.headers["mcp-session-id"] as string; if (sid && transports.has(sid)) await transports.get(sid)!.handleRequest(req as never, res as never); else res.status(400).send("Invalid session"); });
    const port = Number(process.env.MCP_PORT) || 3000;
    app.listen(port, () => { console.error(`MCP HTTP server on http://localhost:${port}/mcp`); });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch(console.error);
