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

process.env.VINDI_API_KEY = "test-key";

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

describe("mcp-vindi", () => {
  it("should register 20 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(20);
  });

  it("should call correct API endpoint for create_subscription", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ subscription: { id: 1 } }) });

    await callToolHandler({ params: { name: "create_subscription", arguments: { plan_id: 1, customer_id: 1 } } });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("app.vindi.com.br/api/v1/subscriptions");
    expect(opts.method).toBe("POST");
  });
});
