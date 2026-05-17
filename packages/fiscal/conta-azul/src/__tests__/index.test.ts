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

process.env.CONTA_AZUL_ACCESS_TOKEN = "test-token";

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

describe("mcp-conta-azul", () => {
  it("should register 20 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(20);
  });

  it("should call correct API endpoint for list_customers", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    await callToolHandler({ params: { name: "list_customers", arguments: {} } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.contaazul.com/v1/customers");
    expect(opts.headers.Authorization).toBe("Bearer test-token");
  });
});
