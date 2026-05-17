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

process.env.CIRCLE_API_KEY = "test-key";

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

describe("mcp-circle", () => {
  it("should register 23 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(23);
  });

  it("should call correct API endpoint for create_wallet", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { walletId: "w1" } }) });

    await callToolHandler({ params: { name: "create_wallet", arguments: { idempotencyKey: "key1" } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.circle.com/v1/businessAccount/wallets");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer test-key");
  });
});
