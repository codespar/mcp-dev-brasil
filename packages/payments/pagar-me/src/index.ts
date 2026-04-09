#!/usr/bin/env node

/**
 * MCP Server for Pagar.me — Brazilian payment platform.
 *
 * Tools:
 * - create_order: Create an order with items
 * - get_order: Get order details by ID
 * - list_orders: List orders with filters
 * - create_charge: Create a charge (Pix, boleto, credit card)
 * - get_charge: Get charge details by ID
 * - create_recipient: Create a recipient for split payments
 * - get_balance: Get account balance
 * - create_transfer: Create a transfer to recipient
 * - refund: Refund a charge
 * - list_recipients: List recipients
 *
 * Environment:
 *   PAGARME_API_KEY — Secret key (sk_xxx) from https://dash.pagar.me/
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.PAGARME_API_KEY || "";
const BASE_URL = "https://api.pagar.me/core/v5";

async function pagarmeRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${API_KEY}:`),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pagar.me API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-pagar-me", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_order",
      description: "Create an order in Pagar.me with items and payment",
      inputSchema: {
        type: "object",
        properties: {
          customer: {
            type: "object",
            description: "Customer object with name, email, document, type",
            properties: {
              name: { type: "string", description: "Customer name" },
              email: { type: "string", description: "Customer email" },
              document: { type: "string", description: "CPF or CNPJ" },
              type: { type: "string", enum: ["individual", "company"], description: "Customer type" },
            },
            required: ["name", "email", "document", "type"],
          },
          items: {
            type: "array",
            description: "Order items",
            items: {
              type: "object",
              properties: {
                amount: { type: "number", description: "Amount in cents" },
                description: { type: "string", description: "Item description" },
                quantity: { type: "number", description: "Item quantity" },
              },
              required: ["amount", "description", "quantity"],
            },
          },
          payments: {
            type: "array",
            description: "Payment methods array",
          },
        },
        required: ["customer", "items", "payments"],
      },
    },
    {
      name: "get_order",
      description: "Get order details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Order ID (or_xxx)" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_orders",
      description: "List orders with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "paid", "canceled", "failed"], description: "Filter by status" },
          page: { type: "number", description: "Page number" },
          size: { type: "number", description: "Page size" },
        },
      },
    },
    {
      name: "create_charge",
      description: "Create a charge (Pix, boleto, or credit card)",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Order ID to attach the charge" },
          amount: { type: "number", description: "Amount in cents" },
          payment_method: { type: "string", enum: ["pix", "boleto", "credit_card"], description: "Payment method" },
          customer_id: { type: "string", description: "Customer ID" },
        },
        required: ["amount", "payment_method"],
      },
    },
    {
      name: "get_charge",
      description: "Get charge details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Charge ID (ch_xxx)" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_recipient",
      description: "Create a recipient for split payments",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Recipient name" },
          email: { type: "string", description: "Recipient email" },
          document: { type: "string", description: "CPF or CNPJ" },
          type: { type: "string", enum: ["individual", "company"], description: "Recipient type" },
          bank_account: {
            type: "object",
            description: "Bank account details",
            properties: {
              bank: { type: "string", description: "Bank code (e.g. 001)" },
              branch_number: { type: "string", description: "Branch number" },
              account_number: { type: "string", description: "Account number" },
              account_check_digit: { type: "string", description: "Account check digit" },
              type: { type: "string", enum: ["checking", "savings"], description: "Account type" },
              holder_name: { type: "string", description: "Account holder name" },
              holder_document: { type: "string", description: "Account holder document" },
            },
          },
        },
        required: ["name", "email", "document", "type"],
      },
    },
    {
      name: "get_balance",
      description: "Get current account balance",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "create_transfer",
      description: "Create a transfer to a recipient",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in cents" },
          recipient_id: { type: "string", description: "Recipient ID (rp_xxx)" },
        },
        required: ["amount", "recipient_id"],
      },
    },
    {
      name: "refund",
      description: "Refund a charge (full or partial)",
      inputSchema: {
        type: "object",
        properties: {
          charge_id: { type: "string", description: "Charge ID (ch_xxx)" },
          amount: { type: "number", description: "Amount in cents (omit for full refund)" },
        },
        required: ["charge_id"],
      },
    },
    {
      name: "list_recipients",
      description: "List recipients with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number" },
          size: { type: "number", description: "Page size" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_order":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("POST", "/orders", args), null, 2) }] };
      case "get_order":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("GET", `/orders/${args?.id}`), null, 2) }] };
      case "list_orders": {
        const params = new URLSearchParams();
        if (args?.status) params.set("status", String(args.status));
        if (args?.page) params.set("page", String(args.page));
        if (args?.size) params.set("size", String(args.size));
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("GET", `/orders?${params}`), null, 2) }] };
      }
      case "create_charge": {
        const orderId = args?.order_id;
        const body = { ...args } as Record<string, unknown>;
        delete body.order_id;
        const path = orderId ? `/orders/${orderId}/charges` : "/charges";
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("POST", path, body), null, 2) }] };
      }
      case "get_charge":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("GET", `/charges/${args?.id}`), null, 2) }] };
      case "create_recipient":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("POST", "/recipients", args), null, 2) }] };
      case "get_balance":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("GET", "/balance"), null, 2) }] };
      case "create_transfer":
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("POST", "/transfers", args), null, 2) }] };
      case "refund": {
        const chargeId = args?.charge_id;
        const body: Record<string, unknown> = {};
        if (args?.amount) body.amount = args.amount;
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("POST", `/charges/${chargeId}/refund`, body), null, 2) }] };
      }
      case "list_recipients": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.size) params.set("size", String(args.size));
        return { content: [{ type: "text", text: JSON.stringify(await pagarmeRequest("GET", `/recipients?${params}`), null, 2) }] };
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
        const s = new Server({ name: "mcp-pagar-me", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
