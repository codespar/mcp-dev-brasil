#!/usr/bin/env node

/**
 * MCP Server for Braintree — PayPal-owned global payment processor.
 *
 * Target customer: LatAm SaaS selling to US/EU buyers who already hold a
 * Braintree merchant account. Braintree's modern API is GraphQL — this server
 * wraps the 12 most-used operations (authorize / charge / capture / refund /
 * void, vault management, customer CRUD, transaction/customer lookups, client
 * token minting).
 *
 * Tools (12):
 *   authorize_transaction     — authorizePaymentMethod (reserve funds)
 *   charge_transaction        — chargePaymentMethod (authorize + capture)
 *   capture_transaction       — captureTransaction (capture prior auth)
 *   refund_transaction        — refundTransaction (refund settled)
 *   void_transaction          — reverseTransaction (void unsettled)
 *   vault_payment_method      — vaultPaymentMethod (permanently store token)
 *   delete_payment_method     — deletePaymentMethodFromVault
 *   create_customer           — createCustomer
 *   update_customer           — updateCustomer
 *   get_transaction           — search.transactions (by id)
 *   get_customer              — node(id:) on Customer
 *   create_client_token       — createClientToken (for client-side tokenization)
 *
 * Authentication
 *   HTTP Basic auth with PUBLIC_KEY:PRIVATE_KEY (base64-encoded). Every request
 *   also carries a `Braintree-Version: YYYY-MM-DD` header — defaults to
 *   2019-01-01, override via BRAINTREE_API_VERSION.
 *
 * Environment
 *   BRAINTREE_MERCHANT_ID   merchant id
 *   BRAINTREE_PUBLIC_KEY    public API key (Basic auth user)
 *   BRAINTREE_PRIVATE_KEY   private API key (Basic auth password, secret)
 *   BRAINTREE_ENV           'sandbox' (default) or 'production'
 *   BRAINTREE_API_VERSION   Braintree-Version header (default '2019-01-01')
 *
 * Docs: https://graphql.braintreepayments.com (redirects to
 *       https://developer.paypal.com/braintree/graphql)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const MERCHANT_ID = process.env.BRAINTREE_MERCHANT_ID || "";
const PUBLIC_KEY = process.env.BRAINTREE_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.BRAINTREE_PRIVATE_KEY || "";
const ENV = (process.env.BRAINTREE_ENV || "sandbox").toLowerCase();
const API_VERSION = process.env.BRAINTREE_API_VERSION || "2019-01-01";
const ENDPOINT =
  ENV === "production"
    ? "https://payments.braintree-api.com/graphql"
    : "https://payments.sandbox.braintree-api.com/graphql";

void MERCHANT_ID; // not sent as header, included for parity with Control Panel docs & future scoping

async function braintreeRequest(
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const basic = Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString("base64");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`,
      "Braintree-Version": API_VERSION,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) {
    throw new Error(`Braintree API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { errors?: unknown; data?: unknown };
  // Braintree returns HTTP 200 even on GraphQL errors — surface them explicitly.
  if (data.errors) {
    throw new Error(`Braintree GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

const server = new Server(
  { name: "mcp-braintree", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "authorize_transaction",
      description:
        "Authorize a transaction (reserve funds without capturing) via Braintree GraphQL authorizePaymentMethod. Pass a paymentMethodId obtained from client-side tokenization (Drop-in / Hosted Fields / SDK nonce). Capture later with capture_transaction.",
      inputSchema: {
        type: "object",
        properties: {
          paymentMethodId: {
            type: "string",
            description: "Tokenized payment method id or nonce (from client SDK).",
          },
          amount: {
            type: "string",
            description: "Amount as a decimal string (e.g. '10.50'). Braintree amounts are strings.",
          },
          orderId: { type: "string", description: "Merchant-side order reference." },
          merchantAccountId: {
            type: "string",
            description: "Optional merchant account id (for multi-currency / multi-account merchants).",
          },
          transaction: {
            type: "object",
            description:
              "Additional TransactionInput fields (customerDetails, billingAddress, shippingAddress, descriptor, customFields, riskData, lineItems, etc). Merged with amount/orderId/merchantAccountId.",
          },
        },
        required: ["paymentMethodId", "amount"],
      },
    },
    {
      name: "charge_transaction",
      description:
        "Authorize and capture a transaction atomically via Braintree GraphQL chargePaymentMethod. Use for one-step sales. For auth-now-capture-later split, use authorize_transaction + capture_transaction.",
      inputSchema: {
        type: "object",
        properties: {
          paymentMethodId: {
            type: "string",
            description: "Tokenized payment method id or nonce.",
          },
          amount: { type: "string", description: "Amount as decimal string." },
          orderId: { type: "string", description: "Merchant-side order reference." },
          merchantAccountId: { type: "string", description: "Optional merchant account id." },
          transaction: {
            type: "object",
            description:
              "Additional TransactionInput fields (customerDetails, billingAddress, shippingAddress, descriptor, customFields, riskData, lineItems, etc).",
          },
        },
        required: ["paymentMethodId", "amount"],
      },
    },
    {
      name: "capture_transaction",
      description:
        "Capture a previously authorized transaction via captureTransaction. Amount defaults to full authorized amount when omitted (partial captures allowed up to the authorized total).",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "Braintree transaction id from a prior authorization." },
          amount: {
            type: "string",
            description: "Optional capture amount as decimal string. Omit for full capture.",
          },
        },
        required: ["transactionId"],
      },
    },
    {
      name: "refund_transaction",
      description:
        "Refund a settled transaction via refundTransaction. Amount defaults to the full settled amount when omitted. For partial refunds, pass a smaller amount.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "Settled Braintree transaction id." },
          amount: {
            type: "string",
            description: "Optional refund amount as decimal string. Omit for full refund.",
          },
          orderId: { type: "string", description: "Optional order id for the refund record." },
        },
        required: ["transactionId"],
      },
    },
    {
      name: "void_transaction",
      description:
        "Void an unsettled transaction (reverse the authorization) via reverseTransaction. Use when funds are authorized but not yet captured — for captured/settled transactions use refund_transaction instead.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "Unsettled Braintree transaction id." },
        },
        required: ["transactionId"],
      },
    },
    {
      name: "vault_payment_method",
      description:
        "Permanently store a tokenized payment method in the Braintree vault via vaultPaymentMethod. The input paymentMethodId must be a single-use nonce; the mutation returns a permanent vaulted payment method id that can be reused for future charges.",
      inputSchema: {
        type: "object",
        properties: {
          paymentMethodId: { type: "string", description: "Single-use nonce from client-side tokenization." },
          customerId: {
            type: "string",
            description: "Optional Braintree customer id to associate the vaulted method with.",
          },
          verify: {
            type: "boolean",
            description: "If true, Braintree runs a verification (zero-auth / $1 auth) before vaulting.",
          },
        },
        required: ["paymentMethodId"],
      },
    },
    {
      name: "delete_payment_method",
      description:
        "Delete a vaulted payment method via deletePaymentMethodFromVault. Irreversible — the token cannot be used for future charges after deletion.",
      inputSchema: {
        type: "object",
        properties: {
          paymentMethodId: { type: "string", description: "Vaulted payment method id." },
        },
        required: ["paymentMethodId"],
      },
    },
    {
      name: "create_customer",
      description:
        "Create a Braintree customer via createCustomer. Customers group multiple vaulted payment methods and transactions under one identity.",
      inputSchema: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          customer: {
            type: "object",
            description:
              "Additional CustomerInput fields (website, fax, customFields, etc). Merged with the scalar fields above.",
          },
        },
      },
    },
    {
      name: "update_customer",
      description:
        "Update an existing Braintree customer via updateCustomer. Only fields present in the request are updated.",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Braintree customer id to update." },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company: { type: "string" },
          customer: {
            type: "object",
            description: "Additional CustomerInput fields to merge into the update payload.",
          },
        },
        required: ["customerId"],
      },
    },
    {
      name: "get_transaction",
      description:
        "Fetch a transaction by id via the GraphQL search.transactions query. Returns id, status, amount, orderId, createdAt, and the associated payment method.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "Braintree transaction id." },
        },
        required: ["transactionId"],
      },
    },
    {
      name: "get_customer",
      description:
        "Fetch a customer by id via the GraphQL node(id:) query. Returns customer scalars (id, firstName, lastName, email, company, phone).",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Braintree customer id (GraphQL global id)." },
        },
        required: ["customerId"],
      },
    },
    {
      name: "create_client_token",
      description:
        "Mint a Braintree client token via createClientToken for client-side tokenization (Drop-in, Hosted Fields, mobile SDKs). Pass a customerId to scope the token to a customer for vault-aware flows.",
      inputSchema: {
        type: "object",
        properties: {
          merchantAccountId: { type: "string", description: "Optional merchant account id." },
          customerId: {
            type: "string",
            description: "Optional customer id — required for client-side vaulted method lookup.",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "authorize_transaction": {
        const transaction = {
          ...((a.transaction as Record<string, unknown>) ?? {}),
          amount: a.amount,
          ...(a.orderId !== undefined ? { orderId: a.orderId } : {}),
          ...(a.merchantAccountId !== undefined ? { merchantAccountId: a.merchantAccountId } : {}),
        };
        const query = `mutation AuthorizePaymentMethod($input: AuthorizePaymentMethodInput!) {
          authorizePaymentMethod(input: $input) {
            transaction { id status amount { value currencyCode } orderId createdAt }
          }
        }`;
        const variables = {
          input: { paymentMethodId: a.paymentMethodId, transaction },
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, variables), null, 2) },
          ],
        };
      }
      case "charge_transaction": {
        const transaction = {
          ...((a.transaction as Record<string, unknown>) ?? {}),
          amount: a.amount,
          ...(a.orderId !== undefined ? { orderId: a.orderId } : {}),
          ...(a.merchantAccountId !== undefined ? { merchantAccountId: a.merchantAccountId } : {}),
        };
        const query = `mutation ChargePaymentMethod($input: ChargePaymentMethodInput!) {
          chargePaymentMethod(input: $input) {
            transaction { id status amount { value currencyCode } orderId createdAt }
          }
        }`;
        const variables = {
          input: { paymentMethodId: a.paymentMethodId, transaction },
        };
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, variables), null, 2) },
          ],
        };
      }
      case "capture_transaction": {
        const query = `mutation CaptureTransaction($input: CaptureTransactionInput!) {
          captureTransaction(input: $input) {
            transaction { id status amount { value currencyCode } }
          }
        }`;
        const input: Record<string, unknown> = { transactionId: a.transactionId };
        if (a.amount !== undefined) input.amount = a.amount;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, { input }), null, 2) },
          ],
        };
      }
      case "refund_transaction": {
        const refund: Record<string, unknown> = {};
        if (a.amount !== undefined) refund.amount = a.amount;
        if (a.orderId !== undefined) refund.orderId = a.orderId;
        const query = `mutation RefundTransaction($input: RefundTransactionInput!) {
          refundTransaction(input: $input) {
            refund { id status amount { value currencyCode } }
          }
        }`;
        const input: Record<string, unknown> = { transactionId: a.transactionId };
        if (Object.keys(refund).length > 0) input.refund = refund;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, { input }), null, 2) },
          ],
        };
      }
      case "void_transaction": {
        const query = `mutation ReverseTransaction($input: ReverseTransactionInput!) {
          reverseTransaction(input: $input) {
            reversal {
              ... on Transaction { id status }
              ... on Refund { id status }
            }
          }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await braintreeRequest(query, { input: { transactionId: a.transactionId } }),
                null,
                2,
              ),
            },
          ],
        };
      }
      case "vault_payment_method": {
        const query = `mutation VaultPaymentMethod($input: VaultPaymentMethodInput!) {
          vaultPaymentMethod(input: $input) {
            paymentMethod { id usage details { __typename } }
            verification { id status }
          }
        }`;
        const input: Record<string, unknown> = { paymentMethodId: a.paymentMethodId };
        if (a.customerId !== undefined) input.customerId = a.customerId;
        if (a.verify !== undefined) input.verify = a.verify;
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, { input }), null, 2) },
          ],
        };
      }
      case "delete_payment_method": {
        const query = `mutation DeletePaymentMethodFromVault($input: DeletePaymentMethodFromVaultInput!) {
          deletePaymentMethodFromVault(input: $input) { clientMutationId }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await braintreeRequest(query, {
                  input: { paymentMethodId: a.paymentMethodId },
                }),
                null,
                2,
              ),
            },
          ],
        };
      }
      case "create_customer": {
        const customer = {
          ...((a.customer as Record<string, unknown>) ?? {}),
          ...(a.firstName !== undefined ? { firstName: a.firstName } : {}),
          ...(a.lastName !== undefined ? { lastName: a.lastName } : {}),
          ...(a.email !== undefined ? { email: a.email } : {}),
          ...(a.phone !== undefined ? { phone: a.phone } : {}),
          ...(a.company !== undefined ? { company: a.company } : {}),
        };
        const query = `mutation CreateCustomer($input: CreateCustomerInput!) {
          createCustomer(input: $input) {
            customer { id firstName lastName email company phone }
          }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await braintreeRequest(query, { input: { customer } }), null, 2),
            },
          ],
        };
      }
      case "update_customer": {
        const customer = {
          ...((a.customer as Record<string, unknown>) ?? {}),
          ...(a.firstName !== undefined ? { firstName: a.firstName } : {}),
          ...(a.lastName !== undefined ? { lastName: a.lastName } : {}),
          ...(a.email !== undefined ? { email: a.email } : {}),
          ...(a.phone !== undefined ? { phone: a.phone } : {}),
          ...(a.company !== undefined ? { company: a.company } : {}),
        };
        const query = `mutation UpdateCustomer($input: UpdateCustomerInput!) {
          updateCustomer(input: $input) {
            customer { id firstName lastName email company phone }
          }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await braintreeRequest(query, {
                  input: { customerId: a.customerId, customer },
                }),
                null,
                2,
              ),
            },
          ],
        };
      }
      case "get_transaction": {
        const query = `query GetTransaction($id: ID!) {
          search {
            transactions(input: { id: { is: $id } }) {
              edges {
                node {
                  id
                  status
                  amount { value currencyCode }
                  orderId
                  createdAt
                  paymentMethodSnapshot { __typename }
                }
              }
            }
          }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await braintreeRequest(query, { id: a.transactionId }),
                null,
                2,
              ),
            },
          ],
        };
      }
      case "get_customer": {
        const query = `query GetCustomer($id: ID!) {
          node(id: $id) {
            ... on Customer { id firstName lastName email company phone }
          }
        }`;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await braintreeRequest(query, { id: a.customerId }),
                null,
                2,
              ),
            },
          ],
        };
      }
      case "create_client_token": {
        const clientToken: Record<string, unknown> = {};
        if (a.merchantAccountId !== undefined) clientToken.merchantAccountId = a.merchantAccountId;
        if (a.customerId !== undefined) clientToken.customerId = a.customerId;
        const query = `mutation CreateClientToken($input: CreateClientTokenInput!) {
          createClientToken(input: $input) { clientToken }
        }`;
        const input: Record<string, unknown> =
          Object.keys(clientToken).length > 0 ? { clientToken } : {};
        return {
          content: [
            { type: "text", text: JSON.stringify(await braintreeRequest(query, { input }), null, 2) },
          ],
        };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [
        { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
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
        const s = new Server({ name: "mcp-braintree", version: "0.1.0" }, { capabilities: { tools: {} } });
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
