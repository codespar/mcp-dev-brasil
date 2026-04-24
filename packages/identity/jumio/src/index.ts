#!/usr/bin/env node

/**
 * MCP Server for Jumio — global enterprise identity verification & KYX.
 *
 * Jumio is the identity verification layer used by banks, large fintechs,
 * and regulated marketplaces that need deeper fraud-pattern detection and a
 * longer operator track record than challenger providers offer. The Jumio
 * KYX (Netverify) flow:
 *
 *   initiate_account → initiate_transaction (get redirectUrl for the
 *   Jumio-hosted user flow) → user captures ID + selfie → poll
 *   get_transaction / get_transaction_details → pull document data,
 *   similarity score, credentials.
 *
 * Tools (10):
 *   initiate_account          — create a persistent end-user account
 *   initiate_transaction      — start a KYC workflow (returns redirectUrl)
 *   get_transaction           — workflow execution summary
 *   list_transactions         — list workflow executions for an account
 *   get_transaction_details   — full workflow result
 *   retrieve_document_data    — extracted fields from the ID document
 *   retrieve_similarity_score — face-match (selfie vs document) result
 *   delete_transaction        — GDPR deletion of a workflow execution
 *   update_transaction_status — merchant-side status update (PATCH)
 *   retrieve_credentials      — credentials list (for PDF / image download)
 *
 * Authentication
 *   HTTP Basic: user=JUMIO_API_TOKEN, password=JUMIO_API_SECRET
 *   User-Agent: JUMIO_USER_AGENT   (required by Jumio)
 *
 * Environment
 *   JUMIO_API_TOKEN   — API token (required)
 *   JUMIO_API_SECRET  — API secret (required, secret)
 *   JUMIO_USER_AGENT  — merchant User-Agent string (required by Jumio)
 *   JUMIO_REGION      — 'us' | 'eu' | 'sg'. Default 'us'.
 *
 * Regional hosts
 *   us → https://api.amer-1.jumio.ai
 *   eu → https://api.emea-1.jumio.ai
 *   sg → https://api.apac-1.jumio.ai
 *
 * Docs: https://documentation.jumio.ai
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_TOKEN = process.env.JUMIO_API_TOKEN || "";
const API_SECRET = process.env.JUMIO_API_SECRET || "";
const USER_AGENT = process.env.JUMIO_USER_AGENT || "";
const REGION = (process.env.JUMIO_REGION || "us").toLowerCase();

function regionHost(r: string): string {
  switch (r) {
    case "eu": return "https://api.emea-1.jumio.ai";
    case "sg": return "https://api.apac-1.jumio.ai";
    case "us":
    default:   return "https://api.amer-1.jumio.ai";
  }
}
const BASE_URL = regionHost(REGION);

async function jumioRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const basic = Buffer.from(`${API_TOKEN}:${API_SECRET}`).toString("base64");
  const headers: Record<string, string> = {
    "Authorization": `Basic ${basic}`,
    "Accept": "application/json",
    "User-Agent": USER_AGENT,
  };

  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jumio API ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const server = new Server(
  { name: "mcp-jumio", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "initiate_account",
      description: "Create a persistent Jumio end-user account. An account groups all workflow executions (KYC transactions) for the same real-world user, enabling re-use of previously verified data and longitudinal fraud signals.",
      inputSchema: {
        type: "object",
        properties: {
          customerInternalReference: { type: "string", description: "Your internal user id. Stored on the Jumio account and echoed back on webhooks." },
          userReference: { type: "string", description: "Opaque reference shown to the user in the Jumio flow (e.g. masked email)." },
          workflowDefinition: {
            type: "object",
            description: "Optional: an inline workflow definition to run immediately on account creation. Usually you omit this and call initiate_transaction separately.",
            properties: {
              key: { type: "number", description: "Numeric workflow key from the Jumio portal (e.g. 200 for ID+selfie)." },
              credentials: { type: "array", items: { type: "object" }, description: "Credential categories required (ID, SELFIE, etc)." },
            },
          },
          callbackUrl: { type: "string", description: "HTTPS callback URL for Jumio to POST workflow results to." },
        },
        required: ["customerInternalReference"],
      },
    },
    {
      name: "initiate_transaction",
      description: "Start a new KYC workflow execution on an existing account. Returns a `redirectUrl` — redirect the end user there to complete the Jumio-hosted capture flow (document + selfie). Poll get_transaction for status afterwards.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id returned by initiate_account." },
          customerInternalReference: { type: "string", description: "Your internal user id." },
          userReference: { type: "string", description: "Opaque reference shown to the user." },
          workflowDefinition: {
            type: "object",
            description: "Workflow to run — identified by a numeric `key` configured in the Jumio portal.",
            properties: {
              key: { type: "number", description: "Numeric workflow key (e.g. 200 for ID+selfie, 100 for ID only)." },
              credentials: { type: "array", items: { type: "object" } },
            },
            required: ["key"],
          },
          callbackUrl: { type: "string", description: "HTTPS callback URL for this workflow's result." },
          tokenLifetime: { type: "string", description: "Lifetime of the redirect token (e.g. '30m', '24h'). Defaults to Jumio's account-level setting." },
          web: {
            type: "object",
            description: "Web channel options, e.g. successUrl / errorUrl to redirect the user to after capture.",
            properties: {
              successUrl: { type: "string" },
              errorUrl: { type: "string" },
              locale: { type: "string", description: "BCP-47 locale, e.g. 'en', 'pt-BR', 'es-MX'." },
            },
          },
        },
        required: ["accountId", "workflowDefinition"],
      },
    },
    {
      name: "get_transaction",
      description: "Retrieve a workflow execution summary — status ('INITIATED' | 'PROCESSED' | 'SESSION_EXPIRED' | 'TOKEN_EXPIRED' | 'ACQUIRED'), decision outcome, and capability-level results. Poll this to track progress.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id returned by initiate_transaction." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
    {
      name: "list_transactions",
      description: "List workflow executions for an account. Useful for auditing or rebuilding state after a webhook failure.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
        },
        required: ["accountId"],
      },
    },
    {
      name: "get_transaction_details",
      description: "Retrieve the full result payload for a workflow execution — all capability outputs (extraction, liveness, similarity, watchlist, etc). Use after status = 'PROCESSED'.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
    {
      name: "retrieve_document_data",
      description: "Retrieve extracted fields from the ID document (name, DOB, document number, expiry, issuing country, MRZ, etc). Requires a completed workflow that included a document capability.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
    {
      name: "retrieve_similarity_score",
      description: "Retrieve the facial similarity result (selfie vs document photo). Returns match decision plus confidence score. Requires a completed workflow that included a similarity/selfie capability.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
    {
      name: "delete_transaction",
      description: "Delete a workflow execution (GDPR right-to-erasure). Removes captured images, extracted data, and decision audit trail for this transaction on Jumio's side.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id to delete." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
    {
      name: "update_transaction_status",
      description: "Update the merchant-side status of a workflow execution (PATCH). Use to record your final accept/reject decision back on the Jumio transaction — helpful for Jumio's fraud model feedback loop and for dashboard reporting.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id." },
          status: { type: "string", description: "Merchant decision status (e.g. 'APPROVED', 'REJECTED', 'MANUAL_REVIEW')." },
          reason: { type: "string", description: "Optional free-text reason for the status change." },
        },
        required: ["accountId", "workflowExecutionId", "status"],
      },
    },
    {
      name: "retrieve_credentials",
      description: "List the credentials (captured artefacts: ID front/back, selfie, proof-of-address, etc) for a workflow execution. Each credential carries a parts[] array with URLs to download the stored images / PDFs.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string", description: "Jumio account id." },
          workflowExecutionId: { type: "string", description: "Workflow execution id." },
        },
        required: ["accountId", "workflowExecutionId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "initiate_account":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("POST", "/api/v1/accounts", a), null, 2) }] };
      case "initiate_transaction": {
        const { accountId, ...rest } = a;
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("POST", `/api/v1/accounts/${accountId}/workflow-executions`, rest), null, 2) }] };
      }
      case "get_transaction":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}`), null, 2) }] };
      case "list_transactions":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions`), null, 2) }] };
      case "get_transaction_details":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}/details`), null, 2) }] };
      case "retrieve_document_data":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}/documents`), null, 2) }] };
      case "retrieve_similarity_score":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}/similarity`), null, 2) }] };
      case "delete_transaction":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("DELETE", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}`), null, 2) }] };
      case "update_transaction_status": {
        const { accountId, workflowExecutionId, ...rest } = a;
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("PATCH", `/api/v1/accounts/${accountId}/workflow-executions/${workflowExecutionId}`, rest), null, 2) }] };
      }
      case "retrieve_credentials":
        return { content: [{ type: "text", text: JSON.stringify(await jumioRequest("GET", `/api/v1/accounts/${a.accountId}/workflow-executions/${a.workflowExecutionId}/credentials`), null, 2) }] };
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
        const s = new Server({ name: "mcp-jumio", version: "0.1.0" }, { capabilities: { tools: {} } });
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
