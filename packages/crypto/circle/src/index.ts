#!/usr/bin/env node

/**
 * MCP Server for Circle — USDC stablecoin infrastructure.
 *
 * Tools:
 * - create_wallet: Create a new Circle wallet
 * - get_wallet: Get wallet details by ID
 * - create_payment: Accept a USDC payment
 * - get_payment: Get payment details by ID
 * - create_payout: Create a payout (USDC to fiat)
 * - get_payout: Get payout details by ID
 * - create_transfer: Create a USDC transfer between wallets
 * - get_transfer: Get transfer details by ID
 * - get_balance: Get wallet balance
 * - list_transactions: List transactions with filters
 *
 * Environment:
 *   CIRCLE_API_KEY — API key from https://www.circle.com/
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.CIRCLE_API_KEY || "";
const BASE_URL = "https://api.circle.com/v1";

async function circleRequest(method: string, path: string, body?: unknown): Promise<unknown> {
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
    throw new Error(`Circle API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-circle", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_wallet",
      description: "Create a new Circle wallet",
      inputSchema: {
        type: "object",
        properties: {
          idempotencyKey: { type: "string", description: "Unique idempotency key (UUID)" },
          description: { type: "string", description: "Wallet description" },
        },
        required: ["idempotencyKey"],
      },
    },
    {
      name: "get_wallet",
      description: "Get wallet details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Wallet ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_payment",
      description: "Accept a USDC payment via Circle",
      inputSchema: {
        type: "object",
        properties: {
          idempotencyKey: { type: "string", description: "Unique idempotency key (UUID)" },
          amount: { type: "object", properties: { amount: { type: "string", description: "Amount (e.g. '10.00')" }, currency: { type: "string", description: "Currency (USD)" } }, required: ["amount", "currency"], description: "Payment amount" },
          source: { type: "object", properties: { id: { type: "string", description: "Source ID" }, type: { type: "string", description: "Source type (e.g. card, ach)" } }, required: ["id", "type"], description: "Payment source" },
          description: { type: "string", description: "Payment description" },
        },
        required: ["idempotencyKey", "amount", "source"],
      },
    },
    {
      name: "get_payment",
      description: "Get payment details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payment ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_payout",
      description: "Create a payout from Circle (USDC to fiat)",
      inputSchema: {
        type: "object",
        properties: {
          idempotencyKey: { type: "string", description: "Unique idempotency key (UUID)" },
          amount: { type: "object", properties: { amount: { type: "string", description: "Amount" }, currency: { type: "string", description: "Currency (USD)" } }, required: ["amount", "currency"], description: "Payout amount" },
          destination: { type: "object", properties: { id: { type: "string", description: "Destination ID (bank account)" }, type: { type: "string", description: "Destination type (e.g. wire)" } }, required: ["id", "type"], description: "Payout destination" },
        },
        required: ["idempotencyKey", "amount", "destination"],
      },
    },
    {
      name: "get_payout",
      description: "Get payout details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payout ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_transfer",
      description: "Create a USDC transfer between Circle wallets",
      inputSchema: {
        type: "object",
        properties: {
          idempotencyKey: { type: "string", description: "Unique idempotency key (UUID)" },
          amount: { type: "object", properties: { amount: { type: "string", description: "Amount" }, currency: { type: "string", description: "Currency (USD)" } }, required: ["amount", "currency"], description: "Transfer amount" },
          source: { type: "object", properties: { id: { type: "string", description: "Source wallet ID" }, type: { type: "string", description: "Source type (wallet)" } }, required: ["id", "type"], description: "Transfer source" },
          destination: { type: "object", properties: { id: { type: "string", description: "Destination wallet ID" }, type: { type: "string", description: "Destination type (wallet, blockchain)" } }, required: ["id", "type"], description: "Transfer destination" },
        },
        required: ["idempotencyKey", "amount", "source", "destination"],
      },
    },
    {
      name: "get_transfer",
      description: "Get transfer details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Transfer ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_balance",
      description: "Get account balance",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_transactions",
      description: "List transactions with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["payment", "payout", "transfer"], description: "Filter by transaction type" },
          status: { type: "string", enum: ["pending", "confirmed", "complete", "failed"], description: "Filter by status" },
          from: { type: "string", description: "Start date (ISO 8601)" },
          to: { type: "string", description: "End date (ISO 8601)" },
          pageSize: { type: "number", description: "Number of results per page" },
          pageBefore: { type: "string", description: "Cursor for previous page" },
          pageAfter: { type: "string", description: "Cursor for next page" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_wallet":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("POST", "/wallets", args), null, 2) }] };
      case "get_wallet":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", `/wallets/${args?.id}`), null, 2) }] };
      case "create_payment":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("POST", "/payments", args), null, 2) }] };
      case "get_payment":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", `/payments/${args?.id}`), null, 2) }] };
      case "create_payout":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("POST", "/payouts", args), null, 2) }] };
      case "get_payout":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", `/payouts/${args?.id}`), null, 2) }] };
      case "create_transfer":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("POST", "/transfers", args), null, 2) }] };
      case "get_transfer":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", `/transfers/${args?.id}`), null, 2) }] };
      case "get_balance":
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", "/balances"), null, 2) }] };
      case "list_transactions": {
        const params = new URLSearchParams();
        if (args?.type) params.set("type", String(args.type));
        if (args?.status) params.set("status", String(args.status));
        if (args?.from) params.set("from", String(args.from));
        if (args?.to) params.set("to", String(args.to));
        if (args?.pageSize) params.set("pageSize", String(args.pageSize));
        if (args?.pageBefore) params.set("pageBefore", String(args.pageBefore));
        if (args?.pageAfter) params.set("pageAfter", String(args.pageAfter));
        return { content: [{ type: "text", text: JSON.stringify(await circleRequest("GET", `/transactions?${params}`), null, 2) }] };
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
    app.get("/health", (_req: any, res: any) => res.json({ status: "ok", sessions: transports.size }));
    app.post("/mcp", async (req: any, res: any) => {
      const sid = req.headers["mcp-session-id"] as string | undefined;
      if (sid && transports.has(sid)) { await transports.get(sid)!.handleRequest(req, res, req.body); return; }
      if (!sid && isInitializeRequest(req.body)) {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, t); } });
        t.onclose = () => { if (t.sessionId) transports.delete(t.sessionId); };
        const s = new Server({ name: "mcp-circle", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
        await t.handleRequest(req, res, req.body); return;
      }
      res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request" }, id: null });
    });
    app.get("/mcp", async (req: any, res: any) => { const sid = req.headers["mcp-session-id"] as string; if (sid && transports.has(sid)) await transports.get(sid)!.handleRequest(req, res); else res.status(400).send("Invalid session"); });
    app.delete("/mcp", async (req: any, res: any) => { const sid = req.headers["mcp-session-id"] as string; if (sid && transports.has(sid)) await transports.get(sid)!.handleRequest(req, res); else res.status(400).send("Invalid session"); });
    const port = Number(process.env.MCP_PORT) || 3000;
    app.listen(port, () => { console.error(`MCP HTTP server on http://localhost:${port}/mcp`); });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch(console.error);
