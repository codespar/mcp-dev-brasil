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

process.env.ZAPI_INSTANCE_ID = "inst-123";
process.env.ZAPI_TOKEN = "tok-abc";

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
describe("mcp-z-api", () => {
  const EXPECTED_TOOLS = [
    "send_text",
    "send_image",
    "send_document",
    "send_audio",
    "get_contacts",
    "check_number",
    "get_profile_picture",
    "get_messages",
    "send_button_list",
    "get_status",
    "create_group",
    "get_group_metadata",
    "add_group_participant",
    "remove_group_participant",
    "send_location",
    "send_contact",
    "add_label",
    "get_labels",
    "read_message",
    "delete_message",
  ];

  describe("ListTools", () => {
    it("should register exactly 20 tools", async () => {
      const result = await listToolsHandler();
      expect(result.tools).toHaveLength(20);
    });

    it("should include all expected tool names", async () => {
      const result = await listToolsHandler();
      const names = result.tools.map((t: any) => t.name);
      for (const name of EXPECTED_TOOLS) {
        expect(names).toContain(name);
      }
    });
  });

  describe("send_text", () => {
    it("should POST to /send-text with phone and message", async () => {
      const mockResponse = { zapiMessageId: "msg_123", messageId: "abc" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await callToolHandler({
        params: {
          name: "send_text",
          arguments: { phone: "5511999999999", message: "Hello from test" },
        },
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/send-text");
      expect(url).toContain("inst-123");
      expect(url).toContain("tok-abc");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toMatchObject({
        phone: "5511999999999",
        message: "Hello from test",
      });

      const text = JSON.parse(result.content[0].text);
      expect(text.zapiMessageId).toBe("msg_123");
    });
  });

  describe("send_image", () => {
    it("should POST to /send-image with phone, image, and optional caption", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ zapiMessageId: "img_123" }),
      });

      const result = await callToolHandler({
        params: {
          name: "send_image",
          arguments: {
            phone: "5511999999999",
            image: "https://example.com/photo.jpg",
            caption: "Look at this",
          },
        },
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/send-image");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body);
      expect(body.image).toBe("https://example.com/photo.jpg");
      expect(body.caption).toBe("Look at this");

      expect(result.isError).toBeUndefined();
    });
  });

  describe("API error handling", () => {
    it("should return isError true on 400 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request: invalid phone"),
      });

      const result = await callToolHandler({
        params: {
          name: "send_text",
          arguments: { phone: "invalid", message: "test" },
        },
      });

      expect(result.isError).toBe(true);
    });

    it("should return isError true on 500 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const result = await callToolHandler({
        params: { name: "get_contacts", arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("500");
    });

    it("should return isError true for unknown tool", async () => {
      const result = await callToolHandler({
        params: { name: "nonexistent", arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("get_status", () => {
    it("should GET /status to check instance connection", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ connected: true, smartphoneConnected: true }),
      });

      const result = await callToolHandler({
        params: { name: "get_status", arguments: {} },
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/status");
      expect(opts.method).toBe("GET");

      const text = JSON.parse(result.content[0].text);
      expect(text.connected).toBe(true);
    });
  });

  describe("create_group", () => {
    it("should POST to /create-group with name and phones", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ phone: "5511999999999-group" }),
      });

      const result = await callToolHandler({
        params: {
          name: "create_group",
          arguments: {
            groupName: "Test Group",
            phones: ["5511999999999", "5511888888888"],
          },
        },
      });

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.groupName).toBe("Test Group");
      expect(body.phones).toHaveLength(2);

      expect(result.isError).toBeUndefined();
    });
  });

  describe("BASE_URL construction", () => {
    it("should include instance ID and token in the URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await callToolHandler({
        params: { name: "get_contacts", arguments: {} },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("api.z-api.io/instances/inst-123/token/tok-abc");
    });
  });
});
