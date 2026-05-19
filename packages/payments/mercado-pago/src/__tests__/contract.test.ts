import { it, expect, beforeAll, vi } from "vitest";
import {
  loadContractEnv,
  describeContract,
  parseToolResult,
  assertCredentialAccepted,
  uniqueSuffix,
} from "../../../../../test-utils/contract.js";

// --- Capture the tools/call handler; do NOT mock fetch (real network) ---
let callToolHandler: Function;

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class FakeServer {
    constructor() {}
    setRequestHandler(schema: any, handler: Function) {
      if (JSON.stringify(schema).includes("tools/call")) callToolHandler = handler;
    }
    connect() {
      return Promise.resolve();
    }
  }
  return { Server: FakeServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {},
}));

await loadContractEnv();

const HINT =
  "Check MP_TEST_ACCESS_TOKEN in .env — it must be a valid sandbox token from the Test credentials section.";

async function call(name: string, args: Record<string, unknown> = {}) {
  if (!callToolHandler) {
    throw new Error(
      "callToolHandler not registered — did beforeAll (vi.resetModules + import ../index.js) complete?",
    );
  }
  const result = await callToolHandler({ params: { name, arguments: args } });
  const parsed = parseToolResult(result);
  assertCredentialAccepted(parsed, HINT);
  return parsed;
}

