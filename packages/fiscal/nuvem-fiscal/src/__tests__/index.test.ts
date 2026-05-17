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

process.env.NUVEM_FISCAL_CLIENT_ID = "test-id";
process.env.NUVEM_FISCAL_CLIENT_SECRET = "test-secret";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(async () => {
  vi.resetModules();
  listToolsHandler = undefined as any;
  callToolHandler = undefined as any;
  mockFetch.mockReset();
  global.fetch = mockFetch as any;
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ access_token: "tok", expires_in: 3600 }) });
  await import("../index.js");
});

describe("mcp-nuvem-fiscal", () => {
  it("should register 24 tools", async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(24);
  });

  it("should call correct API endpoint for consult_cnpj", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "tok", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ cnpj: "12345678000100" }) });

    await callToolHandler({ params: { name: "consult_cnpj", arguments: { cnpj: "12345678000100" } } });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/cnpj/12345678000100");
  });
});
