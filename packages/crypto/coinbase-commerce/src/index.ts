#!/usr/bin/env node

/**
 * MCP Server for Coinbase Commerce — global crypto merchant payments.
 *
 * Coinbase Commerce is the merchant-accept side of crypto: a store creates a
 * charge (or hosted checkout / invoice) priced in local fiat, the buyer pays
 * in BTC / ETH / USDC / etc., and Coinbase settles to the merchant in the
 * chosen crypto or fiat. This complements rather than overlaps the rest of
 * the CodeSpar crypto catalog:
 *   - UnblockPay   — BRL/MXN <-> USDC corridor for agents moving value
 *   - MoonPay      — end-user fiat <-> crypto on/off-ramp (100+ assets)
 *   - Transak      — end-user on/off-ramp (broad geo)
 *   - Coinbase     — merchants ACCEPT crypto from buyers at checkout
 *                    Commerce    (this package)
 *
 * Tools (9):
 *   create_charge      — create a crypto charge (merchant invoice)
 *   retrieve_charge    — look up a charge by id or short code
 *   list_charges       — list charges (paginated)
 *   cancel_charge      — cancel a no-longer-needed charge (before payment)
 *   resolve_charge     — manually mark a charge as paid
 *   create_checkout    — create a reusable hosted checkout (product page)
 *   retrieve_checkout  — look up a checkout by id
 *   list_events        — list webhook-like events (charge:* lifecycle)
 *   create_invoice     — create an invoice for a known recipient
 *
 * Authentication
 *   Every request carries two headers:
 *     X-CC-Api-Key: <COINBASE_COMMERCE_API_KEY>
 *     X-CC-Version: 2018-03-22   (version header is required)
 *
 * Environment
 *   COINBASE_COMMERCE_API_KEY      — API key (required, secret)
 *   COINBASE_COMMERCE_API_VERSION  — optional; defaults to 2018-03-22
 *
 * Docs: https://docs.cdp.coinbase.com/commerce  (base: https://api.commerce.coinbase.com)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.COINBASE_COMMERCE_API_KEY || "";
const API_VERSION = process.env.COINBASE_COMMERCE_API_VERSION || "2018-03-22";
const BASE_URL = "https://api.commerce.coinbase.com";

async function coinbaseRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": API_KEY,
      "X-CC-Version": API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coinbase Commerce API ${res.status}: ${err}`);
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  for (const [k, v] of entries) search.set(k, String(v));
  return `?${search.toString()}`;
}

const server = new Server(
  { name: "mcp-coinbase-commerce", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_charge",
      description: "Create a crypto charge — a one-time merchant invoice priced in local fiat that a buyer can settle in BTC, ETH, USDC, and other supported assets. Returns a hosted_url the buyer can be redirected to, plus per-asset payment addresses.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short product/order name shown on the hosted payment page" },
          description: { type: "string", description: "Longer human-readable description of what the buyer is paying for" },
          pricing_type: { type: "string", enum: ["fixed_price", "no_price"], description: "fixed_price: exact amount in local_price. no_price: buyer chooses (donations)." },
          local_price: {
            type: "object",
            description: "Fiat-denominated price the charge is quoted in. Required when pricing_type is fixed_price.",
            properties: {
              amount: { type: "string", description: "Amount as a decimal string (e.g. \"29.90\")" },
              currency: { type: "string", description: "ISO-4217 fiat currency code (e.g. USD, BRL, EUR, MXN)" },
            },
            required: ["amount", "currency"],
          },
          metadata: { type: "object", description: "Arbitrary JSON you want echoed back on events (customer_id, order_id, etc.)" },
          redirect_url: { type: "string", description: "Browser redirect after a successful payment" },
          cancel_url: { type: "string", description: "Browser redirect if the buyer abandons the hosted page" },
        },
        required: ["name", "description", "pricing_type"],
      },
    },
    {
      name: "retrieve_charge",
      description: "Retrieve a charge by its Coinbase Commerce id OR its short code (the 8-character code embedded in the hosted URL). Returns current status, timeline, and payments.",
      inputSchema: {
        type: "object",
        properties: {
          code_or_id: { type: "string", description: "Charge id or short code" },
        },
        required: ["code_or_id"],
      },
    },
    {
      name: "list_charges",
      description: "List charges, newest first. Supports cursor pagination via starting_after / ending_before.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results per page (default 25, max 100)" },
          starting_after: { type: "string", description: "Cursor: return results after this charge id" },
          ending_before: { type: "string", description: "Cursor: return results before this charge id" },
          order: { type: "string", enum: ["asc", "desc"], description: "Sort order by created_at. Defaults to desc." },
        },
      },
    },
    {
      name: "cancel_charge",
      description: "Cancel a charge that has not yet been paid. Only charges in NEW status can be cancelled; once pending or completed the call will fail.",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Charge short code" },
        },
        required: ["code"],
      },
    },
    {
      name: "resolve_charge",
      description: "Manually resolve a charge as paid. Used for out-of-band settlement (e.g. underpayment you accept, delayed confirmation you want to honour).",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Charge short code" },
        },
        required: ["code"],
      },
    },
    {
      name: "create_checkout",
      description: "Create a reusable hosted checkout — think product-page-style link that can be paid multiple times. Good for evergreen SKUs and donation pages.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Product / checkout name" },
          description: { type: "string", description: "Longer description shown to buyers" },
          pricing_type: { type: "string", enum: ["fixed_price", "no_price"], description: "fixed_price: exact amount in local_price. no_price: buyer chooses." },
          local_price: {
            type: "object",
            description: "Fiat-denominated price. Required when pricing_type is fixed_price.",
            properties: {
              amount: { type: "string", description: "Amount as decimal string" },
              currency: { type: "string", description: "ISO-4217 fiat currency code" },
            },
            required: ["amount", "currency"],
          },
          requested_info: {
            type: "array",
            description: "Buyer fields Coinbase should collect on the hosted page (e.g. [\"name\", \"email\"])",
            items: { type: "string" },
          },
        },
        required: ["name", "description", "pricing_type"],
      },
    },
    {
      name: "retrieve_checkout",
      description: "Retrieve a checkout by id.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Checkout id" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_events",
      description: "List events — the lifecycle signals (charge:created, charge:confirmed, charge:failed, charge:delayed, charge:pending, charge:resolved) that Coinbase Commerce also delivers via webhook. Useful for reconciliation and agent polling.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results per page (default 25, max 100)" },
          starting_after: { type: "string", description: "Cursor: return results after this event id" },
          ending_before: { type: "string", description: "Cursor: return results before this event id" },
          order: { type: "string", enum: ["asc", "desc"], description: "Sort order by created_at. Defaults to desc." },
        },
      },
    },
    {
      name: "create_invoice",
      description: "Create an invoice — a directed bill sent to a specific named recipient. Unlike a charge, an invoice captures who it was issued to and has its own draft / viewed / paid lifecycle.",
      inputSchema: {
        type: "object",
        properties: {
          business_name: { type: "string", description: "Your business name shown on the invoice" },
          customer_email: { type: "string", description: "Email of the invoice recipient" },
          customer_name: { type: "string", description: "Display name of the invoice recipient" },
          memo: { type: "string", description: "Free-form note to the recipient (appears on invoice)" },
          local_price: {
            type: "object",
            description: "Fiat-denominated amount the invoice is quoted in",
            properties: {
              amount: { type: "string", description: "Amount as decimal string" },
              currency: { type: "string", description: "ISO-4217 fiat currency code" },
            },
            required: ["amount", "currency"],
          },
        },
        required: ["business_name", "customer_email", "customer_name", "local_price"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "create_charge":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("POST", "/charges", a), null, 2) }] };
      case "retrieve_charge":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("GET", `/charges/${encodeURIComponent(String(a.code_or_id ?? ""))}`), null, 2) }] };
      case "list_charges": {
        const query = qs({
          limit: a.limit,
          starting_after: a.starting_after,
          ending_before: a.ending_before,
          order: a.order,
        });
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("GET", `/charges${query}`), null, 2) }] };
      }
      case "cancel_charge":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("POST", `/charges/${encodeURIComponent(String(a.code ?? ""))}/cancel`), null, 2) }] };
      case "resolve_charge":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("POST", `/charges/${encodeURIComponent(String(a.code ?? ""))}/resolve`), null, 2) }] };
      case "create_checkout":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("POST", "/checkouts", a), null, 2) }] };
      case "retrieve_checkout":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("GET", `/checkouts/${encodeURIComponent(String(a.id ?? ""))}`), null, 2) }] };
      case "list_events": {
        const query = qs({
          limit: a.limit,
          starting_after: a.starting_after,
          ending_before: a.ending_before,
          order: a.order,
        });
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("GET", `/events${query}`), null, 2) }] };
      }
      case "create_invoice":
        return { content: [{ type: "text", text: JSON.stringify(await coinbaseRequest("POST", "/invoices", a), null, 2) }] };
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
        const s = new Server({ name: "mcp-coinbase-commerce", version: "0.1.0" }, { capabilities: { tools: {} } });
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
