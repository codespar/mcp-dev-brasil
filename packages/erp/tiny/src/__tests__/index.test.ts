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

process.env.TINY_API_TOKEN = "test-token";

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

describe("mcp-tiny", () => {
  it("should register 21 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(21);
  });

  it("should call correct API endpoint for list_products", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ retorno: { produtos: [] } }) });

    await callToolHandler({ params: { name: "list_products", arguments: {} } });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("api.tiny.com.br/api2");
    expect(url).toContain("token=test-token");
    expect(url).toContain("formato=json");
  });
});
