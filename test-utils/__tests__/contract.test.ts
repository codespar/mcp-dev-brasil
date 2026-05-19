import { describe, it, expect } from "vitest";
import { parseToolResult } from "../contract.js";

describe("parseToolResult", () => {
  it("extracts text and parsed JSON from a success result", () => {
    const result = {
      content: [{ type: "text", text: '{"id":"abc","status":"approved"}' }],
    };
    const parsed = parseToolResult(result);
    expect(parsed.isError).toBe(false);
    expect(parsed.text).toContain("approved");
    expect(parsed.json).toEqual({ id: "abc", status: "approved" });
  });

  it("flags isError and keeps non-JSON text as null json", () => {
    const result = {
      content: [{ type: "text", text: "Error: Mercado Pago API 404: not found" }],
      isError: true,
    };
    const parsed = parseToolResult(result);
    expect(parsed.isError).toBe(true);
    expect(parsed.text).toContain("404");
    expect(parsed.json).toBeNull();
  });
});
