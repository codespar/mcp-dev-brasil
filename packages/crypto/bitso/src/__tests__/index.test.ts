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

process.env.BITSO_API_KEY = "test-key";
process.env.BITSO_API_SECRET = "test-secret";

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

describe("mcp-bitso", () => {
  it("should register 20 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(20);
  });

  it("should call correct API endpoint for get_ticker", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true, payload: { last: "100000" } }) });

    await callToolHandler({ params: { name: "get_ticker", arguments: { book: "btc_brl" } } });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("api.bitso.com/v3/ticker");
    expect(url).toContain("book=btc_brl");
  });
});
