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

process.env.PAGARME_API_KEY = "test-key";

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

describe("mcp-pagar-me", () => {
  it("should register 22 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(22);
  });

  it("should call correct API endpoint for get_order", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "or_123", status: "paid" }) });

    await callToolHandler({ params: { name: "get_order", arguments: { id: "or_123" } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.pagar.me/core/v5/orders/or_123");
    expect(opts.method).toBe("GET");
  });
});
