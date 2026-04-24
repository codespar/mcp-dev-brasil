#!/usr/bin/env node

/**
 * MCP Server for Sift — global enterprise ML-based fraud detection.
 *
 * Third entry in the CodeSpar `fraud` category after ClearSale (BR pioneer,
 * chargeback-db strength) and Konduto (BR, API-first + device intelligence).
 * Sift is the global enterprise tier: real-time ML scoring across multiple
 * abuse types (payment_abuse, account_abuse, content_abuse, promotion_abuse,
 * legacy), event-driven data ingestion, and a workflow engine that turns
 * scores into automated decisions.
 *
 * Positioning vs. BR fraud servers:
 *   ClearSale — BR, chargeback history db, manual review services
 *   Konduto   — BR, API-first, behavioral device intelligence
 *   Sift      — global, multi-abuse-type ML, decisions workflows, enterprise
 *   Jumio     — global KYC (distinct from fraud — identity verification, not scoring)
 *
 * Tools (10):
 *   send_event               — POST any $-prefixed event ($create_order, $login, $chargeback, ...)
 *   get_user_score           — fetch latest score(s) for a user (no recompute)
 *   rescore_user             — force a recompute and return the fresh score
 *   label_user               — mark a user as fraud / not-fraud (Labels API — legacy ML feedback)
 *   unlabel_user             — remove an existing label
 *   apply_decision_to_user   — apply a workflow decision to a user
 *   apply_decision_to_order  — apply a workflow decision to a specific order
 *   get_user_decisions       — list decisions currently applied to a user
 *   get_order_decisions      — list decisions currently applied to an order
 *   get_workflow_run         — fetch the status of a workflow run by run_id
 *
 * Authentication
 *   Events API (v205)    — $api_key field inside the JSON body
 *   Score API (v205)     — HTTP Basic auth, username = SIFT_API_KEY, empty password
 *   Decisions API (v3)   — HTTP Basic auth, username = SIFT_API_KEY, empty password
 *   This server uses Basic auth for all Score + Decisions calls and injects
 *   $api_key into the body for Events calls.
 *
 * Environment
 *   SIFT_API_KEY     — API key (required, secret)
 *   SIFT_ACCOUNT_ID  — account id, required for every Decisions API v3 call
 *   SIFT_BASE_URL    — optional; defaults to https://api.sift.com
 *
 * Alpha note
 *   Shipped as 0.1.0-alpha.1. All endpoint paths are verified against the
 *   official Sift Ruby SDK (github.com/SiftScience/sift-ruby): rest_api_path,
 *   user_score_api_path, users_label_api_path, user_decisions_api_path,
 *   order_decisions_api_path, workflow_status_path, and the Decision ApplyTo
 *   path builder. The developers.sift.com HTML reference is gated (403 on
 *   several deep reference pages), so details like list-workflow-runs and the
 *   psychology score endpoint from the original brief are NOT shipped here:
 *   no list-runs helper exists in the public SDK, and no psychology score
 *   path is emitted by it. Promote to 0.1.0 once a customer confirms those.
 *
 * Docs: https://developers.sift.com
 * SDK reference: https://github.com/SiftScience/sift-ruby
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.SIFT_API_KEY || "";
const ACCOUNT_ID = process.env.SIFT_ACCOUNT_ID || "";
const BASE_URL = process.env.SIFT_BASE_URL || "https://api.sift.com";

type Query = Record<string, string | number | boolean | undefined>;

function buildQuery(q?: Query): string {
  if (!q) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Unified Sift request helper.
 *   flavor "events"  — POST with $api_key in body (Events API v205 convention)
 *   flavor "basic"   — Basic auth header (Score API + Decisions API v3)
 */
