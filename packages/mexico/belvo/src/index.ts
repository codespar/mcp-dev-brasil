#!/usr/bin/env node

/**
 * MCP Server for Belvo — Open Finance aggregator for LATAM
 * (Mexico, Argentina, Colombia).
 *
 * Tools:
 * - list_institutions: List available financial institutions
 * - create_link: Create a link to a financial institution
 * - list_links: List existing links
 * - get_accounts: Get accounts for a link
 * - get_balances: Get balances for a link
 * - get_transactions: Get transactions for a link
 * - get_owners: Get owner information for a link
 * - get_incomes: Get income data for a link
 * - get_tax_returns: Get tax returns for a link
 * - get_investments: Get investment portfolios for a link
 *
 * Environment:
 *   BELVO_SECRET_ID — Secret ID for authentication
 *   BELVO_SECRET_PASSWORD — Secret password for authentication
 *   BELVO_SANDBOX — Set to "true" to use sandbox environment
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SECRET_ID = process.env.BELVO_SECRET_ID || "";
const SECRET_PASSWORD = process.env.BELVO_SECRET_PASSWORD || "";
const IS_SANDBOX = process.env.BELVO_SANDBOX === "true";
const BASE_URL = IS_SANDBOX ? "https://sandbox.belvo.com" : "https://api.belvo.com";

async function belvoRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SECRET_ID && SECRET_PASSWORD) {
    headers["Authorization"] = `Basic ${Buffer.from(SECRET_ID + ":" + SECRET_PASSWORD).toString("base64")}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Belvo API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-belvo", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_institutions",
      description: "List available financial institutions",
      inputSchema: {
        type: "object",
        properties: {
          country_code: { type: "string", description: "Country code filter (MX, CO, AR)" },
          type: { type: "string", enum: ["bank", "fiscal", "gig", "employment"], description: "Institution type" },
          page: { type: "number", description: "Page number" },
          page_size: { type: "number", description: "Results per page" },
        },
      },
    },
    {
      name: "create_link",
      description: "Create a link to a financial institution",
      inputSchema: {
        type: "object",
        properties: {
          institution: { type: "string", description: "Institution name/code" },
          username: { type: "string", description: "User credentials - username" },
          password: { type: "string", description: "User credentials - password" },
          external_id: { type: "string", description: "External reference ID" },
          access_mode: { type: "string", enum: ["single", "recurrent"], description: "Access mode (default: single)" },
        },
        required: ["institution", "username", "password"],
      },
    },
    {
      name: "list_links",
      description: "List existing links",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number" },
          page_size: { type: "number", description: "Results per page" },
          institution: { type: "string", description: "Filter by institution" },
          access_mode: { type: "string", enum: ["single", "recurrent"], description: "Filter by access mode" },
        },
      },
    },
    {
      name: "get_accounts",
      description: "Get accounts for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries (default true)" },
        },
        required: ["link"],
      },
    },
    {
      name: "get_balances",
      description: "Get balances for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          account: { type: "string", description: "Account ID filter" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link", "date_from", "date_to"],
      },
    },
    {
      name: "get_transactions",
      description: "Get transactions for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          account: { type: "string", description: "Account ID filter" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link", "date_from", "date_to"],
      },
    },
    {
      name: "get_owners",
      description: "Get owner information for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link"],
      },
    },
    {
      name: "get_incomes",
      description: "Get income data for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link"],
      },
    },
    {
      name: "get_tax_returns",
      description: "Get tax returns for a link (fiscal institutions)",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          year_from: { type: "string", description: "Start year (YYYY)" },
          year_to: { type: "string", description: "End year (YYYY)" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link", "year_from", "year_to"],
      },
    },
    {
      name: "get_investments",
      description: "Get investment portfolios for a link",
      inputSchema: {
        type: "object",
        properties: {
          link: { type: "string", description: "Link ID" },
          token: { type: "string", description: "MFA token (if required)" },
          save_data: { type: "boolean", description: "Save data for future queries" },
        },
        required: ["link"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_institutions": {
        const params = new URLSearchParams();
        if (args?.country_code) params.set("country_code", String(args.country_code));
        if (args?.type) params.set("type", String(args.type));
        if (args?.page) params.set("page", String(args.page));
        if (args?.page_size) params.set("page_size", String(args.page_size));
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("GET", `/api/institutions/?${params}`), null, 2) }] };
      }
      case "create_link": {
        const payload: any = {
          institution: args?.institution,
          username: args?.username,
          password: args?.password,
        };
        if (args?.external_id) payload.external_id = args.external_id;
        if (args?.access_mode) payload.access_mode = args.access_mode;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/links/", payload), null, 2) }] };
      }
      case "list_links": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.page_size) params.set("page_size", String(args.page_size));
        if (args?.institution) params.set("institution", String(args.institution));
        if (args?.access_mode) params.set("access_mode", String(args.access_mode));
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("GET", `/api/links/?${params}`), null, 2) }] };
      }
      case "get_accounts": {
        const payload: any = { link: args?.link };
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/accounts/", payload), null, 2) }] };
      }
      case "get_balances": {
        const payload: any = {
          link: args?.link,
          date_from: args?.date_from,
          date_to: args?.date_to,
        };
        if (args?.account) payload.account = args.account;
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/balances/", payload), null, 2) }] };
      }
      case "get_transactions": {
        const payload: any = {
          link: args?.link,
          date_from: args?.date_from,
          date_to: args?.date_to,
        };
        if (args?.account) payload.account = args.account;
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/transactions/", payload), null, 2) }] };
      }
      case "get_owners": {
        const payload: any = { link: args?.link };
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/owners/", payload), null, 2) }] };
      }
      case "get_incomes": {
        const payload: any = { link: args?.link };
        if (args?.date_from) payload.date_from = args.date_from;
        if (args?.date_to) payload.date_to = args.date_to;
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/incomes/", payload), null, 2) }] };
      }
      case "get_tax_returns": {
        const payload: any = {
          link: args?.link,
          year_from: args?.year_from,
          year_to: args?.year_to,
        };
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/tax-returns/", payload), null, 2) }] };
      }
      case "get_investments": {
        const payload: any = { link: args?.link };
        if (args?.token) payload.token = args.token;
        if (args?.save_data !== undefined) payload.save_data = args.save_data;
        return { content: [{ type: "text", text: JSON.stringify(await belvoRequest("POST", "/api/investments/portfolios/", payload), null, 2) }] };
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
        const s = new Server({ name: "mcp-belvo", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
