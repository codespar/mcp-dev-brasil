#!/usr/bin/env node

/**
 * MCP Server for Nuvem Fiscal — Brazilian fiscal document platform.
 *
 * Tools:
 * - create_nfe: Create a NF-e (nota fiscal eletrônica)
 * - get_nfe: Get NF-e details by ID
 * - cancel_nfe: Cancel a NF-e
 * - create_nfse: Create a NFS-e (nota fiscal de serviço)
 * - get_nfse: Get NFS-e details by ID
 * - cancel_nfse: Cancel a NFS-e
 * - create_nfce: Create a NFC-e (nota fiscal de consumidor)
 * - consult_cnpj: Consult company data by CNPJ
 * - consult_cep: Consult address by CEP
 * - register_company: Register a company
 * - create_cte: Create a CT-e (conhecimento de transporte eletrônico)
 * - get_cte: Get CT-e details by ID
 * - cancel_cte: Cancel a CT-e
 * - create_mdfe: Create a MDF-e (manifesto de documentos fiscais)
 * - get_nfe_events: Get events for a NF-e
 *
 * Environment:
 *   NUVEM_FISCAL_CLIENT_ID — OAuth2 client ID
 *   NUVEM_FISCAL_CLIENT_SECRET — OAuth2 client secret
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CLIENT_ID = process.env.NUVEM_FISCAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.NUVEM_FISCAL_CLIENT_SECRET || "";
const BASE_URL = "https://api.nuvemfiscal.com.br";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token;
  }

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "nfe nfse nfce cte mdfe empresa cnpj cep",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token request failed ${res.status}: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.access_token;
}

async function nuvemFiscalRequest(method: string, path: string, body?: unknown): Promise<unknown> {
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
    throw new Error(`Nuvem Fiscal API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-nuvem-fiscal", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_nfe",
      description: "Create a NF-e (nota fiscal eletrônica)",
      inputSchema: {
        type: "object",
        properties: {
          ambiente: { type: "number", enum: [1, 2], description: "1=Produção, 2=Homologação" },
          natureza_operacao: { type: "string", description: "Nature of the operation (e.g. 'Venda de mercadoria')" },
          emitente: { type: "object", description: "Issuer data (CNPJ, IE, address, etc.)" },
          destinatario: { type: "object", description: "Recipient data (CPF/CNPJ, address, etc.)" },
          itens: { type: "array", description: "Array of items (product, quantity, value, taxes)" },
          pagamento: { type: "object", description: "Payment information" },
        },
        required: ["ambiente", "natureza_operacao", "emitente", "destinatario", "itens", "pagamento"],
      },
    },
    {
      name: "get_nfe",
      description: "Get NF-e details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "NF-e ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "cancel_nfe",
      description: "Cancel a NF-e",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "NF-e ID" },
          justificativa: { type: "string", description: "Cancellation reason (min 15 chars)" },
        },
        required: ["id", "justificativa"],
      },
    },
    {
      name: "create_nfse",
      description: "Create a NFS-e (nota fiscal de serviço eletrônica)",
      inputSchema: {
        type: "object",
        properties: {
          ambiente: { type: "number", enum: [1, 2], description: "1=Produção, 2=Homologação" },
          prestador: { type: "object", description: "Service provider data (CNPJ, IM, address)" },
          tomador: { type: "object", description: "Service taker data (CPF/CNPJ, address)" },
          servico: { type: "object", description: "Service details (code, description, value, taxes)" },
        },
        required: ["ambiente", "prestador", "tomador", "servico"],
      },
    },
    {
      name: "get_nfse",
      description: "Get NFS-e details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "NFS-e ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "cancel_nfse",
      description: "Cancel a NFS-e",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "NFS-e ID" },
          justificativa: { type: "string", description: "Cancellation reason" },
        },
        required: ["id", "justificativa"],
      },
    },
    {
      name: "create_nfce",
      description: "Create a NFC-e (nota fiscal de consumidor eletrônica)",
      inputSchema: {
        type: "object",
        properties: {
          ambiente: { type: "number", enum: [1, 2], description: "1=Produção, 2=Homologação" },
          emitente: { type: "object", description: "Issuer data (CNPJ, IE, address)" },
          itens: { type: "array", description: "Array of items (product, quantity, value, taxes)" },
          pagamento: { type: "object", description: "Payment information" },
        },
        required: ["ambiente", "emitente", "itens", "pagamento"],
      },
    },
    {
      name: "consult_cnpj",
      description: "Consult company data by CNPJ number",
      inputSchema: {
        type: "object",
        properties: {
          cnpj: { type: "string", description: "CNPJ number (14 digits, numbers only)" },
        },
        required: ["cnpj"],
      },
    },
    {
      name: "consult_cep",
      description: "Consult address by CEP (postal code)",
      inputSchema: {
        type: "object",
        properties: {
          cep: { type: "string", description: "CEP number (8 digits, numbers only)" },
        },
        required: ["cep"],
      },
    },
    {
      name: "register_company",
      description: "Register a company in Nuvem Fiscal",
      inputSchema: {
        type: "object",
        properties: {
          cpf_cnpj: { type: "string", description: "CPF or CNPJ of the company" },
          nome_razao_social: { type: "string", description: "Company legal name" },
          nome_fantasia: { type: "string", description: "Trade name" },
          inscricao_estadual: { type: "string", description: "State registration (IE)" },
          inscricao_municipal: { type: "string", description: "Municipal registration (IM)" },
          endereco: { type: "object", description: "Address data (logradouro, numero, bairro, cidade, uf, cep)" },
        },
        required: ["cpf_cnpj", "nome_razao_social"],
      },
    },
    {
      name: "create_cte",
      description: "Create a CT-e (conhecimento de transporte eletrônico)",
      inputSchema: {
        type: "object",
        properties: {
          ambiente: { type: "number", enum: [1, 2], description: "1=Produção, 2=Homologação" },
          tipo: { type: "number", enum: [0, 1, 2, 3], description: "0=Normal, 1=Complementar, 2=Anulação, 3=Substituto" },
          emitente: { type: "object", description: "Issuer data (CNPJ, IE, address)" },
          remetente: { type: "object", description: "Sender data (CPF/CNPJ, address)" },
          destinatario: { type: "object", description: "Recipient data (CPF/CNPJ, address)" },
          valores: { type: "object", description: "Service values (total, receive, taxes)" },
          modal: { type: "string", enum: ["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario"], description: "Transport mode" },
        },
        required: ["ambiente", "emitente", "remetente", "destinatario", "valores"],
      },
    },
    {
      name: "get_cte",
      description: "Get CT-e details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "CT-e ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "cancel_cte",
      description: "Cancel a CT-e",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "CT-e ID" },
          justificativa: { type: "string", description: "Cancellation reason (min 15 chars)" },
        },
        required: ["id", "justificativa"],
      },
    },
    {
      name: "create_mdfe",
      description: "Create a MDF-e (manifesto de documentos fiscais eletrônico)",
      inputSchema: {
        type: "object",
        properties: {
          ambiente: { type: "number", enum: [1, 2], description: "1=Produção, 2=Homologação" },
          emitente: { type: "object", description: "Issuer data (CNPJ, IE, address)" },
          modal: { type: "string", enum: ["rodoviario", "aereo", "aquaviario", "ferroviario"], description: "Transport mode" },
          documentos: { type: "array", description: "Array of linked documents (NF-e/CT-e keys)" },
          percurso: { type: "array", description: "Route UFs (array of state codes)" },
          veiculos: { type: "object", description: "Vehicle data (plate, RNTRC, etc.)" },
        },
        required: ["ambiente", "emitente", "modal", "documentos"],
      },
    },
    {
      name: "get_nfe_events",
      description: "Get events for a NF-e (cancellations, corrections, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "NF-e ID" },
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
      case "create_nfe":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/nfe", args), null, 2) }] };
      case "get_nfe":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/nfe/${args?.id}`), null, 2) }] };
      case "cancel_nfe":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", `/nfe/${args?.id}/cancelamento`, { justificativa: args?.justificativa }), null, 2) }] };
      case "create_nfse":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/nfse", args), null, 2) }] };
      case "get_nfse":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/nfse/${args?.id}`), null, 2) }] };
      case "cancel_nfse":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", `/nfse/${args?.id}/cancelamento`, { justificativa: args?.justificativa }), null, 2) }] };
      case "create_nfce":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/nfce", args), null, 2) }] };
      case "consult_cnpj":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/cnpj/${args?.cnpj}`), null, 2) }] };
      case "consult_cep":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/cep/${args?.cep}`), null, 2) }] };
      case "register_company":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/empresas", args), null, 2) }] };
      case "create_cte":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/cte", args), null, 2) }] };
      case "get_cte":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/cte/${args?.id}`), null, 2) }] };
      case "cancel_cte":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", `/cte/${args?.id}/cancelamento`, { justificativa: args?.justificativa }), null, 2) }] };
      case "create_mdfe":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("POST", "/mdfe", args), null, 2) }] };
      case "get_nfe_events":
        return { content: [{ type: "text", text: JSON.stringify(await nuvemFiscalRequest("GET", `/nfe/${args?.id}/eventos`), null, 2) }] };
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
        const s = new Server({ name: "mcp-nuvem-fiscal", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
