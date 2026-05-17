import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Capture MCP handlers by mocking the SDK
// ---------------------------------------------------------------------------
let listToolsHandler: Function;
let callToolHandler: Function;

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class FakeServer {
    constructor() {}
    setRequestHandler(schema: any, handler: Function) {
      if (JSON.stringify(schema).includes("tools/list")) {
        listToolsHandler = handler;
      }
      if (JSON.stringify(schema).includes("tools/call")) {
        callToolHandler = handler;
      }
    }
    connect() {
      return Promise.resolve();
    }
  }
  return { Server: FakeServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {},
}));

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("mcp-brasil-api", () => {
  const EXPECTED_TOOLS = [
    "get_cep",
    "get_cnpj",
    "get_banks",
    "get_holidays",
    "get_fipe_brands",
    "get_fipe_price",
    "get_ddd",
    "get_isbn",
    "get_ncm",
    "get_cptec_weather",
    "get_pix_participants",
    "get_domain_info",
    "get_ibge_municipalities",
    "get_tax_rates",
    "get_cptec_cities",
  ];

  describe("ListTools", () => {
    it("should register exactly 24 tools", async () => {
      const result = await listToolsHandler();
      expect(result.tools).toHaveLength(24);
    });

    it("should include all expected tool names", async () => {
      const result = await listToolsHandler();
      const names = result.tools.map((t: any) => t.name);
      for (const name of EXPECTED_TOOLS) {
        expect(names).toContain(name);
      }
    });

    it("every tool should have an inputSchema", async () => {
      const result = await listToolsHandler();
      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });
  });

  describe("get_cep", () => {
    it("should look up a CEP and return address data", async () => {
      const mockAddress = {
        cep: "01001000",
        state: "SP",
        city: "São Paulo",
        neighborhood: "Sé",
        street: "Praça da Sé",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAddress),
      });

      const result = await callToolHandler({
        params: { name: "get_cep", arguments: { cep: "01001000" } },
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://brasilapi.com.br/api/cep/v2/01001000");
      expect(opts.method).toBe("GET");

      const text = JSON.parse(result.content[0].text);
      expect(text.cep).toBe("01001000");
      expect(text.city).toBe("São Paulo");
    });
  });

  describe("get_cnpj", () => {
    it("should look up a CNPJ and return company data", async () => {
      const mockCompany = {
        cnpj: "19131243000197",
        razao_social: "Test Company LTDA",
        nome_fantasia: "Test Co",
        situacao_cadastral: "Ativa",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompany),
      });

      const result = await callToolHandler({
        params: { name: "get_cnpj", arguments: { cnpj: "19131243000197" } },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://brasilapi.com.br/api/cnpj/v1/19131243000197");

      const text = JSON.parse(result.content[0].text);
      expect(text.razao_social).toBe("Test Company LTDA");
    });
  });

  describe("invalid input handling", () => {
    it("should return error for non-existent CEP (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"message":"CEP 99999999 not found"}'),
      });

      const result = await callToolHandler({
        params: { name: "get_cep", arguments: { cep: "99999999" } },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("404");
    });

    it("should return error for invalid CNPJ (400)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":"CNPJ inválido"}'),
      });

      const result = await callToolHandler({
        params: { name: "get_cnpj", arguments: { cnpj: "00000000000000" } },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("400");
    });

    it("should return isError true for unknown tool", async () => {
      const result = await callToolHandler({
        params: { name: "nonexistent", arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("get_banks", () => {
    it("should GET /banks/v1 with no arguments", async () => {
      const mockBanks = [
        { ispb: "00000000", name: "BCB", code: 0 },
        { ispb: "60701190", name: "Itaú", code: 341 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBanks),
      });

      const result = await callToolHandler({
        params: { name: "get_banks", arguments: {} },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://brasilapi.com.br/api/banks/v1");

      const text = JSON.parse(result.content[0].text);
      expect(text).toHaveLength(2);
    });
  });

  describe("get_holidays", () => {
    it("should GET /feriados/v1/:year", async () => {
      const mockHolidays = [
        { date: "2026-01-01", name: "Confraternização Universal", type: "national" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHolidays),
      });

      const result = await callToolHandler({
        params: { name: "get_holidays", arguments: { year: 2026 } },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://brasilapi.com.br/api/feriados/v1/2026");

      const text = JSON.parse(result.content[0].text);
      expect(text[0].name).toBe("Confraternização Universal");
    });
  });

  describe("API error handling", () => {
    it("should return isError true on 500 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await callToolHandler({
        params: { name: "get_banks", arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("500");
    });
  });
});
