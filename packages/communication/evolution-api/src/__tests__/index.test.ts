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

process.env.EVOLUTION_API_URL = "https://evo.example.com";
process.env.EVOLUTION_API_KEY = "test-key";

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

describe("mcp-evolution-api", () => {
  it("should register 25 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(25);
  });

  it("should call correct API endpoint for send_text", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ key: { id: "msg1" } }) });

    await callToolHandler({
      params: { name: "send_text", arguments: { instance: "mybot", number: "5511999999999", text: "Hello" } },
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/message/sendText/mybot");
    expect(opts.method).toBe("POST");
    expect(opts.headers.apikey).toBe("test-key");
  });
});
