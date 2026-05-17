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

process.env.ZENVIA_API_TOKEN = "test-token";

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

describe("mcp-zenvia", () => {
  it("should register 18 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(18);
  });

  it("should call correct API endpoint for send_sms", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "msg1" }) });

    await callToolHandler({
      params: { name: "send_sms", arguments: { from: "sender", to: "5511999999999", text: "Hello" } },
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("api.zenvia.com/v2/channels/sms/messages");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-API-TOKEN"]).toBe("test-token");
  });
});
