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

process.env.CORREIOS_USER = "test-user";
process.env.CORREIOS_TOKEN = "test-token";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(async () => {
  vi.resetModules();
  listToolsHandler = undefined as any;
  callToolHandler = undefined as any;
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ token: "auth-tok", expiraEm: "2099-01-01" }) });
  await import("../index.js");
});

describe("mcp-correios", () => {
  it("should register 21 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(21);
  });

  it("should call correct API endpoint for track_package", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: "auth-tok", expiraEm: "2099-01-01" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ objetos: [] }) });

    await callToolHandler({ params: { name: "track_package", arguments: { code: "SS123456789BR" } } });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/srorastro/v1/objetos/SS123456789BR");
  });
});
