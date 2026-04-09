#!/usr/bin/env node

/**
 * MCP Server for Pix BCB — official Banco Central do Brasil Pix API.
 *
 * Wraps the standard Pix API spec (https://bacen.github.io/pix-api/).
 * Each PSP (bank) provides their own base URL and mTLS certificate.
 *
 * Tools:
 * - create_cob: Create an immediate Pix charge (cobranca imediata)
 * - get_cob: Get charge details by txid
 * - list_cobs: List immediate charges with filters
 * - create_cobv: Create a due-date Pix charge (cobranca com vencimento)
 * - get_pix: Get a received Pix payment by e2eid
 * - list_pix_received: List received Pix payments
 * - create_pix_key: Register a Pix key (DICT)
 * - get_pix_key: Look up a Pix key
 *
 * Environment:
 *   PIX_BASE_URL — PSP API base URL (e.g., https://pix.example.com/api/v2)
 *   PIX_CLIENT_ID — OAuth2 client ID
 *   PIX_CLIENT_SECRET — OAuth2 client secret
 *   PIX_CERT_PATH — Path to mTLS certificate (.pem or .p12)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { Agent } from "node:https";

const BASE_URL = process.env.PIX_BASE_URL || "";
const CLIENT_ID = process.env.PIX_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PIX_CLIENT_SECRET || "";
const CERT_PATH = process.env.PIX_CERT_PATH || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

function createHttpsAgent(): Agent | undefined {
  if (!CERT_PATH) return undefined;
  try {
    const cert = readFileSync(CERT_PATH);
    return new Agent({ pfx: cert, passphrase: "" });
  } catch {
    // Try as PEM
    try {
      const cert = readFileSync(CERT_PATH);
      return new Agent({ cert, key: cert });
    } catch {
      console.error(`Warning: could not load certificate from ${CERT_PATH}`);
      return undefined;
    }
  }
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pix OAuth2 token error ${res.status}: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

async function pixRequest(method: string, path: string, body?: unknown): Promise<unknown> {
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
    throw new Error(`Pix API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-pix-bcb", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_cob",
      description: "Create an immediate Pix charge (cobranca imediata)",
      inputSchema: {
        type: "object",
        properties: {
          txid: { type: "string", description: "Transaction ID (26-35 alphanumeric chars, optional — auto-generated if omitted)" },
          calendario: {
            type: "object",
            description: "Charge timing",
            properties: {
              expiracao: { type: "number", description: "Expiration in seconds (default: 3600)" },
            },
          },
          devedor: {
            type: "object",
            description: "Debtor (payer) info",
            properties: {
              cpf: { type: "string", description: "CPF (11 digits)" },
              cnpj: { type: "string", description: "CNPJ (14 digits)" },
              nome: { type: "string", description: "Payer name" },
            },
          },
          valor: {
            type: "object",
            description: "Charge amount",
            properties: {
              original: { type: "string", description: "Amount in BRL (e.g., '100.00')" },
            },
            required: ["original"],
          },
          chave: { type: "string", description: "Receiver Pix key" },
          solicitacaoPagador: { type: "string", description: "Message to payer (max 140 chars)" },
          infoAdicionais: {
            type: "array",
            description: "Additional info fields",
            items: {
              type: "object",
              properties: {
                nome: { type: "string", description: "Field name" },
                valor: { type: "string", description: "Field value" },
              },
              required: ["nome", "valor"],
            },
          },
        },
        required: ["valor", "chave"],
      },
    },
    {
      name: "get_cob",
      description: "Get immediate charge details by txid",
      inputSchema: {
        type: "object",
        properties: {
          txid: { type: "string", description: "Transaction ID" },
          revisao: { type: "number", description: "Revision number (optional)" },
        },
        required: ["txid"],
      },
    },
    {
      name: "list_cobs",
      description: "List immediate charges with date range and filters",
      inputSchema: {
        type: "object",
        properties: {
          inicio: { type: "string", description: "Start date (ISO 8601, e.g., 2024-01-01T00:00:00Z)" },
          fim: { type: "string", description: "End date (ISO 8601)" },
          cpf: { type: "string", description: "Filter by payer CPF" },
          cnpj: { type: "string", description: "Filter by payer CNPJ" },
          status: { type: "string", enum: ["ATIVA", "CONCLUIDA", "REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"], description: "Filter by status" },
          paginacao_paginaAtual: { type: "number", description: "Page number (0-based)" },
          paginacao_itensPorPagina: { type: "number", description: "Items per page" },
        },
        required: ["inicio", "fim"],
      },
    },
    {
      name: "create_cobv",
      description: "Create a due-date Pix charge (cobranca com vencimento)",
      inputSchema: {
        type: "object",
        properties: {
          txid: { type: "string", description: "Transaction ID (26-35 alphanumeric chars)" },
          calendario: {
            type: "object",
            description: "Charge timing with due date",
            properties: {
              dataDeVencimento: { type: "string", description: "Due date (YYYY-MM-DD)" },
              validadeAposVencimento: { type: "number", description: "Days valid after due date" },
            },
            required: ["dataDeVencimento"],
          },
          devedor: {
            type: "object",
            description: "Debtor (payer) info — required for cobv",
            properties: {
              cpf: { type: "string", description: "CPF (11 digits)" },
              cnpj: { type: "string", description: "CNPJ (14 digits)" },
              nome: { type: "string", description: "Payer name" },
            },
            required: ["nome"],
          },
          valor: {
            type: "object",
            description: "Charge amount",
            properties: {
              original: { type: "string", description: "Amount in BRL (e.g., '100.00')" },
            },
            required: ["original"],
          },
          chave: { type: "string", description: "Receiver Pix key" },
          solicitacaoPagador: { type: "string", description: "Message to payer (max 140 chars)" },
        },
        required: ["txid", "calendario", "devedor", "valor", "chave"],
      },
    },
    {
      name: "get_pix",
      description: "Get a received Pix payment by e2eid (endToEndId)",
      inputSchema: {
        type: "object",
        properties: {
          e2eid: { type: "string", description: "End-to-end ID of the Pix payment" },
        },
        required: ["e2eid"],
      },
    },
    {
      name: "list_pix_received",
      description: "List received Pix payments within a date range",
      inputSchema: {
        type: "object",
        properties: {
          inicio: { type: "string", description: "Start date (ISO 8601)" },
          fim: { type: "string", description: "End date (ISO 8601)" },
          txid: { type: "string", description: "Filter by txid" },
          cpf: { type: "string", description: "Filter by payer CPF" },
          cnpj: { type: "string", description: "Filter by payer CNPJ" },
          paginacao_paginaAtual: { type: "number", description: "Page number (0-based)" },
          paginacao_itensPorPagina: { type: "number", description: "Items per page" },
        },
        required: ["inicio", "fim"],
      },
    },
    {
      name: "create_pix_key",
      description: "Register a Pix key in DICT (requires PSP support)",
      inputSchema: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"], description: "Key type (EVP = random key)" },
          chave: { type: "string", description: "Key value (omit for EVP to auto-generate)" },
        },
        required: ["tipo"],
      },
    },
    {
      name: "get_pix_key",
      description: "Look up a Pix key in DICT",
      inputSchema: {
        type: "object",
        properties: {
          chave: { type: "string", description: "Pix key to look up" },
        },
        required: ["chave"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_cob": {
        const { txid, ...cobBody } = args as Record<string, unknown>;
        if (txid) {
          return { content: [{ type: "text", text: JSON.stringify(await pixRequest("PUT", `/cob/${txid}`, cobBody), null, 2) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("POST", "/cob", cobBody), null, 2) }] };
      }
      case "get_cob": {
        const params = new URLSearchParams();
        if (args?.revisao) params.set("revisao", String(args.revisao));
        const qs = params.toString() ? `?${params}` : "";
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("GET", `/cob/${args?.txid}${qs}`), null, 2) }] };
      }
      case "list_cobs": {
        const params = new URLSearchParams();
        params.set("inicio", String(args?.inicio));
        params.set("fim", String(args?.fim));
        if (args?.cpf) params.set("cpf", String(args.cpf));
        if (args?.cnpj) params.set("cnpj", String(args.cnpj));
        if (args?.status) params.set("status", String(args.status));
        if (args?.paginacao_paginaAtual != null) params.set("paginacao.paginaAtual", String(args.paginacao_paginaAtual));
        if (args?.paginacao_itensPorPagina != null) params.set("paginacao.itensPorPagina", String(args.paginacao_itensPorPagina));
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("GET", `/cob?${params}`), null, 2) }] };
      }
      case "create_cobv": {
        const { txid, ...cobvBody } = args as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("PUT", `/cobv/${txid}`, cobvBody), null, 2) }] };
      }
      case "get_pix":
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("GET", `/pix/${args?.e2eid}`), null, 2) }] };
      case "list_pix_received": {
        const params = new URLSearchParams();
        params.set("inicio", String(args?.inicio));
        params.set("fim", String(args?.fim));
        if (args?.txid) params.set("txid", String(args.txid));
        if (args?.cpf) params.set("cpf", String(args.cpf));
        if (args?.cnpj) params.set("cnpj", String(args.cnpj));
        if (args?.paginacao_paginaAtual != null) params.set("paginacao.paginaAtual", String(args.paginacao_paginaAtual));
        if (args?.paginacao_itensPorPagina != null) params.set("paginacao.itensPorPagina", String(args.paginacao_itensPorPagina));
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("GET", `/pix?${params}`), null, 2) }] };
      }
      case "create_pix_key":
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("POST", "/dict/keys", args), null, 2) }] };
      case "get_pix_key":
        return { content: [{ type: "text", text: JSON.stringify(await pixRequest("GET", `/dict/keys/${encodeURIComponent(String(args?.chave))}`), null, 2) }] };
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
        const s = new Server({ name: "mcp-pix-bcb", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
