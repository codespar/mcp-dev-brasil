#!/usr/bin/env node

/**
 * MCP Server for FacturAPI — Mexican CFDI e-invoicing (equivalent to Brazil's NFe).
 *
 * Tools:
 * - create_invoice: Create a CFDI invoice
 * - get_invoice: Get invoice by ID
 * - list_invoices: List invoices with filters
 * - cancel_invoice: Cancel an invoice
 * - download_invoice_pdf: Download invoice as PDF
 * - download_invoice_xml: Download invoice as XML
 * - create_customer: Create a customer
 * - get_customer: Get customer by ID
 * - list_products: List products
 * - create_product: Create a product
 *
 * Environment:
 *   FACTURAPI_API_KEY — API key for authentication
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.FACTURAPI_API_KEY || "";
const BASE_URL = "https://www.facturapi.io/v2";

async function facturRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FacturAPI ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-facturapi", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_invoice",
      description: "Create a CFDI invoice",
      inputSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer ID" },
          items: {
            type: "array",
            description: "Invoice line items",
            items: {
              type: "object",
              properties: {
                product: { type: "string", description: "Product ID or inline product object" },
                quantity: { type: "number", description: "Quantity" },
              },
              required: ["quantity"],
            },
          },
          payment_form: { type: "string", description: "SAT payment form code (e.g. 01=cash, 03=transfer, 04=credit_card)" },
          payment_method: { type: "string", description: "PUE (single payment) or PPD (deferred)" },
          use: { type: "string", description: "CFDI use code (e.g. G01=acquisition, G03=expenses, P01=to_be_defined)" },
          series: { type: "string", description: "Invoice series" },
          folio_number: { type: "number", description: "Invoice folio number" },
        },
        required: ["customer", "items", "payment_form"],
      },
    },
    {
      name: "get_invoice",
      description: "Get invoice by ID",
      inputSchema: {
        type: "object",
        properties: { invoiceId: { type: "string", description: "Invoice ID" } },
        required: ["invoiceId"],
      },
    },
    {
      name: "list_invoices",
      description: "List invoices with filters",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["valid", "canceled"], description: "Invoice status" },
          customer: { type: "string", description: "Customer ID filter" },
          date_from: { type: "string", description: "Start date (ISO 8601)" },
          date_to: { type: "string", description: "End date (ISO 8601)" },
          limit: { type: "number", description: "Results limit" },
          page: { type: "number", description: "Page number" },
        },
      },
    },
    {
      name: "cancel_invoice",
      description: "Cancel an invoice",
      inputSchema: {
        type: "object",
        properties: {
          invoiceId: { type: "string", description: "Invoice ID" },
          motive: { type: "string", enum: ["01", "02", "03", "04"], description: "Cancellation motive (01=with errors, 02=not executed, 03=related, 04=nominative)" },
          substitution: { type: "string", description: "Substitution invoice ID (required for motive 01)" },
        },
        required: ["invoiceId", "motive"],
      },
    },
    {
      name: "download_invoice_pdf",
      description: "Download invoice as PDF (returns download URL)",
      inputSchema: {
        type: "object",
        properties: { invoiceId: { type: "string", description: "Invoice ID" } },
        required: ["invoiceId"],
      },
    },
    {
      name: "download_invoice_xml",
      description: "Download invoice as XML (returns download URL)",
      inputSchema: {
        type: "object",
        properties: { invoiceId: { type: "string", description: "Invoice ID" } },
        required: ["invoiceId"],
      },
    },
    {
      name: "create_customer",
      description: "Create a customer for invoicing",
      inputSchema: {
        type: "object",
        properties: {
          legal_name: { type: "string", description: "Legal name (razon social)" },
          tax_id: { type: "string", description: "RFC (tax ID)" },
          tax_system: { type: "string", description: "SAT tax system code (e.g. 601=General, 612=Persona Fisica)" },
          email: { type: "string", description: "Customer email" },
          zip: { type: "string", description: "Postal code" },
        },
        required: ["legal_name", "tax_id", "tax_system", "zip"],
      },
    },
    {
      name: "get_customer",
      description: "Get customer by ID",
      inputSchema: {
        type: "object",
        properties: { customerId: { type: "string", description: "Customer ID" } },
        required: ["customerId"],
      },
    },
    {
      name: "list_products",
      description: "List products",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Results limit" },
          page: { type: "number", description: "Page number" },
        },
      },
    },
    {
      name: "create_product",
      description: "Create a product for invoicing",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "Product description" },
          product_key: { type: "string", description: "SAT product key code" },
          price: { type: "number", description: "Unit price" },
          tax_included: { type: "boolean", description: "Whether price includes tax" },
          unit_key: { type: "string", description: "SAT unit key (e.g. E48=service, H87=piece)" },
          unit_name: { type: "string", description: "Unit name" },
        },
        required: ["description", "product_key", "price"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_invoice":
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("POST", "/invoices", {
          customer: args?.customer,
          items: args?.items,
          payment_form: args?.payment_form,
          payment_method: args?.payment_method,
          use: args?.use,
          series: args?.series,
          folio_number: args?.folio_number,
        }), null, 2) }] };
      case "get_invoice":
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("GET", `/invoices/${args?.invoiceId}`), null, 2) }] };
      case "list_invoices": {
        const params = new URLSearchParams();
        if (args?.status) params.set("status", String(args.status));
        if (args?.customer) params.set("customer", String(args.customer));
        if (args?.date_from) params.set("date[gte]", String(args.date_from));
        if (args?.date_to) params.set("date[lte]", String(args.date_to));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.page) params.set("page", String(args.page));
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("GET", `/invoices?${params}`), null, 2) }] };
      }
      case "cancel_invoice": {
        const body: any = { motive: args?.motive };
        if (args?.substitution) body.substitution = args.substitution;
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("DELETE", `/invoices/${args?.invoiceId}`, body), null, 2) }] };
      }
      case "download_invoice_pdf":
        return { content: [{ type: "text", text: JSON.stringify({ url: `${BASE_URL}/invoices/${args?.invoiceId}/pdf`, note: "Use this URL with your API key to download the PDF" }, null, 2) }] };
      case "download_invoice_xml":
        return { content: [{ type: "text", text: JSON.stringify({ url: `${BASE_URL}/invoices/${args?.invoiceId}/xml`, note: "Use this URL with your API key to download the XML" }, null, 2) }] };
      case "create_customer":
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("POST", "/customers", {
          legal_name: args?.legal_name,
          tax_id: args?.tax_id,
          tax_system: args?.tax_system,
          email: args?.email,
          address: { zip: args?.zip },
        }), null, 2) }] };
      case "get_customer":
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("GET", `/customers/${args?.customerId}`), null, 2) }] };
      case "list_products": {
        const params = new URLSearchParams();
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.page) params.set("page", String(args.page));
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("GET", `/products?${params}`), null, 2) }] };
      }
      case "create_product":
        return { content: [{ type: "text", text: JSON.stringify(await facturRequest("POST", "/products", {
          description: args?.description,
          product_key: args?.product_key,
          price: args?.price,
          tax_included: args?.tax_included,
          unit_key: args?.unit_key,
          unit_name: args?.unit_name,
        }), null, 2) }] };
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
        const s = new Server({ name: "mcp-facturapi", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
