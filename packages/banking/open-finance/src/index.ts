#!/usr/bin/env node

/**
 * MCP Server for Open Finance Brasil — open banking standard.
 *
 * Tools:
 * - list_accounts: List customer accounts
 * - get_account_balance: Get account balance
 * - list_transactions: List account transactions
 * - get_consent: Get consent details
 * - create_consent: Create a new consent request
 * - list_credit_cards: List credit card accounts
 * - get_credit_card_transactions: Get credit card transactions
 * - list_investments: List investment products
 *
 * Environment:
 *   OPEN_FINANCE_BASE_URL — Institution API base URL
 *   OPEN_FINANCE_CLIENT_ID — OAuth2 client ID
 *   OPEN_FINANCE_CLIENT_SECRET — OAuth2 client secret
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.OPEN_FINANCE_BASE_URL || "";
const CLIENT_ID = process.env.OPEN_FINANCE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OPEN_FINANCE_CLIENT_SECRET || "";

let accessToken = "";
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "openid accounts credit-cards-accounts resources consents investments",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Open Finance OAuth ${res.status}: ${err}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function openFinanceRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Open Finance API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-open-finance", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_accounts",
      description: "List customer bank accounts via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID (required for data access)" },
          page: { type: "number", description: "Page number" },
          pageSize: { type: "number", description: "Items per page" },
        },
        required: ["consentId"],
      },
    },
    {
      name: "get_account_balance",
      description: "Get account balance via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
          accountId: { type: "string", description: "Account ID" },
        },
        required: ["consentId", "accountId"],
      },
    },
    {
      name: "list_transactions",
      description: "List account transactions via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
          accountId: { type: "string", description: "Account ID" },
          fromDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          toDate: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "number", description: "Page number" },
          pageSize: { type: "number", description: "Items per page" },
        },
        required: ["consentId", "accountId"],
      },
    },
    {
      name: "get_consent",
      description: "Get consent details by ID",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
        },
        required: ["consentId"],
      },
    },
    {
      name: "create_consent",
      description: "Create a new consent request for data access",
      inputSchema: {
        type: "object",
        properties: {
          permissions: {
            type: "array",
            description: "Requested permissions (e.g., ACCOUNTS_READ, ACCOUNTS_BALANCES_READ, ACCOUNTS_TRANSACTIONS_READ)",
            items: { type: "string" },
          },
          expirationDateTime: { type: "string", description: "Consent expiration (ISO 8601)" },
          transactionFromDateTime: { type: "string", description: "Transaction data start (ISO 8601)" },
          transactionToDateTime: { type: "string", description: "Transaction data end (ISO 8601)" },
        },
        required: ["permissions", "expirationDateTime"],
      },
    },
    {
      name: "list_credit_cards",
      description: "List credit card accounts via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
          page: { type: "number", description: "Page number" },
          pageSize: { type: "number", description: "Items per page" },
        },
        required: ["consentId"],
      },
    },
    {
      name: "get_credit_card_transactions",
      description: "Get credit card transactions via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
          creditCardAccountId: { type: "string", description: "Credit card account ID" },
          fromDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          toDate: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "number", description: "Page number" },
          pageSize: { type: "number", description: "Items per page" },
        },
        required: ["consentId", "creditCardAccountId"],
      },
    },
    {
      name: "list_investments",
      description: "List investment products via Open Finance",
      inputSchema: {
        type: "object",
        properties: {
          consentId: { type: "string", description: "Consent ID" },
          investmentType: { type: "string", enum: ["BANK_FIXED_INCOMES", "CREDIT_FIXED_INCOMES", "VARIABLE_INCOMES", "TREASURE_TITLES", "FUNDS"], description: "Investment type filter" },
          page: { type: "number", description: "Page number" },
          pageSize: { type: "number", description: "Items per page" },
        },
        required: ["consentId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;
  const args = rawArgs as Record<string, unknown> | undefined;

  try {
    switch (name) {
      case "list_accounts": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.pageSize) params.set("page-size", String(args.pageSize));
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/accounts/v2/accounts?${params}`), null, 2) }] };
      }
      case "get_account_balance":
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/accounts/v2/accounts/${args?.accountId}/balances`), null, 2) }] };
      case "list_transactions": {
        const params = new URLSearchParams();
        if (args?.fromDate) params.set("fromBookingDate", String(args.fromDate));
        if (args?.toDate) params.set("toBookingDate", String(args.toDate));
        if (args?.page) params.set("page", String(args.page));
        if (args?.pageSize) params.set("page-size", String(args.pageSize));
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/accounts/v2/accounts/${args?.accountId}/transactions?${params}`), null, 2) }] };
      }
      case "get_consent":
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/consents/v2/consents/${args?.consentId}`), null, 2) }] };
      case "create_consent": {
        const payload = {
          data: {
            permissions: args?.permissions,
            expirationDateTime: args?.expirationDateTime,
            transactionFromDateTime: args?.transactionFromDateTime,
            transactionToDateTime: args?.transactionToDateTime,
          },
        };
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("POST", "/open-banking/consents/v2/consents", payload), null, 2) }] };
      }
      case "list_credit_cards": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.pageSize) params.set("page-size", String(args.pageSize));
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/credit-cards-accounts/v2/accounts?${params}`), null, 2) }] };
      }
      case "get_credit_card_transactions": {
        const params = new URLSearchParams();
        if (args?.fromDate) params.set("fromTransactionDate", String(args.fromDate));
        if (args?.toDate) params.set("toTransactionDate", String(args.toDate));
        if (args?.page) params.set("page", String(args.page));
        if (args?.pageSize) params.set("page-size", String(args.pageSize));
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/credit-cards-accounts/v2/accounts/${args?.creditCardAccountId}/transactions?${params}`), null, 2) }] };
      }
      case "list_investments": {
        const investmentType = (args?.investmentType as string) || "BANK_FIXED_INCOMES";
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.pageSize) params.set("page-size", String(args.pageSize));
        return { content: [{ type: "text", text: JSON.stringify(await openFinanceRequest("GET", `/open-banking/investments/v1/${investmentType.toLowerCase().replace(/_/g, "-")}?${params}`), null, 2) }] };
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
        const s = new Server({ name: "mcp-open-finance", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
