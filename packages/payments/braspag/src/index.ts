#!/usr/bin/env node

/**
 * MCP Server for Braspag — Cielo Group's enterprise orchestration layer.
 *
 * Braspag is distinct from the Cielo Acquirer server: Cielo handles card
 * acquiring rails directly, whereas Braspag (product: Pagador) is the
 * orchestration layer used by enterprise retailers for multi-acquirer
 * routing, token vault (Cartão Protegido), recurrence, marketplace split,
 * and antifraud orchestration. Target customer: enterprise BR retail
 * (Magalu-tier). Different business contract from Cielo Acquirer.
 *
 * Tools (12):
 *   Payments (Transaction API):
 *     create_sale              — create a sale (credit/debit/boleto/pix/eletronic transfer)
 *     capture_sale             — capture a pre-authorized sale (full or partial)
 *     void_sale                — void / cancel a sale (full or partial)
 *     create_recurrent         — create a recurrent payment schedule
 *     disable_recurrent        — deactivate a recurrent payment
 *     update_recurrent_amount  — update the amount on a recurrent payment
 *   Queries (Query API):
 *     get_sale                 — get sale detail by PaymentId
 *     get_sale_by_order_id     — get sale(s) by MerchantOrderId
 *     get_recurrent            — get recurrent payment by RecurrentPaymentId
 *   Cartão Protegido (Token Vault — Transaction API):
 *     tokenize_card            — tokenize a card into the Braspag vault
 *     get_card_token           — retrieve card data by vault token
 *   Split (Transaction API):
 *     create_split_sale        — create a sale with marketplace split rules
 *
 * APIs
 *   Transaction API (mutations): api.braspag.com.br/v2
 *   Query API (reads):           apiquery.braspag.com.br/v2
 *   Sandbox subdomain:           apisandbox.* / apiquerysandbox.*
 *
 * Authentication
 *   MerchantId:  <uuid>
 *   MerchantKey: <secret string>
 *
 * Environment
 *   BRASPAG_MERCHANT_ID   — merchant UUID (required)
 *   BRASPAG_MERCHANT_KEY  — merchant secret key (required)
 *   BRASPAG_ENV           — "sandbox" | "production" (default: "sandbox")
 *
 * Docs: https://braspag.github.io/manual/braspag-pagador
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MERCHANT_ID = process.env.BRASPAG_MERCHANT_ID || "";
const MERCHANT_KEY = process.env.BRASPAG_MERCHANT_KEY || "";
const ENV = (process.env.BRASPAG_ENV || "sandbox").toLowerCase();

const TRANSACTION_URL = ENV === "production"
  ? "https://api.braspag.com.br/v2"
  : "https://apisandbox.braspag.com.br/v2";
const QUERY_URL = ENV === "production"
  ? "https://apiquery.braspag.com.br/v2"
  : "https://apiquerysandbox.braspag.com.br/v2";

async function braspagRequest(
  method: string,
  api: "transaction" | "query",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const baseUrl = api === "query" ? QUERY_URL : TRANSACTION_URL;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "MerchantId": MERCHANT_ID,
      "MerchantKey": MERCHANT_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Braspag API ${res.status}: ${err}`);
  }
  // Some endpoints (PUT void/capture/deactivate) may return empty body
  const text = await res.text();
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const server = new Server(
  { name: "mcp-braspag", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_sale",
      description:
        "Create a sale on the Braspag Transaction API (POST /sales). Pass a full Braspag sale payload. Payment.Type may be CreditCard, DebitCard, Boleto, Pix, or EletronicTransfer. Braspag orchestrates routing across multiple acquirers based on merchant-level rules.",
      inputSchema: {
        type: "object",
        properties: {
          MerchantOrderId: { type: "string", description: "Merchant-side order id (appears in reports)" },
          Customer: {
            type: "object",
            description: "Customer identification (Braspag shape)",
            properties: {
              Name: { type: "string", description: "Customer full name" },
            },
            required: ["Name"],
          },
          Payment: {
            type: "object",
            description:
              "Braspag Payment object. Shape depends on Type. For CreditCard/DebitCard pass a CreditCard/DebitCard sub-object. For Boleto pass Provider/ExpirationDate. For Pix, Amount is enough. For EletronicTransfer (TEF), pass Provider.",
            properties: {
              Type: {
                type: "string",
                enum: ["CreditCard", "DebitCard", "Boleto", "Pix", "EletronicTransfer"],
                description: "Payment method type",
              },
              Amount: { type: "number", description: "Amount in cents (e.g. 15700 = R$157.00)" },
            },
            required: ["Type", "Amount"],
          },
        },
        required: ["MerchantOrderId", "Customer", "Payment"],
      },
    },
    {
      name: "capture_sale",
      description:
        "Capture a pre-authorized sale (PUT /sales/{paymentId}/capture). Supports partial capture via amount, and optional serviceTaxAmount (airline / travel merchants).",
      inputSchema: {
        type: "object",
        properties: {
          payment_id: { type: "string", description: "Braspag PaymentId (GUID)" },
          amount: { type: "number", description: "Amount to capture in cents. Omit for full capture." },
          service_tax_amount: { type: "number", description: "Service tax amount in cents. Optional." },
        },
        required: ["payment_id"],
      },
    },
    {
      name: "void_sale",
      description:
        "Void / cancel a sale (PUT /sales/{paymentId}/void). Supports full void (omit amount) or partial void.",
      inputSchema: {
        type: "object",
        properties: {
          payment_id: { type: "string", description: "Braspag PaymentId (GUID)" },
          amount: { type: "number", description: "Amount to void in cents. Omit for full void." },
        },
        required: ["payment_id"],
      },
    },
    {
      name: "create_recurrent",
      description:
        "Create a recurrent payment schedule (POST /recurrentPayments). Used for subscriptions and any schedule where Braspag (not the merchant) drives the recurrence.",
      inputSchema: {
        type: "object",
        properties: {
          MerchantOrderId: { type: "string", description: "Merchant-side order id" },
          Customer: {
            type: "object",
            description: "Customer object",
            properties: { Name: { type: "string", description: "Customer full name" } },
            required: ["Name"],
          },
          RecurrentPayment: {
            type: "object",
            description:
              "Recurrent-specific fields: AuthorizeNow, StartDate, EndDate, Interval (Monthly | Bimonthly | Quarterly | SemiAnnual | Annual), Amount, CreditCard, etc. Pass the full Braspag RecurrentPayment shape.",
          },
        },
        required: ["MerchantOrderId", "Customer", "RecurrentPayment"],
      },
    },
    {
      name: "disable_recurrent",
      description:
        "Deactivate a recurrent payment (PUT /recurrentPayments/{recurrentPaymentId}/Deactivate). Stops future charges; does not refund historical ones.",
      inputSchema: {
        type: "object",
        properties: {
          recurrent_payment_id: { type: "string", description: "Braspag RecurrentPaymentId (GUID)" },
        },
        required: ["recurrent_payment_id"],
      },
    },
    {
      name: "update_recurrent_amount",
      description:
        "Update the charged amount on a recurrent payment (PUT /recurrentPayments/{recurrentPaymentId}/Amount). Body carries the new amount in cents.",
      inputSchema: {
        type: "object",
        properties: {
          recurrent_payment_id: { type: "string", description: "Braspag RecurrentPaymentId (GUID)" },
          amount: { type: "number", description: "New amount in cents" },
        },
        required: ["recurrent_payment_id", "amount"],
      },
    },
    {
      name: "get_sale",
      description: "Get sale detail by PaymentId (GET /sales/{paymentId} — Query API).",
      inputSchema: {
        type: "object",
        properties: {
          payment_id: { type: "string", description: "Braspag PaymentId (GUID)" },
        },
        required: ["payment_id"],
      },
    },
    {
      name: "get_sale_by_order_id",
      description:
        "Look up sale(s) by MerchantOrderId (GET /sales?merchantOrderId=X — Query API). Returns an array of PaymentIds matching the merchant order.",
      inputSchema: {
        type: "object",
        properties: {
          merchant_order_id: { type: "string", description: "Merchant-side order id used when the sale was created" },
        },
        required: ["merchant_order_id"],
      },
    },
    {
      name: "get_recurrent",
      description:
        "Get a recurrent payment's configuration and history (GET /recurrentPayments/{recurrentPaymentId} — Query API).",
      inputSchema: {
        type: "object",
        properties: {
          recurrent_payment_id: { type: "string", description: "Braspag RecurrentPaymentId (GUID)" },
        },
        required: ["recurrent_payment_id"],
      },
    },
    {
      name: "tokenize_card",
      description:
        "Tokenize a card into the Braspag vault / Cartão Protegido (POST /card). Returns a reusable token that can substitute CardNumber on future sales — reduces PCI scope and enables cross-acquirer reuse.",
      inputSchema: {
        type: "object",
        properties: {
          CustomerName: { type: "string", description: "Customer full name" },
          CardNumber: { type: "string", description: "Card PAN" },
          Holder: { type: "string", description: "Cardholder name as printed" },
          ExpirationDate: { type: "string", description: "Expiration date (MM/YYYY)" },
          Brand: { type: "string", description: "Card brand (Visa, Master, Elo, Amex, Hipercard, ...)" },
        },
        required: ["CustomerName", "CardNumber", "Holder", "ExpirationDate", "Brand"],
      },
    },
    {
      name: "get_card_token",
      description:
        "Retrieve the stored card data associated with a Cartão Protegido token (GET /card/{token}). Returns masked card fields + brand + expiration.",
      inputSchema: {
        type: "object",
        properties: {
          token: { type: "string", description: "Cartão Protegido vault token" },
        },
        required: ["token"],
      },
    },
    {
      name: "create_split_sale",
      description:
        "Create a sale with marketplace split rules (POST /sales with Payment.SplitPayments). Same endpoint as create_sale, but exposes the split array shape explicitly: each element has a SubordinateMerchantId, Amount (cents), Fares { Mdr, Fee }. Use for marketplace / multi-seller scenarios where Braspag splits the capture across sub-merchants.",
      inputSchema: {
        type: "object",
        properties: {
          MerchantOrderId: { type: "string", description: "Merchant-side order id" },
          Customer: {
            type: "object",
            description: "Customer object",
            properties: { Name: { type: "string", description: "Customer full name" } },
            required: ["Name"],
          },
          Payment: {
            type: "object",
            description:
              "Braspag Payment object with SplitPayments array. Type is typically CreditCard. Each SplitPayments entry: { SubordinateMerchantId: string, Amount: number (cents), Fares: { Mdr: number (percent), Fee: number (cents) } }.",
            properties: {
              Type: { type: "string", description: "Payment type (usually CreditCard)" },
              Amount: { type: "number", description: "Total amount in cents" },
              SplitPayments: {
                type: "array",
                description: "Split rules across sub-merchants",
                items: {
                  type: "object",
                  properties: {
                    SubordinateMerchantId: { type: "string", description: "Sub-merchant (seller) UUID" },
                    Amount: { type: "number", description: "Portion of total in cents" },
                    Fares: {
                      type: "object",
                      description: "Fare split",
                      properties: {
                        Mdr: { type: "number", description: "Merchant Discount Rate (percent)" },
                        Fee: { type: "number", description: "Flat fee in cents" },
                      },
                    },
                  },
                  required: ["SubordinateMerchantId", "Amount"],
                },
              },
            },
            required: ["Type", "Amount", "SplitPayments"],
          },
        },
        required: ["MerchantOrderId", "Customer", "Payment"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = rawArgs as Record<string, unknown> | undefined;

  try {
    switch (name) {
      case "create_sale": {
        const body = {
          MerchantOrderId: args?.MerchantOrderId,
          Customer: args?.Customer,
          Payment: args?.Payment,
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("POST", "transaction", "/sales", body), null, 2) },
          ],
        };
      }
      case "capture_sale": {
        const params = new URLSearchParams();
        if (args?.amount !== undefined) params.set("amount", String(args.amount));
        if (args?.service_tax_amount !== undefined) params.set("serviceTaxAmount", String(args.service_tax_amount));
        const qs = params.toString();
        const path = `/sales/${args?.payment_id}/capture${qs ? `?${qs}` : ""}`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("PUT", "transaction", path), null, 2) },
          ],
        };
      }
      case "void_sale": {
        const path = args?.amount !== undefined
          ? `/sales/${args?.payment_id}/void?amount=${args.amount}`
          : `/sales/${args?.payment_id}/void`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("PUT", "transaction", path), null, 2) },
          ],
        };
      }
      case "create_recurrent": {
        const body = {
          MerchantOrderId: args?.MerchantOrderId,
          Customer: args?.Customer,
          RecurrentPayment: args?.RecurrentPayment,
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("POST", "transaction", "/recurrentPayments", body), null, 2) },
          ],
        };
      }
      case "disable_recurrent": {
        const path = `/recurrentPayments/${args?.recurrent_payment_id}/Deactivate`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("PUT", "transaction", path), null, 2) },
          ],
        };
      }
      case "update_recurrent_amount": {
        const path = `/recurrentPayments/${args?.recurrent_payment_id}/Amount`;
        const body = { Amount: args?.amount };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("PUT", "transaction", path, body), null, 2) },
          ],
        };
      }
      case "get_sale": {
        const path = `/sales/${args?.payment_id}`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("GET", "query", path), null, 2) },
          ],
        };
      }
      case "get_sale_by_order_id": {
        const path = `/sales?merchantOrderId=${encodeURIComponent(String(args?.merchant_order_id ?? ""))}`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("GET", "query", path), null, 2) },
          ],
        };
      }
      case "get_recurrent": {
        const path = `/recurrentPayments/${args?.recurrent_payment_id}`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("GET", "query", path), null, 2) },
          ],
        };
      }
      case "tokenize_card": {
        const body = {
          CustomerName: args?.CustomerName,
          CardNumber: args?.CardNumber,
          Holder: args?.Holder,
          ExpirationDate: args?.ExpirationDate,
          Brand: args?.Brand,
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("POST", "transaction", "/card", body), null, 2) },
          ],
        };
      }
      case "get_card_token": {
        const path = `/card/${args?.token}`;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("GET", "transaction", path), null, 2) },
          ],
        };
      }
      case "create_split_sale": {
        const body = {
          MerchantOrderId: args?.MerchantOrderId,
          Customer: args?.Customer,
          Payment: args?.Payment,
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braspagRequest("POST", "transaction", "/sales", body), null, 2) },
          ],
        };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
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
        const s = new Server({ name: "mcp-braspag", version: "0.1.0" }, { capabilities: { tools: {} } });
        (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v));
        (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v));
        await s.connect(t);
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
