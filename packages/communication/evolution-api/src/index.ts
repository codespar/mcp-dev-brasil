#!/usr/bin/env node

/**
 * MCP Server for Evolution API — self-hosted WhatsApp API.
 *
 * Tools:
 * - send_text: Send a text message
 * - send_image: Send an image message
 * - send_document: Send a document
 * - get_instances: List all instances
 * - create_instance: Create a new WhatsApp instance
 * - get_qrcode: Get QR code for instance pairing
 * - get_contacts: Get contacts from an instance
 * - send_poll: Send a poll message
 * - get_messages: Get messages from a chat
 * - check_number: Check if a number is on WhatsApp
 * - create_group: Create a WhatsApp group
 * - get_group_info: Get group metadata and participants
 * - update_profile: Update instance profile (name, picture, status)
 * - set_presence: Set online/offline presence for an instance
 * - get_chat_history: Get full chat history with pagination
 *
 * Environment:
 *   EVOLUTION_API_URL — Base URL of self-hosted Evolution API
 *   EVOLUTION_API_KEY — API key for authentication
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.EVOLUTION_API_URL || "";
const API_KEY = process.env.EVOLUTION_API_KEY || "";

async function evolutionRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution API ${res.status}: ${err}`);
  }
  return res.json();
}

const server = new Server(
  { name: "mcp-evolution-api", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_text",
      description: "Send a text message via WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          number: { type: "string", description: "Phone number with country code (e.g. 5511999999999)" },
          text: { type: "string", description: "Message text" },
        },
        required: ["instance", "number", "text"],
      },
    },
    {
      name: "send_image",
      description: "Send an image message via WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          number: { type: "string", description: "Phone number with country code" },
          mediaUrl: { type: "string", description: "Image URL" },
          caption: { type: "string", description: "Image caption" },
        },
        required: ["instance", "number", "mediaUrl"],
      },
    },
    {
      name: "send_document",
      description: "Send a document via WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          number: { type: "string", description: "Phone number with country code" },
          mediaUrl: { type: "string", description: "Document URL" },
          fileName: { type: "string", description: "File name" },
          caption: { type: "string", description: "Document caption" },
        },
        required: ["instance", "number", "mediaUrl"],
      },
    },
    {
      name: "get_instances",
      description: "List all WhatsApp instances",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "create_instance",
      description: "Create a new WhatsApp instance",
      inputSchema: {
        type: "object",
        properties: {
          instanceName: { type: "string", description: "Name for the instance" },
          qrcode: { type: "boolean", description: "Generate QR code on creation (default true)" },
        },
        required: ["instanceName"],
      },
    },
    {
      name: "get_qrcode",
      description: "Get QR code for instance pairing",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
        },
        required: ["instance"],
      },
    },
    {
      name: "get_contacts",
      description: "Get contacts from an instance",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
        },
        required: ["instance"],
      },
    },
    {
      name: "send_poll",
      description: "Send a poll message via WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          number: { type: "string", description: "Phone number with country code" },
          name: { type: "string", description: "Poll question" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Poll options (max 12)",
          },
          selectableCount: { type: "number", description: "Max selectable options (0 = unlimited)" },
        },
        required: ["instance", "number", "name", "options"],
      },
    },
    {
      name: "get_messages",
      description: "Get messages from a chat",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          remoteJid: { type: "string", description: "Chat JID (e.g. 5511999999999@s.whatsapp.net)" },
          limit: { type: "number", description: "Number of messages (default 20)" },
        },
        required: ["instance", "remoteJid"],
      },
    },
    {
      name: "check_number",
      description: "Check if a phone number is registered on WhatsApp",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          numbers: {
            type: "array",
            items: { type: "string" },
            description: "Phone numbers to check",
          },
        },
        required: ["instance", "numbers"],
      },
    },
    {
      name: "create_group",
      description: "Create a WhatsApp group",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          subject: { type: "string", description: "Group name/subject" },
          participants: {
            type: "array",
            items: { type: "string" },
            description: "Array of phone numbers to add (with country code)",
          },
          description: { type: "string", description: "Group description" },
        },
        required: ["instance", "subject", "participants"],
      },
    },
    {
      name: "get_group_info",
      description: "Get group metadata, participants, and settings",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          groupJid: { type: "string", description: "Group JID (e.g. 120363000000000000@g.us)" },
        },
        required: ["instance", "groupJid"],
      },
    },
    {
      name: "update_profile",
      description: "Update instance profile (name, status text, or picture)",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          name: { type: "string", description: "New profile name" },
          status: { type: "string", description: "New status text" },
          picture: { type: "string", description: "URL of profile picture" },
        },
        required: ["instance"],
      },
    },
    {
      name: "set_presence",
      description: "Set online/offline presence for an instance",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          presence: { type: "string", enum: ["available", "unavailable", "composing", "recording", "paused"], description: "Presence state" },
          number: { type: "string", description: "Target number (required for composing/recording)" },
        },
        required: ["instance", "presence"],
      },
    },
    {
      name: "get_chat_history",
      description: "Get full chat history with pagination support",
      inputSchema: {
        type: "object",
        properties: {
          instance: { type: "string", description: "Instance name" },
          remoteJid: { type: "string", description: "Chat JID (e.g. 5511999999999@s.whatsapp.net)" },
          limit: { type: "number", description: "Number of messages (default 50)" },
          offset: { type: "number", description: "Pagination offset (message index)" },
          fromMe: { type: "boolean", description: "Filter only sent messages" },
        },
        required: ["instance", "remoteJid"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send_text":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/message/sendText/${args?.instance}`, { number: args?.number, text: args?.text }), null, 2) }] };
      case "send_image":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/message/sendMedia/${args?.instance}`, { number: args?.number, mediatype: "image", media: args?.mediaUrl, caption: args?.caption }), null, 2) }] };
      case "send_document":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/message/sendMedia/${args?.instance}`, { number: args?.number, mediatype: "document", media: args?.mediaUrl, fileName: args?.fileName, caption: args?.caption }), null, 2) }] };
      case "get_instances":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("GET", "/instance/fetchInstances"), null, 2) }] };
      case "create_instance":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", "/instance/create", args), null, 2) }] };
      case "get_qrcode":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("GET", `/instance/connect/${args?.instance}`), null, 2) }] };
      case "get_contacts":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("GET", `/chat/contacts/${args?.instance}`), null, 2) }] };
      case "send_poll":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/message/sendPoll/${args?.instance}`, { number: args?.number, name: args?.name, values: args?.options, selectableCount: args?.selectableCount ?? 0 }), null, 2) }] };
      case "get_messages": {
        const body: Record<string, unknown> = { where: { key: { remoteJid: args?.remoteJid } } };
        if (args?.limit) body.limit = args.limit;
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/chat/findMessages/${args?.instance}`, body), null, 2) }] };
      }
      case "check_number":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/chat/whatsappNumbers/${args?.instance}`, { numbers: args?.numbers }), null, 2) }] };
      case "create_group":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/group/create/${args?.instance}`, { subject: args?.subject, participants: args?.participants, description: args?.description }), null, 2) }] };
      case "get_group_info":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("GET", `/group/findGroupInfos/${args?.instance}?groupJid=${args?.groupJid}`), null, 2) }] };
      case "update_profile": {
        const profileData: Record<string, unknown> = {};
        if (args?.name) profileData.name = args.name;
        if (args?.status) profileData.status = args.status;
        if (args?.picture) profileData.picture = args.picture;
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("PUT", `/instance/updateProfile/${args?.instance}`, profileData), null, 2) }] };
      }
      case "set_presence":
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/chat/setPresence/${args?.instance}`, { presence: args?.presence, number: args?.number }), null, 2) }] };
      case "get_chat_history": {
        const body: Record<string, unknown> = {
          where: { key: { remoteJid: args?.remoteJid } },
        };
        if (args?.limit) body.limit = args.limit;
        if (args?.offset) body.offset = args.offset;
        if (args?.fromMe !== undefined) body.where = { ...(body.where as Record<string, unknown>), key: { remoteJid: args?.remoteJid, fromMe: args.fromMe } };
        return { content: [{ type: "text", text: JSON.stringify(await evolutionRequest("POST", `/chat/findMessages/${args?.instance}`, body), null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

async function main() {
  if (!API_URL || !API_KEY) {
    console.error("EVOLUTION_API_URL and EVOLUTION_API_KEY environment variables are required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
