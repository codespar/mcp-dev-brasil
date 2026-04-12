#!/usr/bin/env node

/**
 * MCP Server for Banco Inter — digital bank with developer API.
 *
 * Tools:
 * - create_boleto: Create boleto bancario
 * - get_boleto: Get boleto by ID
 * - list_boletos: List boletos with filters
 * - cancel_boleto: Cancel/write-off a boleto
 * - create_pix: Create PIX payment
 * - get_pix: Get PIX transaction by ID
 * - list_pix: List PIX transactions
 * - get_balance: Get account balance
 * - get_statement: Get account statement
 * - create_transfer: Create TED/internal transfer
 * - get_webhook: Get configured webhooks
 * - create_webhook: Register webhook for notifications
 *
 * Environment:
 *   INTER_CLIENT_ID     — OAuth2 client ID
 *   INTER_CLIENT_SECRET — OAuth2 client secret
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CLIENT_ID = process.env.INTER_CLIENT_ID || "";
const CLIENT_SECRET = process.env.INTER_CLIENT_SECRET || "";
const BASE_URL = "https://cdpj.partners.bancointer.com.br";
const TOKEN_URL = `${BASE_URL}/oauth/v2/token`;

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(scope: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Banco Inter OAuth ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function interRequest(method: string, path: string, scope: string, body?: unknown): Promise<unknown> {
  const token = await getAccessToken(scope);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Banco Inter API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-inter-bank", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_boleto",
      description: "Create a boleto bancario (bank slip)",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Boleto amount in BRL" },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)" },
          payer_name: { type: "string", description: "Payer full name" },
          payer_cpf_cnpj: { type: "string", description: "Payer CPF or CNPJ" },
          payer_address: { type: "string", description: "Payer street address" },
          payer_city: { type: "string", description: "Payer city" },
          payer_state: { type: "string", description: "Payer state (UF)" },
          payer_zip: { type: "string", description: "Payer ZIP code (CEP)" },
          description: { type: "string", description: "Boleto description" },
        },
        required: ["amount", "due_date", "payer_name", "payer_cpf_cnpj"],
      },
    },
    {
      name: "get_boleto",
      description: "Get boleto details by ID",
      inputSchema: {
        type: "object",
        properties: { boletoId: { type: "string", description: "Boleto ID" } },
        required: ["boletoId"],
      },
    },
    {
      name: "list_boletos",
      description: "List boletos with filters",
      inputSchema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          status: { type: "string", enum: ["EMITIDO", "A_RECEBER", "ATRASADO", "VENCIDO", "EXPIRADO", "PAGO", "CANCELADO"], description: "Boleto status" },
          page: { type: "number", description: "Page number" },
          size: { type: "number", description: "Page size" },
        },
        required: ["date_from", "date_to"],
      },
    },
    {
      name: "cancel_boleto",
      description: "Cancel (write-off) a boleto",
      inputSchema: {
        type: "object",
        properties: {
          boletoId: { type: "string", description: "Boleto ID to cancel" },
          reason: { type: "string", enum: ["ACERTOS", "APEDIDODOCLIENTE", "DEVOLUCAO", "PAGODIRETOAOCLIENTE", "SUBSTITUICAO"], description: "Cancellation reason" },
        },
        required: ["boletoId", "reason"],
      },
    },
    {
      name: "create_pix",
      description: "Create a PIX payment",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Payment amount in BRL" },
          pix_key: { type: "string", description: "Recipient PIX key" },
          description: { type: "string", description: "Payment description" },
        },
        required: ["amount", "pix_key"],
      },
    },
    {
      name: "get_pix",
      description: "Get PIX transaction details by ID",
      inputSchema: {
        type: "object",
        properties: { pixId: { type: "string", description: "PIX transaction ID (e2eId)" } },
        required: ["pixId"],
      },
    },
    {
      name: "list_pix",
      description: "List PIX transactions",
      inputSchema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "number", description: "Page number" },
          size: { type: "number", description: "Page size" },
        },
        required: ["date_from", "date_to"],
      },
    },
    {
      name: "get_balance",
      description: "Get account balance",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_statement",
      description: "Get account statement for a date range",
      inputSchema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "number", description: "Page number" },
          size: { type: "number", description: "Page size" },
        },
        required: ["date_from", "date_to"],
      },
    },
    {
      name: "create_transfer",
      description: "Create a TED or internal transfer",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["TED", "PIX"], description: "Transfer type" },
          amount: { type: "number", description: "Transfer amount in BRL" },
          recipient_name: { type: "string", description: "Recipient name" },
          recipient_cpf_cnpj: { type: "string", description: "Recipient CPF or CNPJ" },
          recipient_bank: { type: "string", description: "Recipient bank code (ISPB)" },
          recipient_branch: { type: "string", description: "Recipient branch number" },
          recipient_account: { type: "string", description: "Recipient account number" },
          recipient_account_type: { type: "string", enum: ["CONTA_CORRENTE", "CONTA_POUPANCA", "CONTA_PAGAMENTO"], description: "Account type" },
          description: { type: "string", description: "Transfer description" },
        },
        required: ["type", "amount", "recipient_name", "recipient_cpf_cnpj"],
      },
    },
    {
      name: "get_webhook",
      description: "Get configured webhooks",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["boleto", "pix"], description: "Webhook type" },
        },
      },
    },
    {
      name: "create_webhook",
      description: "Register a webhook for notifications",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["boleto", "pix"], description: "Webhook type" },
          url: { type: "string", description: "Webhook callback URL" },
        },
        required: ["type", "url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_boleto": {
        const payload: any = {
          seuNumero: Date.now().toString(),
          valorNominal: args?.amount,
          dataVencimento: args?.due_date,
          numDiasAgenda: 30,
          pagador: {
            nome: args?.payer_name,
            cpfCnpj: args?.payer_cpf_cnpj,
            endereco: args?.payer_address || "",
            cidade: args?.payer_city || "",
            uf: args?.payer_state || "",
            cep: args?.payer_zip || "",
          },
        };
        if (args?.description) payload.descricao = args.description;
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("POST", "/cobranca/v3/cobrancas", "boleto-cobranca.write", payload), null, 2) }] };
      }
      case "get_boleto":
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/cobranca/v3/cobrancas/${args?.boletoId}`, "boleto-cobranca.read"), null, 2) }] };
      case "list_boletos": {
        const params = new URLSearchParams();
        params.set("dataInicial", String(args?.date_from));
        params.set("dataFinal", String(args?.date_to));
        if (args?.status) params.set("situacao", String(args.status));
        if (args?.page) params.set("paginaAtual", String(args.page));
        if (args?.size) params.set("itensPorPagina", String(args.size));
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/cobranca/v3/cobrancas?${params}`, "boleto-cobranca.read"), null, 2) }] };
      }
      case "cancel_boleto":
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("POST", `/cobranca/v3/cobrancas/${args?.boletoId}/cancelar`, "boleto-cobranca.write", { motivoCancelamento: args?.reason }), null, 2) }] };
      case "create_pix": {
        const payload: any = {
          valor: args?.amount,
          chave: args?.pix_key,
        };
        if (args?.description) payload.descricao = args.description;
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("POST", "/pix/v2/pix", "pix.write", payload), null, 2) }] };
      }
      case "get_pix":
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/pix/v2/pix/${args?.pixId}`, "pix.read"), null, 2) }] };
      case "list_pix": {
        const params = new URLSearchParams();
        params.set("dataInicial", String(args?.date_from));
        params.set("dataFinal", String(args?.date_to));
        if (args?.page) params.set("paginaAtual", String(args.page));
        if (args?.size) params.set("itensPorPagina", String(args.size));
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/pix/v2/pix?${params}`, "pix.read"), null, 2) }] };
      }
      case "get_balance":
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", "/banking/v2/saldo", "extrato.read"), null, 2) }] };
      case "get_statement": {
        const params = new URLSearchParams();
        params.set("dataInicial", String(args?.date_from));
        params.set("dataFinal", String(args?.date_to));
        if (args?.page) params.set("paginaAtual", String(args.page));
        if (args?.size) params.set("itensPorPagina", String(args.size));
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/banking/v2/extrato?${params}`, "extrato.read"), null, 2) }] };
      }
      case "create_transfer": {
        const payload: any = {
          tipo: args?.type,
          valor: args?.amount,
          nome: args?.recipient_name,
          cpfCnpj: args?.recipient_cpf_cnpj,
        };
        if (args?.recipient_bank) payload.codBanco = args.recipient_bank;
        if (args?.recipient_branch) payload.agencia = args.recipient_branch;
        if (args?.recipient_account) payload.conta = args.recipient_account;
        if (args?.recipient_account_type) payload.tipoConta = args.recipient_account_type;
        if (args?.description) payload.descricao = args.description;
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("POST", "/banking/v2/ted", "pagamento-ted.write", payload), null, 2) }] };
      }
      case "get_webhook": {
        const webhookType = args?.type || "boleto";
        const scope = webhookType === "pix" ? "webhook-pix.read" : "webhook-boleto.read";
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("GET", `/webhooks/${webhookType}`, scope), null, 2) }] };
      }
      case "create_webhook": {
        const webhookType = args?.type;
        const scope = webhookType === "pix" ? "webhook-pix.write" : "webhook-boleto.write";
        return { content: [{ type: "text", text: JSON.stringify(await interRequest("PUT", `/webhooks/${webhookType}`, scope, { webhookUrl: args?.url }), null, 2) }] };
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
        const s = new Server({ name: "mcp-inter-bank", version: "0.1.0" }, { capabilities: { tools: {} } }); (server as any)._requestHandlers.forEach((v: any, k: any) => (s as any)._requestHandlers.set(k, v)); (server as any)._notificationHandlers?.forEach((v: any, k: any) => (s as any)._notificationHandlers.set(k, v)); await s.connect(t);
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
