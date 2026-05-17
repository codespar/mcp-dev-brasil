import { describe, it, expect, vi } from "vitest";

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class FakeServer {
    constructor() {}
    setRequestHandler() {}
    connect() { return Promise.resolve(); }
  }
  return { Server: FakeServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));

import { createNfseDemoResponse } from "../index.js";

describe("createNfseDemoResponse (demo mode)", () => {
  it("issues distinct fixture ids on consecutive calls within one process", () => {
    const first = createNfseDemoResponse({
      servico: { codigo: "1.05", descricao: "Consultoria" },
      valor: 1000.00,
    });
    const second = createNfseDemoResponse({
      servico: { codigo: "1.05", descricao: "Consultoria" },
      valor: 1000.00,
    });

    expect(first.id).toBe("nfse_demo_001");
    expect(second.id).toBe("nfse_demo_002");
    expect(first.id).not.toBe(second.id);
  });

  it("echoes input servico.codigo into response codigoServico", () => {
    const res = createNfseDemoResponse({
      servico: { codigo: "1.05", descricao: "Serviço de consultoria" },
      valor: 750.00,
    });
    expect(res.codigoServico).toBe("1.05");
  });

  it("echoes input valor into response valorServico", () => {
    const res = createNfseDemoResponse({
      servico: { codigo: "7.02", descricao: "Construção" },
      valor: 2800.00,
    });
    expect(res.valorServico).toBe(2800.00);
  });

  it("returns pdf_url matching the expected demo URL pattern", () => {
    const res = createNfseDemoResponse({
      servico: { codigo: "1.05", descricao: "Demo" },
      valor: 500.00,
    });
    expect(res.pdf_url).toBeTruthy();
    expect(res.pdf_url).toMatch(/^https:\/\/api\.nuvemfiscal\.com\.br\/demo\/nfse_demo_\d+\.pdf$/);
  });
});
