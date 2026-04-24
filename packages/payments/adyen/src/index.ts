#!/usr/bin/env node

/**
 * MCP Server for Adyen Checkout API v71 — global enterprise payments.
 *
 * Adyen is the default payment rail for global LatAm enterprise (iFood, Uber,
 * Spotify, AirBnB in BR). Distinct from every other payments server in our
 * catalog: it's the one enterprise merchants choose when a single gateway
 * has to cover BR + EU + US + APAC under one contract.
 *
 * This server covers **Checkout API v71** only. Payouts API, Management API,
 * and Balance Platform API are separate surfaces that can be added in
 * follow-up packages when demand emerges.
 *
 * Tools (15):
 *   Payments
 *     create_payment           POST /payments
 *     payment_details          POST /payments/details         (3DS challenge response)
 *     capture_payment          POST /payments/{pspReference}/captures
 *     cancel_payment           POST /payments/{pspReference}/cancels
 *     refund_payment           POST /payments/{pspReference}/refunds
 *     reverse_payment          POST /payments/{pspReference}/reversals (void-or-refund atomic)
 *     update_amount            POST /payments/{pspReference}/amountUpdates
 *
 *   Discovery
 *     get_payment_methods      POST /paymentMethods           (dynamic method discovery)
 *
 *   Payment Links (hosted checkout)
 *     create_payment_link      POST /paymentLinks
 *     get_payment_link         GET  /paymentLinks/{linkId}
 *     update_payment_link      PATCH /paymentLinks/{linkId}   (e.g., expire early)
 *
 *   Donations
 *     create_donation          POST /donations
 *
 *   Stored payment methods
 *     list_stored_payment_methods    GET    /storedPaymentMethods?shopperReference=X
 *     disable_stored_payment_method  DELETE /storedPaymentMethods/{recurringId}
 *
 *   Sessions (for Drop-in/Components)
 *     create_session           POST /sessions
 *
 * Authentication
 *   X-API-Key header. Keys are generated in Customer Area → Developers →
 *   API credentials. Test keys hit checkout-test.adyen.com; live keys need
 *   a merchant-specific URL prefix (e.g. 1797a841fbb37ca7-AdyenDemo).
 *
 * Environment
 *   ADYEN_API_KEY           API key (Bearer equivalent; sent as X-API-Key)
 *   ADYEN_MERCHANT_ACCOUNT  merchant account code, injected into every call
 *   ADYEN_ENV               test | live. Defaults to test.
 *   ADYEN_LIVE_URL_PREFIX   required when ADYEN_ENV=live
 *
 * Docs: https://docs.adyen.com/api-explorer/Checkout/71/overview
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.ADYEN_API_KEY || "";
const MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT || "";
const ENV = (process.env.ADYEN_ENV || "test").toLowerCase();
const LIVE_URL_PREFIX = process.env.ADYEN_LIVE_URL_PREFIX || "";

function checkoutBaseUrl(): string {
  if (ENV === "live") {
    if (!LIVE_URL_PREFIX) {
      throw new Error("ADYEN_ENV=live requires ADYEN_LIVE_URL_PREFIX to be set");
    }
    return `https://${LIVE_URL_PREFIX}-checkout-live.adyenpayments.com/checkout/v71`;
  }
  return "https://checkout-test.adyen.com/v71";
}

async function adyenRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${checkoutBaseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Adyen API ${res.status}: ${await res.text()}`);
  }
  // Some DELETE/PATCH responses are empty; guard against that.
  const text = await res.text();
  return text ? JSON.parse(text) : { status: res.status };
}

/** Inject merchantAccount into a payload if the caller didn't supply one. */
function withMerchant(body: Record<string, unknown> | undefined): Record<string, unknown> {
  const b = body ?? {};
  if (!b.merchantAccount && MERCHANT_ACCOUNT) b.merchantAccount = MERCHANT_ACCOUNT;
  return b;
}

