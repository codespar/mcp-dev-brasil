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

process.env.FOCUS_NFE_TOKEN = "test-token";

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

describe("mcp-focus-nfe", () => {
  it("should register 19 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(19);
  });

  it("should call correct API endpoint for get_nfe", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ref: "ref123", status: "autorizado" }) });

    await callToolHandler({ params: { name: "get_nfe", arguments: { ref: "ref123" } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/nfe/ref123");
    expect(url).toContain("focusnfe.com.br");
    expect(opts.method).toBe("GET");
  });
});
