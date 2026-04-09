#!/usr/bin/env node

/**
 * MCP Server for iugu — Brazilian payment platform.
 *
 * Tools:
 * - create_invoice: Create an invoice (Pix, boleto, or credit card)
 * - get_invoice: Get invoice details by ID
 * - list_invoices: List invoices with filters
 * - create_customer: Create a customer
 * - list_customers: List customers with filters
 * - create_subscription: Create a recurring subscription
 * - create_payment_method: Create a payment method for a customer
 * - get_account_info: Get account information and balance
 *
 * Environment:
 *   IUGU_API_TOKEN — API token from https://dev.iugu.com/
 *   IUGU_SANDBOX — "true" to use test mode (default: false)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_TOKEN = process.env.IUGU_API_TOKEN || "";
const BASE_URL = "https://api.iugu.com/v1";

async function iuguRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const credentials = btoa(`${API_TOKEN}:`);
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`iugu API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-iugu", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_invoice",
      description: "Create an invoice in iugu (Pix, boleto, or credit card)",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Payer email address" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          items: {
            type: "array",
            description: "Invoice items",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Item description" },
                quantity: { type: "number", description: "Quantity" },
                price_cents: { type: "number", description: "Unit price in cents (BRL)" },
              },
              required: ["description", "quantity", "price_cents"],
            },
          },
          payable_with: { type: "string", enum: ["pix", "bank_slip", "credit_card", "all"], description: "Payment method (default: all)" },
          customer_id: { type: "string", description: "Customer ID (optional)" },
          return_url: { type: "string", description: "URL to redirect after payment" },
          notification_url: { type: "string", description: "Webhook URL for status updates" },
        },
        required: ["email", "due_date", "items"],
      },
    },
    {
      name: "get_invoice",
      description: "Get invoice details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Invoice ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_invoices",
      description: "List invoices with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          status_filter: { type: "string", enum: ["pending", "paid", "canceled", "partially_paid", "refunded", "expired"], description: "Filter by status" },
          customer_id: { type: "string", description: "Filter by customer ID" },
          limit: { type: "number", description: "Number of results (default 100)" },
          start: { type: "number", description: "Pagination offset" },
          created_at_from: { type: "string", description: "Filter from date (YYYY-MM-DD)" },
          created_at_to: { type: "string", description: "Filter to date (YYYY-MM-DD)" },
        },
      },
    },
    {
      name: "create_customer",
      description: "Create a customer in iugu",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name" },
          email: { type: "string", description: "Email address" },
          cpf_cnpj: { type: "string", description: "CPF or CNPJ (numbers only)" },
          phone_prefix: { type: "string", description: "Phone area code (DDD)" },
          phone: { type: "string", description: "Phone number" },
          zip_code: { type: "string", description: "ZIP code (CEP)" },
          street: { type: "string", description: "Street address" },
          number: { type: "string", description: "Address number" },
          city: { type: "string", description: "City" },
          state: { type: "string", description: "State (UF, 2 letters)" },
        },
        required: ["name", "email"],
      },
    },
    {
      name: "list_customers",
      description: "List customers with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of results" },
          start: { type: "number", description: "Pagination offset" },
          query: { type: "string", description: "Search by name or email" },
        },
      },
    },
    {
      name: "create_subscription",
      description: "Create a recurring subscription in iugu",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Customer ID" },
          plan_identifier: { type: "string", description: "Plan identifier slug" },
          expires_at: { type: "string", description: "Expiration date (YYYY-MM-DD)" },
          only_on_charge_success: { type: "boolean", description: "Only activate on first successful charge" },
          payable_with: { type: "string", enum: ["credit_card", "bank_slip", "pix", "all"], description: "Payment method" },
        },
        required: ["customer_id", "plan_identifier"],
      },
    },
    {
      name: "create_payment_method",
      description: "Create a payment method (credit card token) for a customer",
      inputSchema: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "Customer ID" },
          description: { type: "string", description: "Card description (e.g., 'Visa ending 1234')" },
          token: { type: "string", description: "Card token from iugu.js tokenization" },
          set_as_default: { type: "boolean", description: "Set as default payment method" },
        },
        required: ["customer_id", "description", "token"],
      },
    },
    {
      name: "get_account_info",
      description: "Get account information, configuration, and balance",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_invoice":
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("POST", "/invoices", args), null, 2) }] };
      case "get_invoice":
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("GET", `/invoices/${args?.id}`), null, 2) }] };
      case "list_invoices": {
        const params = new URLSearchParams();
        if (args?.status_filter) params.set("status_filter", String(args.status_filter));
        if (args?.customer_id) params.set("customer_id", String(args.customer_id));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.start) params.set("start", String(args.start));
        if (args?.created_at_from) params.set("created_at_from", String(args.created_at_from));
        if (args?.created_at_to) params.set("created_at_to", String(args.created_at_to));
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("GET", `/invoices?${params}`), null, 2) }] };
      }
      case "create_customer":
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("POST", "/customers", args), null, 2) }] };
      case "list_customers": {
        const params = new URLSearchParams();
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.start) params.set("start", String(args.start));
        if (args?.query) params.set("query", String(args.query));
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("GET", `/customers?${params}`), null, 2) }] };
      }
      case "create_subscription":
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("POST", "/subscriptions", args), null, 2) }] };
      case "create_payment_method": {
        const { customer_id, ...methodBody } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("POST", `/customers/${customer_id}/payment_methods`, methodBody), null, 2) }] };
      }
      case "get_account_info":
        return { content: [{ type: "text", text: JSON.stringify(await iuguRequest("GET", "/accounts"), null, 2) }] };
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
        const s = new Server({ name: "mcp-iugu", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
