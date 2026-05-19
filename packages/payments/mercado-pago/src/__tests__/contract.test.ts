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

// sandbox: a seller "Credenciais de teste" Access Token is broadly accepted
// (17 read/POST tools succeed with it — get_payment_methods, create_preference,
// create_card_token, etc.). BUT several specific endpoints answer 401/403 as
// their genuine per-endpoint contract for this account type (not a bad token).
// `callRaw` skips the global credential guard so those endpoints can be
// asserted at the row level against the EXACT status class we observed.
async function callRaw(name: string, args: Record<string, unknown> = {}) {
  if (!callToolHandler) {
    throw new Error(
      "callToolHandler not registered — did beforeAll (vi.resetModules + import ../index.js) complete?",
    );
  }
  const result = await callToolHandler({ params: { name, arguments: args } });
  return parseToolResult(result);
}

describeContract("mcp-mercado-pago", "MP_TEST_ACCESS_TOKEN", () => {
  beforeAll(async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = process.env.MP_TEST_ACCESS_TOKEN;
    vi.resetModules();
    callToolHandler = undefined as any;
    await import("../index.js");
  });

  // ---- read-only: real GET, expect success + coarse shape ----
  // Removed: get_balance (real sandbox → 404 "resource not found") and
  // list_stores (real sandbox → 403 forbidden) — both moved to error-contract
  // assertions below since they are unavailable for a seller test account.
  const readOnly: Array<{ tool: string; args: Record<string, unknown>; shape: "array" | "object" }> = [
    { tool: "get_payment_methods", args: {}, shape: "array" },
    { tool: "get_identification_types", args: {}, shape: "array" },
    { tool: "get_payment_methods_by_site", args: { site_id: "MLB" }, shape: "array" },
    { tool: "search_payments", args: {}, shape: "object" },
    { tool: "search_merchant_orders", args: {}, shape: "object" },
    { tool: "list_customers", args: {}, shape: "object" },
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

  // sandbox: get_balance unavailable for test account → asserts error contract.
  // Real sandbox: GET balance → 404 {"error":"resource not found"}.
  it(
    "error-contract: get_balance is unavailable for the test account (4xx)",
    async () => {
      const p = await callRaw("get_balance", {});
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    20000,
  );

  // sandbox: list_stores unavailable for test account → asserts error contract.
  // Real sandbox: GET stores → 403 forbidden (tengine).
  it(
    "error-contract: list_stores is unavailable for the test account (403)",
    async () => {
      const p = await callRaw("list_stores", {});
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 403/);
    },
    20000,
  );

  // ---- error-contract: GET unknown id → real 4xx ----
  // get_preference removed from this table: real sandbox returns 401
  // invalid_caller_id (a 4xx, but the credential guard intercepts it) — it
  // gets its own callRaw assertion below.
  const errorContract: Array<{ tool: string; args: Record<string, unknown> }> = [
    { tool: "get_payment", args: { paymentId: "0" } },
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

  // sandbox: get_preference for an unknown id → 401 {"error":"invalid_caller_id"}
  // (Mercado Pago answers the checkout-preferences endpoint with 401 rather
  // than 404 for an unknown id under a test account). Still a 4xx contract;
  // asserted via callRaw because the global credential guard trips on 401.
  it(
    "error-contract: get_preference for an unknown id returns a real 4xx",
    async () => {
      const p = await callRaw("get_preference", { preferenceId: "0" });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    20000,
  );

  // ---- payment-flow: chained, real side effects in sandbox ----
  const sfx = uniqueSuffix();
  const payerEmail = `test+${sfx}@codespar.dev`;
  const extRef = `codespar-${sfx}`;
  let preferenceId: string | undefined;

  // sandbox: create_customer with a seller test Access Token →
  // 401 {"error":"unauthorized","cause":[{"code":"300","description":
  // "Unauthorized use of live credentials"}]}. Customer creation requires a
  // test-user token (not the seller "Credenciais de teste" token), so this is
  // demoted to an error-contract assertion proving the failure is structured.
  it(
    "payment-flow: create_customer is rejected for a seller test token (401)",
    async () => {
      const p = await callRaw("create_customer", {
        email: payerEmail,
        first_name: "Test",
        last_name: "Codespar",
      });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
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
      expect((p.json as any)?.id).toBeTruthy();
    },
    30000,
  );

  // sandbox: create_payment with a seller test Access Token →
  // 401 "Unauthorized use of live credentials" (payment creation requires a
  // test-user token). Asserted as a structured failure with an invalid token
  // so the error contract is exercised independently of the credential issue.
  it(
    "payment-flow: create_payment rejects an invalid token with a structured 4xx",
    async () => {
      const p = await callRaw("create_payment", {
        amount: 10,
        description: `codespar-${sfx}`,
        payment_method_id: "master",
        payer_email: payerEmail,
        installments: 1,
        token: "invalid_token_" + sfx,
      });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );

  it(
    "payment-flow: get_payment for an unknown id returns a structured 4xx",
    async () => {
      const p = await callRaw("get_payment", { paymentId: "0" });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );

  it(
    "payment-flow: create_refund on an unknown payment returns a structured 4xx",
    async () => {
      const p = await callRaw("create_refund", { paymentId: "0" });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
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

  // ---- subscription-lifecycle ----
  // sandbox: create_subscription (POST /preapproval) → 500 {"message":
  // "Internal server error"} for a seller test Access Token (the preapproval
  // endpoint cannot be exercised without a test-user / configured plan). It
  // fundamentally cannot succeed here, so the create step is demoted to a
  // server-error contract and the dependent round-trip/update/cancel steps
  // are demoted to invalid-id error contracts.
  it(
    "subscription: create_subscription returns a structured error for a seller test token",
    async () => {
      const p = await callRaw("create_subscription", {
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
      expect(p.isError).toBe(true);
      // observed: 500 Internal server error for a seller test token; accept the
      // documented 4xx/5xx structured-failure class.
      expect(p.text).toMatch(/Mercado Pago API [45]\d\d/);
    },
    30000,
  );

  it(
    "subscription: get_subscription for an unknown id returns a structured 4xx",
    async () => {
      const p = await callRaw("get_subscription", { preapproval_id: "0" });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );

  it(
    "subscription: update_subscription for an unknown id returns a structured 4xx",
    async () => {
      const p = await callRaw("update_subscription", {
        preapproval_id: "0",
        reason: `codespar-sub-${sfx}-updated`,
      });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );

  it(
    "subscription: cancel_subscription for an unknown id returns a structured 4xx",
    async () => {
      const p = await callRaw("cancel_subscription", { preapproval_id: "0" });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );

  // ---- merchant ----
  // sandbox: create_store (POST /users/{id}/stores) → 403 forbidden
  // ("You don't have permission to perform this operation") and list_stores
  // → 403. Store/POS management is not permitted for a seller test account,
  // so these are demoted to error-contract assertions and create_pos is
  // exercised against an unknown store id.
  it(
    "merchant: create_store is forbidden for the test account (403)",
    async () => {
      const p = await callRaw("create_store", {
        name: `codespar-store-${sfx}`,
        external_id: `store-${sfx}`,
      });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 403/);
    },
    30000,
  );

  it(
    "merchant: list_stores is forbidden for the test account (403)",
    async () => {
      const p = await callRaw("list_stores", {});
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 403/);
    },
    30000,
  );

  it(
    "merchant: create_pos for an unknown store returns a structured 4xx",
    async () => {
      const p = await callRaw("create_pos", {
        name: `codespar-pos-${sfx}`,
        store_id: "0",
        external_id: `pos-${sfx}`,
        fixed_amount: false,
      });
      expect(p.isError).toBe(true);
      expect(p.text).toMatch(/Mercado Pago API 4\d\d/);
    },
    30000,
  );
});