describeContract("mcp-mercado-pago", "MP_TEST_ACCESS_TOKEN", () => {
  beforeAll(async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = process.env.MP_TEST_ACCESS_TOKEN;
    vi.resetModules();
    callToolHandler = undefined as any;
    await import("../index.js");
  });

  // ---- read-only: real GET, expect success + coarse shape ----
  const readOnly: Array<{ tool: string; args: Record<string, unknown>; shape: "array" | "object" }> = [
    { tool: "get_payment_methods", args: {}, shape: "array" },
    { tool: "get_identification_types", args: {}, shape: "array" },
    { tool: "get_payment_methods_by_site", args: { site_id: "MLB" }, shape: "array" },
    { tool: "get_balance", args: {}, shape: "object" },
    { tool: "search_payments", args: {}, shape: "object" },
    { tool: "search_merchant_orders", args: {}, shape: "object" },
    { tool: "list_customers", args: {}, shape: "object" },
    { tool: "list_stores", args: {}, shape: "object" },
  ];

  it.each(readOnly)(
    "read-only $tool returns a real success contract",
    async ({ tool, args, shape }) => {
      const parsed = await call(tool, args);
      expect(parsed.isError).toBe(false);
      expect(parsed.json).not.toBeNull();
      if (shape === "array") {
        expect(Array.isArray(parsed.json)).toBe(true);
      } else {
        expect(typeof parsed.json).toBe("object");
        expect(Array.isArray(parsed.json)).toBe(false);
      }
    },
    20000,
  );

  // ---- error-contract: GET unknown id → real 4xx ----
  const errorContract: Array<{ tool: string; args: Record<string, unknown> }> = [
    { tool: "get_payment", args: { paymentId: "0" } },
    { tool: "get_preference", args: { preferenceId: "0" } },
    { tool: "get_subscription", args: { preapproval_id: "0" } },
    { tool: "get_merchant_order", args: { orderId: "0" } },
    { tool: "get_advanced_payment", args: { advanced_payment_id: "0" } },
    { tool: "get_chargeback", args: { chargeback_id: "0" } },
    { tool: "get_payment_method_details", args: { payment_method_id: "___nope___" } },
  ];

  it.each(errorContract)(
    "error-contract $tool returns a real 4xx for an invalid id",
    async ({ tool, args }) => {
      const parsed = await call(tool, args);
      expect(parsed.isError).toBe(true);
      expect(parsed.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    20000,
  );

  // ---- payment-flow: chained, real side effects in sandbox ----
  const sfx = uniqueSuffix();
  const payerEmail = `test+${sfx}@codespar.dev`;
  const extRef = `codespar-${sfx}`;
  let customerId: string | undefined;
  let preferenceId: string | undefined;
  let cardTokenId: string | undefined;
  let paymentId: string | undefined;

  it(
    "payment-flow: create_customer",
    async () => {
      const p = await call("create_customer", {
        email: payerEmail,
        first_name: "Test",
        last_name: "Codespar",
      });
      expect(p.isError).toBe(false);
      customerId = (p.json as any)?.id;
      expect(customerId).toBeTruthy();
    },
    30000,
  );

  it(
    "payment-flow: list_customers finds the created email",
    async () => {
      const p = await call("list_customers", { email: payerEmail });
      expect(p.isError).toBe(false);
      expect(p.json).not.toBeNull();
    },
    30000,
  );

  it(
    "payment-flow: create_preference",
    async () => {
      const p = await call("create_preference", {
        items: [{ title: `codespar-${sfx}`, quantity: 1, unit_price: 10, currency_id: "BRL" }],
      });
      expect(p.isError).toBe(false);
      preferenceId = (p.json as any)?.id;
      expect(preferenceId).toBeTruthy();
    },
    30000,
  );

  it(
    "payment-flow: get_preference round-trips",
    async () => {
      expect(preferenceId).toBeTruthy();
      const p = await call("get_preference", { preferenceId });
      expect(p.isError).toBe(false);
      expect((p.json as any)?.id).toBe(preferenceId);
    },
    30000,
  );

  it(
    "payment-flow: create_card_token (public test card, APRO)",
    async () => {
      const p = await call("create_card_token", {
        card_number: "5031433215406351",
        expiration_month: "11",
        expiration_year: "2030",
        security_code: "123",
        cardholder: { name: "APRO", identification: { type: "CPF", number: "12345678909" } },
      });
      expect(p.isError).toBe(false);
      cardTokenId = (p.json as any)?.id;
      expect(cardTokenId).toBeTruthy();
    },
    30000,
  );

  it(
    "payment-flow: create_payment with card token (approved)",
    async () => {
      expect(cardTokenId).toBeTruthy();
      const p = await call("create_payment", {
        amount: 10,
        description: `codespar-${sfx}`,
        payment_method_id: "master",
        payer_email: payerEmail,
        installments: 1,
        token: cardTokenId,
      });
      expect(p.isError).toBe(false);
      paymentId = (p.json as any)?.id ? String((p.json as any).id) : undefined;
      expect(paymentId).toBeTruthy();
      expect((p.json as any)?.status).toBeTruthy();
    },
    30000,
  );

  it(
    "payment-flow: get_payment round-trips",
    async () => {
      expect(paymentId).toBeTruthy();
      const p = await call("get_payment", { paymentId });
      expect(p.isError).toBe(false);
      expect(String((p.json as any)?.id)).toBe(paymentId);
    },
    30000,
  );

  it(
    "payment-flow: create_refund on the approved payment",
    async () => {
      expect(paymentId).toBeTruthy();
      const p = await call("create_refund", { paymentId });
      expect(p.isError).toBe(false);
      expect(p.json).not.toBeNull();
    },
    30000,
  );

  it(
    "payment-flow: search_payments succeeds",
    async () => {
      const p = await call("search_payments", {});
      expect(p.isError).toBe(false);
      expect(p.json).not.toBeNull();
    },
    30000,
  );

  // ---- subscription-lifecycle: chained ----
  let subscriptionId: string | undefined;

  it(
    "subscription: create_subscription (pending)",
    async () => {
      const p = await call("create_subscription", {
        payer_email: payerEmail,
        reason: `codespar-sub-${sfx}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 10,
          currency_id: "BRL",
        },
        back_url: "https://example.com/codespar-cb",
        external_reference: extRef,
      });
      expect(p.isError).toBe(false);
      subscriptionId = (p.json as any)?.id;
      expect(subscriptionId).toBeTruthy();
    },
    30000,
  );

  it(
    "subscription: get_subscription round-trips",
    async () => {
      expect(subscriptionId).toBeTruthy();
      const p = await call("get_subscription", { preapproval_id: subscriptionId });
      expect(p.isError).toBe(false);
      expect((p.json as any)?.id).toBe(subscriptionId);
    },
    30000,
  );

  it(
    "subscription: update_subscription",
    async () => {
      expect(subscriptionId).toBeTruthy();
      const p = await call("update_subscription", {
        preapproval_id: subscriptionId,
        reason: `codespar-sub-${sfx}-updated`,
      });
      expect(p.isError).toBe(false);
    },
    30000,
  );

  it(
    "subscription: cancel_subscription",
    async () => {
      expect(subscriptionId).toBeTruthy();
      const p = await call("cancel_subscription", { preapproval_id: subscriptionId });
      expect(p.isError).toBe(false);
    },
    30000,
  );

  // ---- merchant: chained ----
  let storeId: string | undefined;

  it(
    "merchant: create_store",
    async () => {
      const p = await call("create_store", {
        name: `codespar-store-${sfx}`,
        external_id: `store-${sfx}`,
      });
      expect(p.isError).toBe(false);
      storeId = (p.json as any)?.id ? String((p.json as any).id) : undefined;
      expect(storeId).toBeTruthy();
    },
    30000,
  );

  it(
    "merchant: list_stores",
    async () => {
      const p = await call("list_stores", {});
      expect(p.isError).toBe(false);
      expect(p.json).not.toBeNull();
    },
    30000,
  );

  it(
    "merchant: create_pos linked to the store",
    async () => {
      expect(storeId).toBeTruthy();
      const p = await call("create_pos", {
        name: `codespar-pos-${sfx}`,
        store_id: storeId,
        external_id: `pos-${sfx}`,
        fixed_amount: false,
      });
      expect(p.isError).toBe(false);
    },
    30000,
  );
});
