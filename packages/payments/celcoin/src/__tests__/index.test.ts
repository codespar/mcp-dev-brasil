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

process.env.CELCOIN_CLIENT_ID = "test-id";
process.env.CELCOIN_CLIENT_SECRET = "test-secret";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(async () => {
  vi.resetModules();
  listToolsHandler = undefined as any;
  callToolHandler = undefined as any;
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
  // Mock OAuth token response for all requests
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ access_token: "tok", expires_in: 3600 }) });
  await import("../index.js");
});

describe("mcp-celcoin", () => {
  it("should register 18 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(18);
  });

  it("should call correct API endpoint for get_balance", async () => {
    // First call is OAuth token, second is the actual request
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ balance: 1000 }) });

    await callToolHandler({ params: { name: "get_balance", arguments: {} } });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/v5/merchant/balance");
  });
});
