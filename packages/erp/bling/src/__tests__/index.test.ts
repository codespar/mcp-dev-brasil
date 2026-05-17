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

process.env.BLING_ACCESS_TOKEN = "test-token";

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

describe("mcp-bling", () => {
  it("should register 28 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(28);
  });

  it("should call correct API endpoint for list_products", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    await callToolHandler({ params: { name: "list_products", arguments: {} } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("bling.com.br/Api/v3");
    expect(opts.headers.Authorization).toBe("Bearer test-token");
  });
});
