#!/usr/bin/env node

/**
 * MCP Server for Transak — fiat-to-crypto on/off-ramp.
 *
 * Transak is a global fiat<>crypto on/off-ramp covering ~170 countries with
 * multi-chain support (Ethereum, Solana, Polygon, BSC, Bitcoin, and more).
 * It is the natural peer/alternative to MoonPay. Agents use Transak to (a)
 * let a buyer fund an on-chain purchase with local fiat (card, bank transfer,
 * Apple/Google Pay, UPI, Pix where available), or (b) sell crypto back into
 * fiat payouts. Bundling MoonPay + Transak enables best-rate routing across
 * corridors — each has partner lists, pricing, and country coverage the
 * other doesn't.
 *
 * Tools (9):
 *   create_order             — POST /api/v2/orders  — create a BUY (fiat→crypto) or SELL (crypto→fiat) order
 *   get_order                — GET  /api/v2/orders/{id}
 *   list_orders              — GET  /api/v2/orders with filters (status, walletAddress, partnerOrderId)
 *   cancel_order             — POST /api/v2/orders/{id}/cancel
 *   get_quote                — GET  /api/v1/pricing/public/quotes (public, no auth; still takes partnerApiKey)
 *   list_fiat_currencies     — GET  /api/v2/currencies/fiat-currencies (public)
 *   list_crypto_currencies   — GET  /api/v2/currencies/crypto-currencies (public)
 *   list_payment_methods     — GET  /api/v2/currencies/payment-methods?fiatCurrency=X (public)
 *   get_partner_account      — GET  /api/v2/partner/me — partner profile / account info
 *
 * Authentication
 *   Transak's Partner API expects two headers on authenticated endpoints:
 *     api-secret  : the partner API secret (from the partner dashboard)
 *     access-token: a short-lived token minted by POSTing api-secret to the
 *                   partner refresh-token endpoint. This server sends api-secret
 *                   directly; if your partner tier requires an access-token,
 *                   mint one out-of-band and set it via the TRANSAK_ACCESS_TOKEN
 *                   env var (it will be added automatically when present).
 *   Public endpoints (quotes, currencies, payment-methods) need no auth
 *   beyond the partnerApiKey query param on /quotes.
 *
 * Environment
 *   TRANSAK_API_KEY          — partner API key (required; used as partnerApiKey)
 *   TRANSAK_API_SECRET       — partner API secret (required; sent as api-secret header)
 *   TRANSAK_ACCESS_TOKEN     — optional short-lived access token (sent as access-token header)
 *   TRANSAK_ENV              — 'staging' (default) | 'production'
 *
 * Docs: https://docs.transak.com
 *
 * NOTE: this package is 0.1.0-alpha.1 because several partner-order endpoint
 * paths were not independently verifiable against public docs at authoring
 * time. The public currency/quote endpoints were confirmed live. Treat
 * partner-order paths as the documented defaults and expect minor path
 * tweaks once you pair against a real partner dashboard.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.TRANSAK_API_KEY || "";
const API_SECRET = process.env.TRANSAK_API_SECRET || "";
const ACCESS_TOKEN = process.env.TRANSAK_ACCESS_TOKEN || "";
const ENV = (process.env.TRANSAK_ENV || "staging").toLowerCase();
const BASE_URL = ENV === "production" ? "https://api.transak.com" : "https://api-stg.transak.com";

type TransakRequestOpts = { requiresAuth?: boolean };

async function transakRequest(
  method: string,
  path: string,
  body?: unknown,
  opts: TransakRequestOpts = {}
): Promise<unknown> {
  const { requiresAuth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (requiresAuth) {
    if (API_SECRET) headers["api-secret"] = API_SECRET;
    if (ACCESS_TOKEN) headers["access-token"] = ACCESS_TOKEN;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transak API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-transak", version: "0.1.0-alpha.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_order",
      description: "Create a Transak order. Use isBuyOrSell='BUY' to onramp (fiat→crypto, funds delivered to walletAddress) or 'SELL' to offramp (crypto→fiat, payout to the linked bank account). Returns the order object with status, a widget/redirect URL if required, and the partner-side id.",
      inputSchema: {
        type: "object",
        properties: {
          walletAddress: { type: "string", description: "Destination (BUY) or source (SELL) crypto wallet address" },
          fiatCurrency: { type: "string", description: "ISO-4217 fiat currency code (USD, EUR, BRL, GBP, INR, etc)" },
          fiatAmount: { type: "number", description: "Fiat amount in major units. Either fiatAmount or cryptoAmount must be set." },
          cryptoCurrency: { type: "string", description: "Crypto ticker (ETH, USDC, USDT, BTC, SOL, MATIC, etc)" },
          cryptoAmount: { type: "number", description: "Crypto amount. Either fiatAmount or cryptoAmount must be set." },
          network: { type: "string", description: "Blockchain network (ethereum, polygon, bsc, solana, bitcoin, arbitrum, optimism, base, etc)" },
          isBuyOrSell: { type: "string", enum: ["BUY", "SELL"], description: "BUY = fiat→crypto onramp; SELL = crypto→fiat offramp" },
          email: { type: "string", description: "Buyer email (used for KYC + receipt)" },
          paymentMethod: { type: "string", description: "Method id from list_payment_methods (credit_debit_card, apple_pay, google_pay, sepa_bank_transfer, pix, upi, etc)" },
          partnerOrderId: { type: "string", description: "Merchant-side stable order id (echoed back on webhooks)" },
          partnerCustomerId: { type: "string", description: "Merchant-side stable user id (for returning users)" },
          redirectURL: { type: "string", description: "URL Transak redirects to after the hosted flow completes" },
          themeColor: { type: "string", description: "Optional hex color (no #) for hosted widget branding" },
        },
        required: ["walletAddress", "fiatCurrency", "cryptoCurrency", "network", "isBuyOrSell", "email", "partnerOrderId"],
      },
    },
    {
      name: "get_order",
      description: "Get a Transak order by its Transak order id. Returns full status, fiat/crypto amounts, fees, tx hash (once on-chain), and current state.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Transak order id (UUID)" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_orders",
      description: "List Transak orders for the partner account. Filter by status, walletAddress, or partnerOrderId. Use this to reconcile webhook-driven state or run a sweep on pending orders.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (AWAITING_PAYMENT_FROM_USER, PAYMENT_DONE_MARKED_BY_USER, PROCESSING, COMPLETED, CANCELLED, FAILED, EXPIRED, REFUNDED, ON_HOLD_PENDING_DELIVERY_FROM_TRANSAK)" },
          walletAddress: { type: "string", description: "Filter by destination/source wallet address" },
          partnerOrderId: { type: "string", description: "Filter by merchant-side order id" },
          limit: { type: "number", description: "Max rows to return" },
          startDate: { type: "string", description: "ISO-8601 lower bound (createdAt)" },
          endDate: { type: "string", description: "ISO-8601 upper bound (createdAt)" },
        },
      },
    },
    {
      name: "cancel_order",
      description: "Cancel a Transak order. Only works while the order is in a cancellable state (awaiting payment / pending). Completed or in-flight on-chain orders cannot be cancelled.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Transak order id to cancel" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_quote",
      description: "Get a fiat↔crypto price quote (public, no auth). Returns the rate, fees, min/max, delivery network, and the exact cryptoAmount the buyer receives for a given fiatAmount (or vice versa). Use this before calling create_order to show the user a price they can confirm.",
      inputSchema: {
        type: "object",
        properties: {
          fiatCurrency: { type: "string", description: "ISO-4217 fiat code (USD, EUR, BRL, GBP, INR, ...)" },
          cryptoCurrency: { type: "string", description: "Crypto ticker (ETH, USDC, BTC, SOL, ...)" },
          network: { type: "string", description: "Blockchain network (ethereum, polygon, solana, ...)" },
          fiatAmount: { type: "number", description: "Fiat amount. Either fiatAmount or cryptoAmount." },
          cryptoAmount: { type: "number", description: "Crypto amount. Either fiatAmount or cryptoAmount." },
          isBuyOrSell: { type: "string", enum: ["BUY", "SELL"], description: "BUY or SELL" },
          paymentMethod: { type: "string", description: "Optional payment method id to price that specific rail" },
        },
        required: ["fiatCurrency", "cryptoCurrency", "network", "isBuyOrSell"],
      },
    },
    {
      name: "list_fiat_currencies",
      description: "List all fiat currencies Transak supports, with per-currency payment methods, limits, and country restrictions. Public endpoint — safe to call without credentials. Use as a discovery/ discovery step before rendering a funding flow.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_crypto_currencies",
      description: "List all crypto assets Transak supports, including network, decimals, pay-in/pay-out eligibility, and jurisdictional restrictions (US state blocklists etc). Public endpoint.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_payment_methods",
      description: "List payment methods available for a given fiat currency (card, Apple Pay, Google Pay, SEPA, UPI, Pix, wire, etc) with min/max amounts and processing time. Public endpoint. Use to dynamically build a funding-method picker per corridor.",
      inputSchema: {
        type: "object",
        properties: {
          fiatCurrency: { type: "string", description: "ISO-4217 fiat code (USD, EUR, BRL, ...)" },
        },
        required: ["fiatCurrency"],
      },
    },
    {
      name: "get_partner_account",
      description: "Get the authenticated partner's account profile (name, api key info, configured webhooks, default currencies). Useful for debugging which partner credentials the server is using.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_order": {
        const body: Record<string, unknown> = { ...args, partnerApiKey: API_KEY };
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("POST", "/api/v2/orders", body), null, 2) }] };
      }
      case "get_order":
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", `/api/v2/orders/${encodeURIComponent(String(args?.id ?? ""))}`), null, 2) }] };
      case "list_orders": {
        const qs = new URLSearchParams();
        if (args?.status) qs.set("status", String(args.status));
        if (args?.walletAddress) qs.set("walletAddress", String(args.walletAddress));
        if (args?.partnerOrderId) qs.set("partnerOrderId", String(args.partnerOrderId));
        if (args?.limit !== undefined) qs.set("limit", String(args.limit));
        if (args?.startDate) qs.set("startDate", String(args.startDate));
        if (args?.endDate) qs.set("endDate", String(args.endDate));
        const q = qs.toString();
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", `/api/v2/orders${q ? `?${q}` : ""}`), null, 2) }] };
      }
      case "cancel_order":
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("POST", `/api/v2/orders/${encodeURIComponent(String(args?.id ?? ""))}/cancel`), null, 2) }] };
      case "get_quote": {
        const qs = new URLSearchParams();
        qs.set("partnerApiKey", API_KEY);
        qs.set("fiatCurrency", String(args?.fiatCurrency ?? ""));
        qs.set("cryptoCurrency", String(args?.cryptoCurrency ?? ""));
        qs.set("network", String(args?.network ?? ""));
        qs.set("isBuyOrSell", String(args?.isBuyOrSell ?? "BUY"));
        if (args?.fiatAmount !== undefined) qs.set("fiatAmount", String(args.fiatAmount));
        if (args?.cryptoAmount !== undefined) qs.set("cryptoAmount", String(args.cryptoAmount));
        if (args?.paymentMethod) qs.set("paymentMethod", String(args.paymentMethod));
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", `/api/v1/pricing/public/quotes?${qs.toString()}`, undefined, { requiresAuth: false }), null, 2) }] };
      }
      case "list_fiat_currencies":
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", "/api/v2/currencies/fiat-currencies", undefined, { requiresAuth: false }), null, 2) }] };
      case "list_crypto_currencies":
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", "/api/v2/currencies/crypto-currencies", undefined, { requiresAuth: false }), null, 2) }] };
      case "list_payment_methods": {
        const fiat = encodeURIComponent(String(args?.fiatCurrency ?? ""));
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", `/api/v2/currencies/payment-methods?fiatCurrency=${fiat}`, undefined, { requiresAuth: false }), null, 2) }] };
      }
      case "get_partner_account":
        return { content: [{ type: "text", text: JSON.stringify(await transakRequest("GET", "/api/v2/partner/me"), null, 2) }] };
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
        const s = new Server({ name: "mcp-transak", version: "0.1.0-alpha.1" }, { capabilities: { tools: {} } });
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