const server = new Server(
  { name: "mcp-adyen", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_payment",
      description: "Create a payment. Pass paymentMethod (type + tokenized fields), amount, reference, returnUrl. merchantAccount is injected automatically from env.",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "object", description: "{ value: integer (minor units), currency: ISO-4217 }" },
          paymentMethod: { type: "object", description: "Method-specific payload (type=scheme for cards, type=ideal for iDEAL, etc). Prefer tokenized fields from onSubmit." },
          reference: { type: "string", description: "Merchant-side reference (appears in reports)" },
          returnUrl: { type: "string", description: "Redirect target after 3DS / bank flow" },
          shopperReference: { type: "string", description: "Stable shopper id — used for stored-method recall" },
          storePaymentMethod: { type: "boolean", description: "Store the method for future one-click reuse" },
          recurringProcessingModel: { type: "string", enum: ["CardOnFile", "Subscription", "UnscheduledCardOnFile"] },
          countryCode: { type: "string", description: "ISO-3166 alpha-2 (BR, MX, etc)" },
          shopperLocale: { type: "string", description: "e.g. pt-BR" },
          shopperEmail: { type: "string" },
          shopperIP: { type: "string" },
          channel: { type: "string", enum: ["iOS", "Android", "Web"] },
          origin: { type: "string", description: "Required for native 3DS2 on Web" },
          browserInfo: { type: "object", description: "Browser fingerprint object for 3DS2" },
          additionalData: { type: "object" },
          merchantAccount: { type: "string", description: "Override the env merchant account (rare)" },
        },
        required: ["amount", "paymentMethod", "reference", "returnUrl"],
      },
    },
    {
      name: "payment_details",
      description: "Submit additional details for a payment (3DS challenge response, redirect returnUrl payload, etc).",
      inputSchema: {
        type: "object",
        properties: {
          details: { type: "object", description: "Details object returned in action from create_payment" },
          paymentData: { type: "string", description: "Opaque state from the previous step" },
          threeDSAuthenticationOnly: { type: "boolean" },
        },
        required: ["details"],
      },
    },
    {
      name: "capture_payment",
      description: "Capture an authorized payment (for delayed-capture flows).",
      inputSchema: {
        type: "object",
        properties: {
          pspReference: { type: "string", description: "Original payment pspReference" },
          amount: { type: "object", description: "{ value, currency }. Omit for full capture." },
          reference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["pspReference"],
      },
    },
    {
      name: "cancel_payment",
      description: "Cancel an authorized-but-uncaptured payment.",
      inputSchema: {
        type: "object",
        properties: {
          pspReference: { type: "string" },
          reference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["pspReference"],
      },
    },
    {
      name: "refund_payment",
      description: "Refund a captured payment (full or partial).",
      inputSchema: {
        type: "object",
        properties: {
          pspReference: { type: "string" },
          amount: { type: "object", description: "{ value, currency }. Omit for full refund." },
          reference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["pspReference", "amount"],
      },
    },
    {
      name: "reverse_payment",
      description: "Void-or-refund a payment atomically. Adyen figures out whether to cancel (if uncaptured) or refund (if captured).",
      inputSchema: {
        type: "object",
        properties: {
          pspReference: { type: "string" },
          reference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["pspReference"],
      },
    },
    {
      name: "update_amount",
      description: "Update the authorized amount of an unsettled payment (common in tips / hotel incidentals).",
      inputSchema: {
        type: "object",
        properties: {
          pspReference: { type: "string" },
          amount: { type: "object", description: "{ value, currency }" },
          reference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["pspReference", "amount"],
      },
    },
    {
      name: "get_payment_methods",
      description: "Dynamically list available payment methods for a country/currency/amount combination. Critical for multi-country agents that shouldn't hard-code methods.",
      inputSchema: {
        type: "object",
        properties: {
          countryCode: { type: "string", description: "ISO-3166 alpha-2" },
          amount: { type: "object", description: "{ value, currency }" },
          shopperLocale: { type: "string" },
          channel: { type: "string", enum: ["iOS", "Android", "Web"] },
          shopperReference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["countryCode"],
      },
    },
    {
      name: "create_payment_link",
      description: "Create a hosted payment link (URL you send to the customer).",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "object", description: "{ value, currency }" },
          reference: { type: "string" },
          shopperReference: { type: "string" },
          countryCode: { type: "string" },
          shopperEmail: { type: "string" },
          expiresAt: { type: "string", description: "ISO-8601 timestamp. Defaults to 24h." },
          allowedPaymentMethods: { type: "array", description: "Whitelist of method types (e.g. ['scheme','pix'])" },
          merchantAccount: { type: "string" },
        },
        required: ["amount", "reference"],
      },
    },
    {
      name: "get_payment_link",
      description: "Retrieve a payment link by id.",
      inputSchema: {
        type: "object",
        properties: {
          linkId: { type: "string" },
        },
        required: ["linkId"],
      },
    },
    {
      name: "update_payment_link",
      description: "Update a payment link — typically to expire it early.",
      inputSchema: {
        type: "object",
        properties: {
          linkId: { type: "string" },
          status: { type: "string", enum: ["expired"] },
        },
        required: ["linkId", "status"],
      },
    },
    {
      name: "create_donation",
      description: "Create a round-up donation linked to an original payment (Adyen Giving).",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "object" },
          reference: { type: "string" },
          donationAccount: { type: "string", description: "Adyen donation charity account" },
          originalPspReference: { type: "string" },
          paymentMethod: { type: "object" },
          returnUrl: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["amount", "reference", "donationAccount", "originalPspReference"],
      },
    },
    {
      name: "list_stored_payment_methods",
      description: "List a shopper's stored payment methods (one-click reuse).",
      inputSchema: {
        type: "object",
        properties: {
          shopperReference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["shopperReference"],
      },
    },
    {
      name: "disable_stored_payment_method",
      description: "Delete a stored payment method (shopper opt-out).",
      inputSchema: {
        type: "object",
        properties: {
          recurringId: { type: "string", description: "Stored payment method id" },
          shopperReference: { type: "string" },
          merchantAccount: { type: "string" },
        },
        required: ["recurringId", "shopperReference"],
      },
    },
    {
      name: "create_session",
      description: "Create a Checkout session (used by Drop-in and Web Components to load methods + handle the full flow client-side).",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "object", description: "{ value, currency }" },
          reference: { type: "string" },
          returnUrl: { type: "string" },
          countryCode: { type: "string" },
          shopperReference: { type: "string" },
          shopperLocale: { type: "string" },
          merchantAccount: { type: "string" },
          expiresAt: { type: "string", description: "ISO-8601 timestamp" },
          allowedPaymentMethods: { type: "array" },
        },
        required: ["amount", "reference", "returnUrl", "countryCode"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "create_payment":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/payments", withMerchant(a)), null, 2) }] };
      case "payment_details":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/payments/details", a), null, 2) }] };
      case "capture_payment": {
        const pspRef = a.pspReference as string;
        const body = withMerchant({ ...a, pspReference: undefined });
        delete (body as { pspReference?: unknown }).pspReference;
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", `/payments/${pspRef}/captures`, body), null, 2) }] };
      }
      case "cancel_payment": {
        const pspRef = a.pspReference as string;
        const body = withMerchant({ ...a, pspReference: undefined });
        delete (body as { pspReference?: unknown }).pspReference;
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", `/payments/${pspRef}/cancels`, body), null, 2) }] };
      }
      case "refund_payment": {
        const pspRef = a.pspReference as string;
        const body = withMerchant({ ...a, pspReference: undefined });
        delete (body as { pspReference?: unknown }).pspReference;
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", `/payments/${pspRef}/refunds`, body), null, 2) }] };
      }
      case "reverse_payment": {
        const pspRef = a.pspReference as string;
        const body = withMerchant({ ...a, pspReference: undefined });
        delete (body as { pspReference?: unknown }).pspReference;
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", `/payments/${pspRef}/reversals`, body), null, 2) }] };
      }
      case "update_amount": {
        const pspRef = a.pspReference as string;
        const body = withMerchant({ ...a, pspReference: undefined });
        delete (body as { pspReference?: unknown }).pspReference;
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", `/payments/${pspRef}/amountUpdates`, body), null, 2) }] };
      }
      case "get_payment_methods":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/paymentMethods", withMerchant(a)), null, 2) }] };
      case "create_payment_link":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/paymentLinks", withMerchant(a)), null, 2) }] };
      case "get_payment_link":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("GET", `/paymentLinks/${a.linkId}`), null, 2) }] };
      case "update_payment_link":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("PATCH", `/paymentLinks/${a.linkId}`, { status: a.status }), null, 2) }] };
      case "create_donation":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/donations", withMerchant(a)), null, 2) }] };
      case "list_stored_payment_methods": {
        const params = new URLSearchParams();
        params.set("shopperReference", String(a.shopperReference));
        const merchant = (a.merchantAccount as string | undefined) ?? MERCHANT_ACCOUNT;
        if (merchant) params.set("merchantAccount", merchant);
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("GET", `/storedPaymentMethods?${params}`), null, 2) }] };
      }
      case "disable_stored_payment_method": {
        const params = new URLSearchParams();
        params.set("shopperReference", String(a.shopperReference));
        const merchant = (a.merchantAccount as string | undefined) ?? MERCHANT_ACCOUNT;
        if (merchant) params.set("merchantAccount", merchant);
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("DELETE", `/storedPaymentMethods/${a.recurringId}?${params}`), null, 2) }] };
      }
      case "create_session":
        return { content: [{ type: "text", text: JSON.stringify(await adyenRequest("POST", "/sessions", withMerchant(a)), null, 2) }] };
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
        const s = new Server({ name: "mcp-adyen", version: "0.1.0" }, { capabilities: { tools: {} } });
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
