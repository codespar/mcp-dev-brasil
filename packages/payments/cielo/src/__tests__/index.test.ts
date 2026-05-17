import { describe, it, expect, vi, beforeEach } from "vitest";

let listToolsHandler: Function;
let callToolHandler: Function;

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class FakeServer {
    constructor() {}
    setRequestHandler(schema: any, handler: Function) {
      if (JSON.stringify(schema).includes("tools/list")) listToolsHandler = handler;
      if (JSON.stringify(schema).includes("tools/call")) callToolHandler = handler;
    }
    connect() { return Promise.resolve(); }
  }
  return { Server: FakeServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));

process.env.CIELO_MERCHANT_ID = "test-merchant-id";
process.env.CIELO_MERCHANT_KEY = "test-merchant-key";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(async () => {
  vi.resetModules();
  listToolsHandler = undefined as any;
  callToolHandler = undefined as any;
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
  await import("../index.js");
});

describe("mcp-cielo", () => {
  it("should register 22 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(22);
  });

  it("should call correct API endpoint for create_sale", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ Payment: { PaymentId: "abc" } }) });

    await callToolHandler({
      params: {
        name: "create_sale",
        arguments: {
          merchantOrderId: "order-1",
          customerName: "Test",
          amount: 10000,
          cardNumber: "4111111111111111",
          holder: "Test",
          expirationDate: "12/2030",
          securityCode: "123",
          brand: "Visa",
        },
      },
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/sales");
    expect(url).toContain("cieloecommerce.cielo.com.br");
    expect(opts.method).toBe("POST");
  });
});
