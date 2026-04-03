#!/usr/bin/env node

/**
 * MCP Server for Asaas — Brazilian billing automation platform.
 *
 * Tools:
 * - create_payment: Create a payment (Pix, boleto, or credit card)
 * - get_payment: Get payment details and status
 * - list_payments: List payments with filters
 * - get_pix_qrcode: Get Pix QR code for a payment
 * - get_boleto: Get boleto digitable line and PDF
 * - create_customer: Create a customer
 * - list_customers: List customers
 * - create_subscription: Create a recurring subscription
 * - list_subscriptions: List subscriptions with filters
 * - cancel_subscription: Cancel a subscription by ID
 * - get_balance: Get account balance
 * - create_transfer: Create a bank transfer (Pix out)
 * - get_webhook_events: List webhook events
 * - create_subaccount: Create a subaccount (split)
 * - get_installments: Get installment details for a payment
 *
 * Environment:
 *   ASAAS_API_KEY — API key from https://www.asaas.com/
 *   ASAAS_SANDBOX — "true" to use sandbox (default: false)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.ASAAS_API_KEY || "";
const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

async function asaasRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-asaas", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_payment",
      description: "Create a payment in Asaas (Pix, boleto, or credit card)",
      inputSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer ID (cus_xxx)" },
          billingType: { type: "string", enum: ["BOLETO", "CREDIT_CARD", "PIX"], description: "Payment method" },
          value: { type: "number", description: "Amount in BRL" },
          dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
          description: { type: "string", description: "Payment description" },
        },
        required: ["customer", "billingType", "value", "dueDate"],
      },
    },
    {
      name: "get_payment",
      description: "Get payment details by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payment ID (pay_xxx)" },
        },
        required: ["id"],
      },
    },
    {
      name: "list_payments",
      description: "List payments with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Filter by customer ID" },
          status: { type: "string", enum: ["PENDING", "RECEIVED", "CONFIRMED", "OVERDUE", "REFUNDED"], description: "Filter by status" },
          limit: { type: "number", description: "Number of results (default 10)" },
          offset: { type: "number", description: "Pagination offset" },
        },
      },
    },
    {
      name: "get_pix_qrcode",
      description: "Get Pix QR code for a payment (returns payload and image)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payment ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_boleto",
      description: "Get boleto digitable line and barcode for a payment",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payment ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_customer",
      description: "Create a customer in Asaas",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name" },
          cpfCnpj: { type: "string", description: "CPF or CNPJ (numbers only)" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
        },
        required: ["name", "cpfCnpj"],
      },
    },
    {
      name: "list_customers",
      description: "List customers with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Filter by name" },
          cpfCnpj: { type: "string", description: "Filter by CPF/CNPJ" },
          limit: { type: "number", description: "Number of results" },
        },
      },
    },
    {
      name: "create_subscription",
      description: "Create a recurring subscription",
      inputSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Customer ID" },
          billingType: { type: "string", enum: ["BOLETO", "CREDIT_CARD", "PIX"], description: "Payment method" },
          value: { type: "number", description: "Amount per cycle" },
          cycle: { type: "string", enum: ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"], description: "Billing cycle" },
          nextDueDate: { type: "string", description: "First due date (YYYY-MM-DD)" },
          description: { type: "string", description: "Subscription description" },
        },
        required: ["customer", "billingType", "value", "cycle", "nextDueDate"],
      },
    },
    {
      name: "get_balance",
      description: "Get current account balance",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_subscriptions",
      description: "List subscriptions with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Filter by customer ID" },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE", "EXPIRED"], description: "Filter by status" },
          limit: { type: "number", description: "Number of results (default 10)" },
          offset: { type: "number", description: "Pagination offset" },
        },
      },
    },
    {
      name: "cancel_subscription",
      description: "Cancel a subscription by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Subscription ID (sub_xxx)" },
        },
        required: ["id"],
      },
    },
    {
      name: "get_webhook_events",
      description: "List webhook events (payment confirmations, transfers, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          event: { type: "string", description: "Filter by event type (e.g. PAYMENT_CONFIRMED, PAYMENT_RECEIVED)" },
          limit: { type: "number", description: "Number of results (default 10)" },
          offset: { type: "number", description: "Pagination offset" },
        },
      },
    },
    {
      name: "create_subaccount",
      description: "Create a subaccount for payment splitting",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Subaccount name" },
          email: { type: "string", description: "Email address" },
          cpfCnpj: { type: "string", description: "CPF or CNPJ (numbers only)" },
          companyType: { type: "string", enum: ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"], description: "Company type" },
          phone: { type: "string", description: "Phone number" },
          mobilePhone: { type: "string", description: "Mobile phone number" },
          postalCode: { type: "string", description: "Postal code (CEP)" },
          address: { type: "string", description: "Street address" },
          addressNumber: { type: "string", description: "Address number" },
          province: { type: "string", description: "Neighborhood" },
        },
        required: ["name", "email", "cpfCnpj"],
      },
    },
    {
      name: "get_installments",
      description: "Get installment details for a payment",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Payment ID (pay_xxx)" },
        },
        required: ["id"],
      },
    },
    {
      name: "create_transfer",
      description: "Create a bank transfer (Pix out or TED)",
      inputSchema: {
        type: "object",
        properties: {
          value: { type: "number", description: "Amount in BRL" },
          pixAddressKey: { type: "string", description: "Pix key (CPF, email, phone, or random)" },
          pixAddressKeyType: { type: "string", enum: ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"], description: "Pix key type" },
          description: { type: "string", description: "Transfer description" },
        },
        required: ["value"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_payment":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("POST", "/payments", args), null, 2) }] };
      case "get_payment":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/payments/${args?.id}`), null, 2) }] };
      case "list_payments": {
        const params = new URLSearchParams();
        if (args?.customer) params.set("customer", String(args.customer));
        if (args?.status) params.set("status", String(args.status));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/payments?${params}`), null, 2) }] };
      }
      case "get_pix_qrcode":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/payments/${args?.id}/pixQrCode`), null, 2) }] };
      case "get_boleto":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/payments/${args?.id}/identificationField`), null, 2) }] };
      case "create_customer":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("POST", "/customers", args), null, 2) }] };
      case "list_customers": {
        const params = new URLSearchParams();
        if (args?.name) params.set("name", String(args.name));
        if (args?.cpfCnpj) params.set("cpfCnpj", String(args.cpfCnpj));
        if (args?.limit) params.set("limit", String(args.limit));
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/customers?${params}`), null, 2) }] };
      }
      case "create_subscription":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("POST", "/subscriptions", args), null, 2) }] };
      case "get_balance":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", "/finance/balance"), null, 2) }] };
      case "list_subscriptions": {
        const params = new URLSearchParams();
        if (args?.customer) params.set("customer", String(args.customer));
        if (args?.status) params.set("status", String(args.status));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/subscriptions?${params}`), null, 2) }] };
      }
      case "cancel_subscription":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("DELETE", `/subscriptions/${args?.id}`), null, 2) }] };
      case "get_webhook_events": {
        const params = new URLSearchParams();
        if (args?.event) params.set("event", String(args.event));
        if (args?.limit) params.set("limit", String(args.limit));
        if (args?.offset) params.set("offset", String(args.offset));
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/webhook/events?${params}`), null, 2) }] };
      }
      case "create_subaccount":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("POST", "/accounts", args), null, 2) }] };
      case "get_installments":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("GET", `/payments/${args?.id}/installments`), null, 2) }] };
      case "create_transfer":
        return { content: [{ type: "text", text: JSON.stringify(await asaasRequest("POST", "/transfers", args), null, 2) }] };
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

async function main() {
  if (!API_KEY) {
    console.error("ASAAS_API_KEY environment variable is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
