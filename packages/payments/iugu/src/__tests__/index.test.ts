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

process.env.IUGU_API_TOKEN = "test-token";

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

describe("mcp-iugu", () => {
  it("should register 23 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(23);
  });

  it("should call correct API endpoint for get_invoice", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "inv_123", status: "paid" }) });

    await callToolHandler({ params: { name: "get_invoice", arguments: { id: "inv_123" } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.iugu.com/v1/invoices/inv_123");
    expect(opts.method).toBe("GET");
  });
});
