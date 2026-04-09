#!/usr/bin/env node

/**
 * MCP Server for EBANX — cross-border payment platform for Latin America.
 *
 * Tools:
 * - create_payment: Create a payment (boleto, credit card, PIX, etc.)
 * - get_payment: Get payment details by hash
 * - list_payments: List payments with filters
 * - refund: Refund a payment
 * - create_payout: Create a payout to a bank account
 * - exchange_rate: Get current exchange rate
 * - get_banks: List available banks for a country
 *
 * Environment:
 *   EBANX_INTEGRATION_KEY — Integration key from https://dashboard.ebanx.com/
 *   EBANX_SANDBOX — "true" to use sandbox (default: false)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const INTEGRATION_KEY = process.env.EBANX_INTEGRATION_KEY || "";
const BASE_URL = process.env.EBANX_SANDBOX === "true"
  ? "https://sandbox.ebanx.com/ws"
  : "https://api.ebanx.com/ws";

async function ebanxRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const payload = method === "POST"
    ? { integration_key: INTEGRATION_KEY, ...(body as Record<string, unknown> || {}) }
    : undefined;

  const url = method === "GET" && body
    ? `${BASE_URL}${path}?${new URLSearchParams({ integration_key: INTEGRATION_KEY, ...(body as Record<string, string>) })}`
    : method === "GET"
      ? `${BASE_URL}${path}?${new URLSearchParams({ integration_key: INTEGRATION_KEY })}`
      : `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`EBANX API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-ebanx", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_payment",
      description: "Create a payment in EBANX (boleto, credit card, PIX, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name" },
          email: { type: "string", description: "Customer email" },
          country: { type: "string", description: "Country code (e.g. BR)" },
          payment_type_code: { type: "string", enum: ["boleto", "creditcard", "pix", "debitcard"], description: "Payment type" },
          merchant_payment_code: { type: "string", description: "Unique merchant payment code" },
          currency_code: { type: "string", description: "Currency (e.g. BRL, USD)" },
          amount_total: { type: "number", description: "Total amount" },
          document: { type: "string", description: "CPF or CNPJ" },
        },
        required: ["name", "email", "country", "payment_type_code", "merchant_payment_code", "currency_code", "amount_total", "document"],
      },
    },
    {
      name: "get_payment",
      description: "Get payment details by hash",
      inputSchema: {
        type: "object",
        properties: {
          hash: { type: "string", description: "Payment hash returned on creation" },
        },
        required: ["hash"],
      },
    },
    {
      name: "list_payments",
      description: "List payments by date range",
      inputSchema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "number", description: "Page number" },
        },
        required: ["date_from", "date_to"],
      },
    },
    {
      name: "refund",
      description: "Refund a payment (full or partial)",
      inputSchema: {
        type: "object",
        properties: {
          hash: { type: "string", description: "Payment hash" },
          amount: { type: "number", description: "Amount to refund (omit for full)" },
          description: { type: "string", description: "Refund reason" },
        },
        required: ["hash"],
      },
    },
    {
      name: "create_payout",
      description: "Create a payout to a bank account",
      inputSchema: {
        type: "object",
        properties: {
          external_reference: { type: "string", description: "Unique payout reference" },
          country: { type: "string", description: "Country code (e.g. BR)" },
          amount: { type: "number", description: "Amount to send" },
          currency_code: { type: "string", description: "Currency code" },
          payee_name: { type: "string", description: "Payee full name" },
          payee_document: { type: "string", description: "Payee CPF/CNPJ" },
          payee_bank_code: { type: "string", description: "Bank code" },
          payee_bank_branch: { type: "string", description: "Branch number" },
          payee_bank_account: { type: "string", description: "Account number" },
          payee_bank_account_type: { type: "string", enum: ["C", "S"], description: "Account type (C=checking, S=savings)" },
        },
        required: ["external_reference", "country", "amount", "currency_code", "payee_name", "payee_document"],
      },
    },
    {
      name: "exchange_rate",
      description: "Get current exchange rate for a currency pair",
      inputSchema: {
        type: "object",
        properties: {
          currency_code: { type: "string", description: "Currency code (e.g. BRL)" },
        },
        required: ["currency_code"],
      },
    },
    {
      name: "get_banks",
      description: "List available banks for a country",
      inputSchema: {
        type: "object",
        properties: {
          country: { type: "string", description: "Country code (e.g. BR)" },
        },
        required: ["country"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_payment":
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("POST", "/direct", { payment: args }), null, 2) }] };
      case "get_payment":
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("GET", "/query", { hash: String(args?.hash) }), null, 2) }] };
      case "list_payments": {
        const params: Record<string, string> = {
          date_from: String(args?.date_from),
          date_to: String(args?.date_to),
        };
        if (args?.page) params.page = String(args.page);
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("GET", "/query", params), null, 2) }] };
      }
      case "refund": {
        const body: Record<string, unknown> = { hash: args?.hash };
        if (args?.amount) body.amount = args.amount;
        if (args?.description) body.description = args.description;
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("POST", "/refund", body), null, 2) }] };
      }
      case "create_payout":
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("POST", "/payout", args), null, 2) }] };
      case "exchange_rate":
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("GET", "/exchange", { currency_code: String(args?.currency_code) }), null, 2) }] };
      case "get_banks":
        return { content: [{ type: "text", text: JSON.stringify(await ebanxRequest("GET", "/getBankList", { country: String(args?.country) }), null, 2) }] };
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
        const s = new Server({ name: "mcp-ebanx", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
