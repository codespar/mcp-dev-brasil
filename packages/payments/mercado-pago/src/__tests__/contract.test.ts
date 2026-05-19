import { it, expect, beforeAll, vi } from "vitest";
import {
  loadContractEnv,
  describeContract,
  parseToolResult,
  assertCredentialAccepted,
} from "../../../../../test-utils/contract.js";

// --- Capture MCP handlers; do NOT mock fetch (real network) ---
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

describeContract("mcp-mercado-pago", "MP_TEST_ACCESS_TOKEN", () => {
  beforeAll(async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = process.env.MP_TEST_ACCESS_TOKEN;
    vi.resetModules();
    callToolHandler = undefined as any;
    await import("../index.js");
  });

  it(
    "authenticates and returns a real payment-methods contract",
    async () => {
      const result = await callToolHandler({
        params: { name: "get_payment_methods", arguments: {} },
      });
      const parsed = parseToolResult(result);
      assertCredentialAccepted(parsed, "Check MP_TEST_ACCESS_TOKEN in .env — it must be a valid TEST- sandbox token.");
      expect(parsed.isError).toBe(false);
      expect(Array.isArray(parsed.json)).toBe(true);
      expect((parsed.json as any[]).length).toBeGreaterThan(0);
      expect((parsed.json as any[])[0]).toHaveProperty("id");
    },
    20000,
  );

  it(
    "returns the real 404 error contract for an unknown payment",
    async () => {
      const result = await callToolHandler({
        params: { name: "get_payment", arguments: { paymentId: "0" } },
      });
      const parsed = parseToolResult(result);
      assertCredentialAccepted(parsed, "Check MP_TEST_ACCESS_TOKEN in .env — it must be a valid TEST- sandbox token.");
      expect(parsed.isError).toBe(true);
      expect(parsed.text).toContain("404");
    },
    20000,
  );
});
