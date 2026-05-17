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

process.env.VTEX_ACCOUNT_NAME = "teststore";
process.env.VTEX_APP_KEY = "test-key";
process.env.VTEX_APP_TOKEN = "test-token";

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

describe("mcp-vtex", () => {
  it("should register 33 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(33);
  });

  it("should call correct API endpoint for get_order", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ orderId: "v123" }) });

    await callToolHandler({ params: { name: "get_order", arguments: { orderId: "v123" } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("vtexcommercestable.com.br/api");
    expect(opts.headers["X-VTEX-API-AppKey"]).toBe("test-key");
  });
});
