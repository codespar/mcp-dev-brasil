#!/usr/bin/env node

/**
 * MCP Server for Correios — Brazilian postal service.
 *
 * Tools:
 * - track_package: Track a package by tracking code
 * - calculate_shipping: Calculate shipping rates
 * - get_delivery_time: Get estimated delivery time
 * - list_services: List available shipping services
 * - find_cep: Look up address by CEP
 * - create_prepost: Create a pre-posting order
 * - list_postal_codes: Search addresses by street/location
 * - create_collection: Schedule a package collection (pickup)
 * - get_collection: Get collection request details
 * - create_reverse: Create a reverse logistics (return) order
 * - get_reverse: Get reverse logistics order details
 *
 * Environment:
 *   CORREIOS_USER — Correios API username
 *   CORREIOS_TOKEN — Correios API token
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const USER = process.env.CORREIOS_USER || "";
const TOKEN = process.env.CORREIOS_TOKEN || "";
const BASE_URL = "https://api.correios.com.br";

let authToken = "";
let tokenExpiry = 0;

async function authenticate(): Promise<string> {
  if (authToken && Date.now() < tokenExpiry) return authToken;

  const res = await fetch(`${BASE_URL}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + btoa(`${USER}:${TOKEN}`),
    },
    body: JSON.stringify({ numero: USER }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Correios Auth ${res.status}: ${err}`);
  }
  const data = await res.json() as { token: string; expiraEm: string };
  authToken = data.token;
  tokenExpiry = new Date(data.expiraEm).getTime() - 60000;
  return authToken;
}

async function correiosRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await authenticate();
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
    throw new Error(`Correios API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-correios", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "track_package",
      description: "Track a package by Correios tracking code",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Tracking code (e.g. SS987654321BR)" },
        },
        required: ["code"],
      },
    },
    {
      name: "calculate_shipping",
      description: "Calculate shipping rates between two CEPs",
      inputSchema: {
        type: "object",
        properties: {
          cepOrigem: { type: "string", description: "Origin CEP" },
          cepDestino: { type: "string", description: "Destination CEP" },
          peso: { type: "number", description: "Weight in grams" },
          comprimento: { type: "number", description: "Length in cm" },
          altura: { type: "number", description: "Height in cm" },
          largura: { type: "number", description: "Width in cm" },
          servicos: {
            type: "array",
            items: { type: "string" },
            description: "Service codes (e.g. ['04014', '04510'])",
          },
        },
        required: ["cepOrigem", "cepDestino", "peso"],
      },
    },
    {
      name: "get_delivery_time",
      description: "Get estimated delivery time between two CEPs",
      inputSchema: {
        type: "object",
        properties: {
          cepOrigem: { type: "string", description: "Origin CEP" },
          cepDestino: { type: "string", description: "Destination CEP" },
          codigoServico: { type: "string", description: "Service code" },
        },
        required: ["cepOrigem", "cepDestino", "codigoServico"],
      },
    },
    {
      name: "list_services",
      description: "List available Correios shipping services",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "find_cep",
      description: "Look up address by CEP via Correios",
      inputSchema: {
        type: "object",
        properties: {
          cep: { type: "string", description: "CEP (8 digits)" },
        },
        required: ["cep"],
      },
    },
    {
      name: "create_prepost",
      description: "Create a pre-posting order for shipping",
      inputSchema: {
        type: "object",
        properties: {
          codigoServico: { type: "string", description: "Service code" },
          remetente: {
            type: "object",
            description: "Sender info (name, address, CEP, etc.)",
          },
          destinatario: {
            type: "object",
            description: "Recipient info (name, address, CEP, etc.)",
          },
          objetoPostal: {
            type: "object",
            description: "Package details (weight, dimensions, etc.)",
          },
        },
        required: ["codigoServico", "remetente", "destinatario", "objetoPostal"],
      },
    },
    {
      name: "list_postal_codes",
      description: "Search addresses by street name or location (returns matching CEPs)",
      inputSchema: {
        type: "object",
        properties: {
          endereco: { type: "string", description: "Street name or address to search" },
          uf: { type: "string", description: "State abbreviation (e.g. SP, RJ)" },
          localidade: { type: "string", description: "City name" },
        },
        required: ["endereco"],
      },
    },
    {
      name: "create_collection",
      description: "Schedule a package collection (pickup) from an address",
      inputSchema: {
        type: "object",
        properties: {
          codigoServico: { type: "string", description: "Service code" },
          remetente: { type: "object", description: "Sender info (name, address, CEP, phone)" },
          objeto: { type: "object", description: "Package details (weight, dimensions, quantity)" },
          dataColeta: { type: "string", description: "Collection date (YYYY-MM-DD)" },
          turno: { type: "string", enum: ["M", "T", "N"], description: "Collection shift (M=Morning, T=Afternoon, N=Night)" },
        },
        required: ["codigoServico", "remetente", "objeto", "dataColeta"],
      },
    },
    {
      name: "get_collection",
      description: "Get collection request details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Collection request ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_reverse",
      description: "Create a reverse logistics (return) order",
      inputSchema: {
        type: "object",
        properties: {
          codigoServico: { type: "string", description: "Service code" },
          remetente: { type: "object", description: "Original recipient (returning the package)" },
          destinatario: { type: "object", description: "Original sender (receiving the return)" },
          objeto: { type: "object", description: "Package details (weight, dimensions)" },
          motivo: { type: "string", description: "Return reason" },
        },
        required: ["codigoServico", "remetente", "destinatario", "objeto"],
      },
    },
    {
      name: "get_reverse",
      description: "Get reverse logistics order details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Reverse logistics order ID" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "track_package":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/srorastro/v1/objetos/${args?.code}?resultado=T`), null, 2) }] };
      case "calculate_shipping":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("POST", "/preco/v1/nacional", args), null, 2) }] };
      case "get_delivery_time": {
        const params = new URLSearchParams({
          cepOrigem: String(args?.cepOrigem),
          cepDestino: String(args?.cepDestino),
        });
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/prazo/v1/nacional/${args?.codigoServico}?${params}`), null, 2) }] };
      }
      case "list_services":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", "/preco/v1/servicos"), null, 2) }] };
      case "find_cep":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/cep/v2/enderecos/${args?.cep}`), null, 2) }] };
      case "create_prepost":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("POST", "/prepostagem/v1/prepostagens", args), null, 2) }] };
      case "list_postal_codes": {
        const params = new URLSearchParams({ endereco: String(args?.endereco) });
        if (args?.uf) params.set("uf", String(args.uf));
        if (args?.localidade) params.set("localidade", String(args.localidade));
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/cep/v2/enderecos?${params}`), null, 2) }] };
      }
      case "create_collection":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("POST", "/coleta/v1/coletas", args), null, 2) }] };
      case "get_collection":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/coleta/v1/coletas/${args?.id}`), null, 2) }] };
      case "create_reverse":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("POST", "/logisticareversa/v1/solicitacoes", args), null, 2) }] };
      case "get_reverse":
        return { content: [{ type: "text", text: JSON.stringify(await correiosRequest("GET", `/logisticareversa/v1/solicitacoes/${args?.id}`), null, 2) }] };
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
        const s = new Server({ name: "mcp-correios", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
