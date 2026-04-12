#!/usr/bin/env node

/**
 * MCP Server for Mercado Pago — payment gateway for LATAM.
 *
 * Tools:
 * - create_payment: Create a payment
 * - get_payment: Get payment by ID
 * - search_payments: Search payments with filters
 * - create_refund: Refund a payment (full or partial)
 * - create_preference: Create checkout preference
 * - get_preference: Get preference by ID
 * - create_customer: Create customer
 * - list_customers: List customers
 * - get_payment_methods: List available payment methods
 * - create_pix_payment: Create PIX payment
 * - get_merchant_order: Get merchant order by ID
 * - get_balance: Get account balance
 *
 * Environment:
 *   MERCADO_PAGO_ACCESS_TOKEN — Access token for API authentication
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
const BASE_URL = "https://api.mercadopago.com";

async function mpRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ACCESS_TOKEN) headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Pago API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-mercado-pago", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_payment",
      description: "Create a new payment",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Payment amount" },
          description: { type: "string", description: "Payment description" },
          payment_method_id: { type: "string", description: "Payment method ID (e.g. pix, credit_card, bolbradesco)" },
          payer_email: { type: "string", description: "Payer email address" },
          installments: { type: "number", description: "Number of installments (default 1)" },
          token: { type: "string", description: "Card token (for credit card payments)" },
        },
        required: ["amount", "description", "payment_method_id", "payer_email"],
      },
    },
    {
      name: "get_payment",
      description: "Get payment details by ID",
      inputSchema: {
        type: "object",
        properties: { paymentId: { type: "string", description: "Payment ID" } },
        required: ["paymentId"],
      },
    },
    {
      name: "search_payments",
      description: "Search payments with filters",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "authorized", "in_process", "in_mediation", "rejected", "cancelled", "refunded", "charged_back"], description: "Payment status" },
          date_from: { type: "string", description: "Start date (ISO 8601)" },
          date_to: { type: "string", description: "End date (ISO 8601)" },
          sort: { type: "string", enum: ["date_created", "date_approved", "date_last_updated", "money_release_date"], description: "Sort field" },
          criteria: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
          limit: { type: "number", description: "Results limit" },
          offset: { type: "number", description: "Results offset" },
        },
      },
    },
    {
      name: "create_refund",
      description: "Refund a payment (full or partial)",
      inputSchema: {
        type: "object",
        properties: {
          paymentId: { type: "string", description: "Payment ID to refund" },
          amount: { type: "number", description: "Refund amount (omit for full refund)" },
        },
        required: ["paymentId"],
      },
    },
    {
      name: "create_preference",
      description: "Create a checkout preference for Checkout Pro",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Items to sell",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Item title" },
                quantity: { type: "number", description: "Quantity" },
                unit_price: { type: "number", description: "Unit price" },
                currency_id: { type: "string", description: "Currency (e.g. BRL)" },
              },
              required: ["title", "quantity", "unit_price"],
            },
          },
          back_urls: {
            type: "object",
            description: "Redirect URLs after payment",
            properties: {
              success: { type: "string", description: "URL on success" },
              failure: { type: "string", description: "URL on failure" },
              pending: { type: "string", description: "URL on pending" },
            },
          },
          auto_return: { type: "string", enum: ["approved", "all"], description: "Auto-return mode" },
        },
        required: ["items"],
      },
    },
    {
      name: "get_preference",
      description: "Get checkout preference by ID",
      inputSchema: {
        type: "object",
        properties: { preferenceId: { type: "string", description: "Preference ID" } },
        required: ["preferenceId"],
      },
    },
    {
      name: "create_customer",
      description: "Create a customer",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email" },
          first_name: { type: "string", description: "First name" },
          last_name: { type: "string", description: "Last name" },
        },
        required: ["email"],
      },
    },
    {
      name: "list_customers",
      description: "List customers",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Filter by email" },
          limit: { type: "number", description: "Results limit" },
          offset: { type: "number", description: "Results offset" },
        },
      },
    },
    {
      name: "get_payment_methods",
      description: "List available payment methods",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "create_pix_payment",
      description: "Create a PIX payment",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Payment amount" },
          description: { type: "string", description: "Payment description" },
          payer_email: { type: "string", description: "Payer email" },
          payer_first_name: { type: "string", description: "Payer first name" },
          payer_last_name: { type: "string", description: "Payer last name" },
          payer_cpf: { type: "string", description: "Payer CPF (identification number)" },
        },
        required: ["amount", "description", "payer_email"],
      },
    },
    {
      name: "get_merchant_order",
      description: "Get merchant order by ID",
      inputSchema: {
        type: "object",
        properties: { orderId: { type: "string", description: "Merchant order ID" } },
        required: ["orderId"],
      },
    },
    {
      name: "get_balance",
      description: "Get account balance",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_payment": {
        const payload: any = {
          transaction_amount: args?.amount,
          description: args?.description,
          payment_method_id: args?.payment_method_id,
          payer: { email: args?.payer_email },
        };
        if (args?.installments) payload.installments = args.installments;
        if (args?.token) payload.token = args.token;
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("POST", "/v1/payments", payload), null, 2) }] };
      }
      case "get_payment":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", `/v1/payments/${args?.paymentId}`), null, 2) }] };
      case "search_payments": {
        const params = new URLSearchParams();
        if (args?.status) params.set("status", String(args.status));
        if (args?.date_from) params.set("begin_date", String(args.date_from));
        if (args?.date_to) params.set("end_date", String(args.date_to));
        if (args?.sort) params.set("sort", String(args.sort));
        if (args?.criteria) params.set("criteria", String(args.criteria));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", `/v1/payments/search?${params}`), null, 2) }] };
      }
      case "create_refund": {
        const body = args?.amount ? { amount: args.amount } : undefined;
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("POST", `/v1/payments/${args?.paymentId}/refunds`, body), null, 2) }] };
      }
      case "create_preference":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("POST", "/checkout/preferences", {
          items: args?.items,
          back_urls: args?.back_urls,
          auto_return: args?.auto_return,
        }), null, 2) }] };
      case "get_preference":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", `/checkout/preferences/${args?.preferenceId}`), null, 2) }] };
      case "create_customer":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("POST", "/v1/customers", {
          email: args?.email,
          first_name: args?.first_name,
          last_name: args?.last_name,
        }), null, 2) }] };
      case "list_customers": {
        const params = new URLSearchParams();
        if (args?.email) params.set("email", String(args.email));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", `/v1/customers/search?${params}`), null, 2) }] };
      }
      case "get_payment_methods":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", "/v1/payment_methods"), null, 2) }] };
      case "create_pix_payment": {
        const payload: any = {
          transaction_amount: args?.amount,
          description: args?.description,
          payment_method_id: "pix",
          payer: {
            email: args?.payer_email,
            first_name: args?.payer_first_name,
            last_name: args?.payer_last_name,
          },
        };
        if (args?.payer_cpf) {
          payload.payer.identification = { type: "CPF", number: args.payer_cpf };
        }
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("POST", "/v1/payments", payload), null, 2) }] };
      }
      case "get_merchant_order":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", `/merchant_orders/${args?.orderId}`), null, 2) }] };
      case "get_balance":
        return { content: [{ type: "text", text: JSON.stringify(await mpRequest("GET", "/users/me/mercadopago_account/balance"), null, 2) }] };
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
        const s = new Server({ name: "mcp-mercado-pago", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
