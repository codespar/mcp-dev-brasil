#!/usr/bin/env node

/**
 * MCP Server for RD Station — Brazilian CRM and marketing automation.
 *
 * Tools:
 * - create_contact: Create a contact in RD Station
 * - update_contact: Update a contact by UUID
 * - get_contact: Get contact details by UUID or email
 * - list_contacts: List contacts with pagination
 * - create_event: Create a conversion event
 * - list_funnels: List sales funnels
 * - get_funnel: Get funnel details with stages
 * - create_opportunity: Create a sales opportunity
 *
 * Environment:
 *   RD_STATION_TOKEN — Bearer token from https://app.rdstation.com/
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const TOKEN = process.env.RD_STATION_TOKEN || "";
const BASE_URL = "https://api.rd.services";

async function rdStationRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RD Station API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-rd-station", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_contact",
      description: "Create a contact in RD Station CRM",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Contact email" },
          name: { type: "string", description: "Contact name" },
          job_title: { type: "string", description: "Job title" },
          phone: { type: "string", description: "Phone number" },
          company: { type: "string", description: "Company name" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to assign",
          },
          cf_custom_fields: { type: "object", description: "Custom fields (key-value)" },
        },
        required: ["email"],
      },
    },
    {
      name: "update_contact",
      description: "Update a contact by UUID",
      inputSchema: {
        type: "object",
        properties: {
          uuid: { type: "string", description: "Contact UUID" },
          name: { type: "string", description: "Updated name" },
          email: { type: "string", description: "Updated email" },
          job_title: { type: "string", description: "Updated job title" },
          phone: { type: "string", description: "Updated phone" },
          company: { type: "string", description: "Updated company" },
          tags: { type: "array", items: { type: "string" }, description: "Updated tags" },
        },
        required: ["uuid"],
      },
    },
    {
      name: "get_contact",
      description: "Get contact details by UUID or email",
      inputSchema: {
        type: "object",
        properties: {
          uuid: { type: "string", description: "Contact UUID" },
          email: { type: "string", description: "Contact email (alternative to UUID)" },
        },
      },
    },
    {
      name: "list_contacts",
      description: "List contacts with pagination",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (default 1)" },
          limit: { type: "number", description: "Results per page (default 25)" },
          query: { type: "string", description: "Search query" },
        },
      },
    },
    {
      name: "create_event",
      description: "Create a conversion event for a contact",
      inputSchema: {
        type: "object",
        properties: {
          event_type: { type: "string", enum: ["CONVERSION", "OPPORTUNITY", "SALE", "OPPORTUNITY_LOST"], description: "Event type" },
          event_family: { type: "string", enum: ["CDP"], description: "Event family" },
          payload: {
            type: "object",
            description: "Event payload",
            properties: {
              conversion_identifier: { type: "string", description: "Conversion identifier (e.g. form name)" },
              email: { type: "string", description: "Contact email" },
              name: { type: "string", description: "Contact name" },
              cf_custom_fields: { type: "object", description: "Custom fields" },
            },
            required: ["conversion_identifier", "email"],
          },
        },
        required: ["event_type", "event_family", "payload"],
      },
    },
    {
      name: "list_funnels",
      description: "List all sales funnels",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_funnel",
      description: "Get funnel details with stages",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Funnel ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_opportunity",
      description: "Create a sales opportunity in a funnel",
      inputSchema: {
        type: "object",
        properties: {
          deal_stage_id: { type: "string", description: "Stage ID in the funnel" },
          name: { type: "string", description: "Opportunity name" },
          contact_uuid: { type: "string", description: "Contact UUID" },
          amount: { type: "number", description: "Deal amount in cents" },
          prediction_date: { type: "string", description: "Expected close date (YYYY-MM-DD)" },
        },
        required: ["deal_stage_id", "name"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_contact":
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("POST", "/platform/contacts", args), null, 2) }] };
      case "update_contact": {
        const uuid = args?.uuid;
        const body = { ...args } as Record<string, unknown>;
        delete body.uuid;
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("PATCH", `/platform/contacts/${uuid}`, body), null, 2) }] };
      }
      case "get_contact": {
        if (args?.uuid) {
          return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("GET", `/platform/contacts/${args.uuid}`), null, 2) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("GET", `/platform/contacts/email:${args?.email}`), null, 2) }] };
      }
      case "list_contacts": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.query) params.set("query", String(args.query));
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("GET", `/platform/contacts?${params}`), null, 2) }] };
      }
      case "create_event":
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("POST", "/platform/events", args), null, 2) }] };
      case "list_funnels":
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("GET", "/platform/deal_pipelines"), null, 2) }] };
      case "get_funnel":
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("GET", `/platform/deal_pipelines/${args?.id}`), null, 2) }] };
      case "create_opportunity":
        return { content: [{ type: "text", text: JSON.stringify(await rdStationRequest("POST", "/platform/deals", args), null, 2) }] };
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
        const s = new Server({ name: "mcp-rd-station", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