async function siftRequest(
  method: string,
  path: string,
  body?: unknown,
  opts: { query?: Query; flavor?: "events" | "basic" } = {}
): Promise<unknown> {
  const flavor = opts.flavor ?? "basic";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let payload: unknown = body;

  if (flavor === "basic") {
    const basic = Buffer.from(`${API_KEY}:`).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  } else {
    // Events API — api_key is part of the JSON body
    payload = { ...(body as Record<string, unknown> | undefined), $api_key: API_KEY };
  }

  const url = `${BASE_URL}${path}${buildQuery(opts.query)}`;
  const res = await fetch(url, {
    method,
    headers,
    body: payload !== undefined && method !== "GET" ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sift API ${res.status}: ${err}`);
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function requireAccountId(): string {
  if (!ACCOUNT_ID) {
    throw new Error("SIFT_ACCOUNT_ID is required for Decisions API v3 calls");
  }
  return ACCOUNT_ID;
}

const ABUSE_TYPES = [
  "payment_abuse",
  "account_abuse",
  "content_abuse",
  "promotion_abuse",
  "legacy",
];

const server = new Server(
  { name: "mcp-sift", version: "0.1.0-alpha.1" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_event",
      description: "Send a fraud signal to Sift's Events API (POST /v205/events). The `type` parameter selects the event kind ($create_order, $transaction, $login, $create_account, $update_account, $chargeback, $order_status, etc). Additional fields ($user_id, $session_id, $order_id, custom fields) are passed via `fields` and merged into the body. Use `return_score=true` to get a synchronous score in the response.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Sift event type, with the $ prefix — e.g. $create_order, $transaction, $login, $create_account, $update_account, $chargeback, $order_status, $link_session_to_user. See developers.sift.com for the full catalog.",
          },
          fields: {
            type: "object",
            description: "Event payload fields. Include Sift reserved fields with the $ prefix ($user_id, $session_id, $order_id, $amount, $currency_code, $payment_methods, $billing_address, $shipping_address, $items, ...) plus any custom merchant fields. $api_key is injected automatically.",
          },
          return_score: {
            type: "boolean",
            description: "If true, returns a score in the response (synchronous scoring).",
          },
          return_workflow_status: {
            type: "boolean",
            description: "If true, returns the status of any workflow runs triggered by this event.",
          },
          abuse_types: {
            type: "string",
            description: "Comma-separated list of abuse types to score (payment_abuse,account_abuse,content_abuse,promotion_abuse,legacy). Only used when return_score=true.",
          },
          force_workflow_run: {
            type: "boolean",
            description: "If true, re-runs workflows even if no relevant signals changed.",
          },
        },
        required: ["type", "fields"],
      },
    },
    {
      name: "get_user_score",
      description: "Fetch the latest Sift score(s) for a user (GET /v205/users/{user_id}/score). Does NOT trigger a rescore — it returns whatever score was last computed. The score is a float in [0, 1]; higher means more fraud-like. Optionally filter by abuse_types.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id — must match the value previously passed in events." },
          abuse_types: {
            type: "string",
            description: "Comma-separated abuse types to include (payment_abuse,account_abuse,content_abuse,promotion_abuse,legacy). Defaults to all configured for the account.",
          },
        },
        required: ["user_id"],
      },
    },
    {
      name: "rescore_user",
      description: "Force Sift to recompute a user's score right now (POST /v205/users/{user_id}/score). Use when you have externally-observed signal that should invalidate the last score (e.g. a manual decision) but have not sent a new event.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id" },
          abuse_types: {
            type: "string",
            description: "Comma-separated abuse types to recompute. Defaults to all configured.",
          },
        },
        required: ["user_id"],
      },
    },
    {
      name: "label_user",
      description: "Label a user as fraud or not-fraud via the legacy Labels API (POST /v205/users/{user_id}/labels). Labels are the classic supervised-learning feedback channel for Sift's ML model. Note: most new integrations use the Decisions API (apply_decision_to_user) instead — labels are kept for backward compatibility. Still supported for ongoing model feedback.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id" },
          is_bad: { type: "boolean", description: "True if this user is confirmed bad (fraudulent); false if they were cleared." },
          abuse_type: {
            type: "string",
            enum: ABUSE_TYPES,
            description: "Which abuse type this label applies to.",
          },
          description: { type: "string", description: "Free-text rationale for the label (e.g. 'chargeback confirmed 2026-04-15')." },
          source: { type: "string", description: "Label source — e.g. 'manual_review', 'automated_rule', 'chargeback_notification'." },
          analyst: { type: "string", description: "Identifier of the analyst or system that applied the label." },
        },
        required: ["user_id", "is_bad", "abuse_type"],
      },
    },
    {
      name: "unlabel_user",
      description: "Remove any existing label on a user (DELETE /v205/users/{user_id}/labels). Optionally scope by abuse_type.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id" },
          abuse_type: {
            type: "string",
            enum: ABUSE_TYPES,
            description: "If provided, only the label for this abuse type is removed.",
          },
        },
        required: ["user_id"],
      },
    },
    {
      name: "apply_decision_to_user",
      description: "Apply a workflow Decision to a user (POST /v3/accounts/{account_id}/users/{user_id}/decisions). Decisions are the modern replacement for Labels — they both classify the entity for Sift's ML and trigger any configured side effects (e.g. a Block decision on a $payment_abuse user will cause that user's future $transaction events to be blocked). Requires SIFT_ACCOUNT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id" },
          decision_id: { type: "string", description: "The Decision ID to apply, exactly as configured in the Sift console (e.g. 'block_user_payment_abuse', 'looks_ok_payment_abuse')." },
          source: {
            type: "string",
            enum: ["MANUAL_REVIEW", "AUTOMATED_RULE", "CHARGEBACK"],
            description: "Who/what applied the decision. Required by Sift.",
          },
          analyst: { type: "string", description: "Analyst id for MANUAL_REVIEW decisions (email is typical)." },
          description: { type: "string", description: "Free-text note on why this decision was applied." },
          time: { type: "number", description: "Milliseconds since epoch when the decision was made. Defaults to server time." },
        },
        required: ["user_id", "decision_id", "source"],
      },
    },
    {
      name: "apply_decision_to_order",
      description: "Apply a workflow Decision to a specific order (POST /v3/accounts/{account_id}/users/{user_id}/orders/{order_id}/decisions). Order-level decisions target a single transaction rather than the whole user (e.g. 'approve_order_payment_abuse' on a manually-reviewed high-value order). Requires SIFT_ACCOUNT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id the order belongs to." },
          order_id: { type: "string", description: "Sift $order_id." },
          decision_id: { type: "string", description: "Decision ID as configured in the Sift console." },
          source: {
            type: "string",
            enum: ["MANUAL_REVIEW", "AUTOMATED_RULE", "CHARGEBACK"],
            description: "Decision source.",
          },
          analyst: { type: "string", description: "Analyst id for MANUAL_REVIEW." },
          description: { type: "string", description: "Rationale." },
          time: { type: "number", description: "Milliseconds since epoch." },
        },
        required: ["user_id", "order_id", "decision_id", "source"],
      },
    },
    {
      name: "get_user_decisions",
      description: "Fetch the decisions currently applied to a user (GET /v3/accounts/{account_id}/users/{user_id}/decisions). Returns the active decision per abuse type. Requires SIFT_ACCOUNT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "Sift $user_id" },
        },
        required: ["user_id"],
      },
    },
    {
      name: "get_order_decisions",
      description: "Fetch the decisions currently applied to an order (GET /v3/accounts/{account_id}/orders/{order_id}/decisions). Note: the order-level GET path does NOT include user_id, unlike the order-level apply path. Requires SIFT_ACCOUNT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Sift $order_id" },
        },
        required: ["order_id"],
      },
    },
    {
      name: "get_workflow_run",
      description: "Fetch the status of a Sift Workflow run (GET /v3/accounts/{account_id}/workflows/runs/{run_id}). The run_id is returned in the response to events sent with return_workflow_status=true. The run status tells you which route of the workflow was taken and which decisions were applied. Requires SIFT_ACCOUNT_ID.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string", description: "Workflow run id returned by a prior send_event call (when return_workflow_status=true)." },
        },
        required: ["run_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send_event": {
        const a = args as {
          type: string;
          fields: Record<string, unknown>;
          return_score?: boolean;
          return_workflow_status?: boolean;
          abuse_types?: string;
          force_workflow_run?: boolean;
        };
        const body: Record<string, unknown> = { ...(a.fields || {}), $type: a.type };
        const query: Query = {};
        if (a.return_score) query["return_score"] = "true";
        if (a.return_workflow_status) query["return_workflow_status"] = "true";
        if (a.force_workflow_run) query["force_workflow_run"] = "true";
        if (a.abuse_types) query["abuse_types"] = a.abuse_types;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("POST", "/v205/events", body, { query, flavor: "events" }), null, 2) }],
        };
      }
      case "get_user_score": {
        const a = args as { user_id: string; abuse_types?: string };
        const uid = encodeURIComponent(a.user_id);
        const query: Query = {};
        if (a.abuse_types) query["abuse_types"] = a.abuse_types;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("GET", `/v205/users/${uid}/score`, undefined, { query }), null, 2) }],
        };
      }
      case "rescore_user": {
        const a = args as { user_id: string; abuse_types?: string };
        const uid = encodeURIComponent(a.user_id);
        const query: Query = {};
        if (a.abuse_types) query["abuse_types"] = a.abuse_types;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("POST", `/v205/users/${uid}/score`, {}, { query }), null, 2) }],
        };
      }
      case "label_user": {
        const a = args as {
          user_id: string;
          is_bad: boolean;
          abuse_type: string;
          description?: string;
          source?: string;
          analyst?: string;
        };
        const uid = encodeURIComponent(a.user_id);
        const body: Record<string, unknown> = {
          $is_bad: a.is_bad,
          $abuse_type: a.abuse_type,
        };
        if (a.description) body["$description"] = a.description;
        if (a.source) body["$source"] = a.source;
        if (a.analyst) body["$analyst"] = a.analyst;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("POST", `/v205/users/${uid}/labels`, body, { flavor: "events" }), null, 2) }],
        };
      }
      case "unlabel_user": {
        const a = args as { user_id: string; abuse_type?: string };
        const uid = encodeURIComponent(a.user_id);
        const query: Query = { api_key: API_KEY };
        if (a.abuse_type) query["abuse_type"] = a.abuse_type;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("DELETE", `/v205/users/${uid}/labels`, undefined, { query }), null, 2) }],
        };
      }
      case "apply_decision_to_user": {
        const a = args as {
          user_id: string;
          decision_id: string;
          source: string;
          analyst?: string;
          description?: string;
          time?: number;
        };
        const aid = encodeURIComponent(requireAccountId());
        const uid = encodeURIComponent(a.user_id);
        const body: Record<string, unknown> = { decision_id: a.decision_id, source: a.source };
        if (a.analyst) body["analyst"] = a.analyst;
        if (a.description) body["description"] = a.description;
        if (a.time) body["time"] = a.time;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("POST", `/v3/accounts/${aid}/users/${uid}/decisions`, body), null, 2) }],
        };
      }
      case "apply_decision_to_order": {
        const a = args as {
          user_id: string;
          order_id: string;
          decision_id: string;
          source: string;
          analyst?: string;
          description?: string;
          time?: number;
        };
        const aid = encodeURIComponent(requireAccountId());
        const uid = encodeURIComponent(a.user_id);
        const oid = encodeURIComponent(a.order_id);
        const body: Record<string, unknown> = { decision_id: a.decision_id, source: a.source };
        if (a.analyst) body["analyst"] = a.analyst;
        if (a.description) body["description"] = a.description;
        if (a.time) body["time"] = a.time;
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("POST", `/v3/accounts/${aid}/users/${uid}/orders/${oid}/decisions`, body), null, 2) }],
        };
      }
      case "get_user_decisions": {
        const a = args as { user_id: string };
        const aid = encodeURIComponent(requireAccountId());
        const uid = encodeURIComponent(a.user_id);
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("GET", `/v3/accounts/${aid}/users/${uid}/decisions`), null, 2) }],
        };
      }
      case "get_order_decisions": {
        const a = args as { order_id: string };
        const aid = encodeURIComponent(requireAccountId());
        const oid = encodeURIComponent(a.order_id);
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("GET", `/v3/accounts/${aid}/orders/${oid}/decisions`), null, 2) }],
        };
      }
      case "get_workflow_run": {
        const a = args as { run_id: string };
        const aid = encodeURIComponent(requireAccountId());
        const rid = encodeURIComponent(a.run_id);
        return {
          content: [{ type: "text", text: JSON.stringify(await siftRequest("GET", `/v3/accounts/${aid}/workflows/runs/${rid}`), null, 2) }],
        };
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
    app.get("/health", (_req: unknown, res: { json: (body: unknown) => unknown }) => res.json({ status: "ok", sessions: transports.size }));
    app.post("/mcp", async (req: { headers: Record<string, string | string[] | undefined>; body: unknown }, res: { status: (code: number) => { json: (body: unknown) => unknown } }) => {
      const sid = req.headers["mcp-session-id"] as string | undefined;
      if (sid && transports.has(sid)) { await transports.get(sid)!.handleRequest(req as never, res as never, req.body); return; }
      if (!sid && isInitializeRequest(req.body)) {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, t); } });
        t.onclose = () => { if (t.sessionId) transports.delete(t.sessionId); };
        const s = new Server({ name: "mcp-sift", version: "0.1.0-alpha.1" }, { capabilities: { tools: {} } });
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
