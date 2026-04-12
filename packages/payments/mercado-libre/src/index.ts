#!/usr/bin/env node

/**
 * MCP Server for Mercado Libre — largest LATAM marketplace.
 *
 * Tools:
 * - search_products: Search products in Mercado Libre
 * - get_product: Get product details by ID
 * - get_product_description: Get product description
 * - list_categories: List marketplace categories
 * - get_category: Get category details
 * - get_seller: Get seller information
 * - list_orders: List seller orders
 * - get_order: Get order details
 * - get_shipment: Get shipment tracking
 * - list_questions: List product questions
 * - answer_question: Answer a product question
 * - get_user: Get authenticated user info
 * - list_listings: List seller's active listings
 * - get_trends: Get trending searches by site
 *
 * Environment:
 *   MELI_ACCESS_TOKEN — OAuth2 access token
 *   MELI_SITE_ID      — Site ID (default: MLB for Brazil)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ACCESS_TOKEN = process.env.MELI_ACCESS_TOKEN || "";
const SITE_ID = process.env.MELI_SITE_ID || "MLB";
const BASE_URL = "https://api.mercadolibre.com";

async function meliRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ACCESS_TOKEN) headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mercado Libre API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-mercado-libre", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_products",
      description: "Search products in Mercado Libre marketplace",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          category: { type: "string", description: "Category ID filter" },
          minPrice: { type: "number", description: "Minimum price" },
          maxPrice: { type: "number", description: "Maximum price" },
          sort: { type: "string", enum: ["relevance", "price_asc", "price_desc"], description: "Sort order" },
          limit: { type: "number", description: "Results limit (max 50)" },
          offset: { type: "number", description: "Results offset" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_product",
      description: "Get detailed product information by item ID",
      inputSchema: {
        type: "object",
        properties: { itemId: { type: "string", description: "Item ID (e.g. MLB1234567890)" } },
        required: ["itemId"],
      },
    },
    {
      name: "get_product_description",
      description: "Get product description text by item ID",
      inputSchema: {
        type: "object",
        properties: { itemId: { type: "string", description: "Item ID" } },
        required: ["itemId"],
      },
    },
    {
      name: "list_categories",
      description: "List all marketplace categories for the site",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_category",
      description: "Get category details and children",
      inputSchema: {
        type: "object",
        properties: { categoryId: { type: "string", description: "Category ID" } },
        required: ["categoryId"],
      },
    },
    {
      name: "get_seller",
      description: "Get seller information and reputation",
      inputSchema: {
        type: "object",
        properties: { sellerId: { type: "string", description: "Seller ID" } },
        required: ["sellerId"],
      },
    },
    {
      name: "list_orders",
      description: "List seller orders with filters",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["paid", "shipped", "delivered", "cancelled"], description: "Order status" },
          sort: { type: "string", enum: ["date_asc", "date_desc"], description: "Sort order" },
          limit: { type: "number", description: "Results limit" },
          offset: { type: "number", description: "Results offset" },
        },
      },
    },
    {
      name: "get_order",
      description: "Get order details by ID",
      inputSchema: {
        type: "object",
        properties: { orderId: { type: "string", description: "Order ID" } },
        required: ["orderId"],
      },
    },
    {
      name: "get_shipment",
      description: "Get shipment tracking details",
      inputSchema: {
        type: "object",
        properties: { shipmentId: { type: "string", description: "Shipment ID" } },
        required: ["shipmentId"],
      },
    },
    {
      name: "list_questions",
      description: "List questions on a product listing",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "Item ID" },
          status: { type: "string", enum: ["unanswered", "answered"], description: "Filter by status" },
        },
        required: ["itemId"],
      },
    },
    {
      name: "answer_question",
      description: "Answer a question on a product listing",
      inputSchema: {
        type: "object",
        properties: {
          questionId: { type: "string", description: "Question ID" },
          text: { type: "string", description: "Answer text" },
        },
        required: ["questionId", "text"],
      },
    },
    {
      name: "get_user",
      description: "Get authenticated user information",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_listings",
      description: "List seller's active product listings",
      inputSchema: {
        type: "object",
        properties: {
          sellerId: { type: "string", description: "Seller ID (uses authenticated user if omitted)" },
          status: { type: "string", enum: ["active", "paused", "closed"], description: "Listing status" },
          limit: { type: "number", description: "Results limit" },
        },
      },
    },
    {
      name: "get_trends",
      description: "Get trending searches in the marketplace",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "Category ID (optional)" } },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_products": {
        const params = new URLSearchParams();
        params.set("q", String(args?.query || ""));
        if (args?.category) params.set("category", String(args.category));
        if (args?.minPrice) params.set("price", `${args.minPrice}-*`);
        if (args?.maxPrice) params.set("price", `*-${args.maxPrice}`);
        if (args?.sort) params.set("sort", String(args.sort));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/sites/${SITE_ID}/search?${params}`), null, 2) }] };
      }
      case "get_product":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/items/${args?.itemId}`), null, 2) }] };
      case "get_product_description":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/items/${args?.itemId}/description`), null, 2) }] };
      case "list_categories":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/sites/${SITE_ID}/categories`), null, 2) }] };
      case "get_category":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/categories/${args?.categoryId}`), null, 2) }] };
      case "get_seller":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/users/${args?.sellerId}`), null, 2) }] };
      case "list_orders": {
        const params = new URLSearchParams();
        if (args?.status) params.set("order.status", String(args.status));
        if (args?.sort) params.set("sort", String(args.sort));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/orders/search?${params}`), null, 2) }] };
      }
      case "get_order":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/orders/${args?.orderId}`), null, 2) }] };
      case "get_shipment":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/shipments/${args?.shipmentId}`), null, 2) }] };
      case "list_questions": {
        const params = new URLSearchParams();
        params.set("item", String(args?.itemId));
        if (args?.status) params.set("status", String(args.status));
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/questions/search?${params}`), null, 2) }] };
      }
      case "answer_question":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("POST", `/answers`, { question_id: args?.questionId, text: args?.text }), null, 2) }] };
      case "get_user":
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", "/users/me"), null, 2) }] };
      case "list_listings": {
        const userId = args?.sellerId || "me";
        const params = new URLSearchParams();
        if (args?.status) params.set("status", String(args.status));
        if (args?.limit) params.set("limit", String(args.limit));
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", `/users/${userId}/items/search?${params}`), null, 2) }] };
      }
      case "get_trends": {
        const path = args?.category ? `/trends/${SITE_ID}/${args.category}` : `/trends/${SITE_ID}`;
        return { content: [{ type: "text", text: JSON.stringify(await meliRequest("GET", path), null, 2) }] };
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
        const s = new Server({ name: "mcp-mercado-libre", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
