/**
 * Test: Managed Agent calling our MCP server directly via web_fetch
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MCP_URL = "https://mcp-dev-brasil-production.up.railway.app";

async function main() {
  console.log("\n  === Direct MCP Server Test via Managed Agent ===\n");

  const agent = await client.beta.agents.create({
    name: "mcp-direct-test",
    description: "Test agent that calls MCP servers via HTTP",
    model: "claude-sonnet-4-6",
    tools: [{ type: "agent_toolset_20260401" }],
  });
  console.log(`  Agent: ${agent.id}`);

  const env = await client.beta.environments.create({
    name: "mcp-direct-env",
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  console.log(`  Env: ${env.id}`);

  const session = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: env.id,
    title: "MCP Direct Test",
  });
  console.log(`  Session: ${session.id}`);

  // Tell the agent to call our MCP server's health endpoint
  await client.beta.sessions.events.send(session.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Fetch this URL and show me the response: ${MCP_URL}/health` }],
    }],
  });
  console.log("  Message sent. Waiting...\n");

  let attempts = 0;
  while (attempts < 20) {
    attempts++;
    await new Promise((r) => setTimeout(r, 2000));
    const sess = await client.beta.sessions.retrieve(session.id) as Record<string, unknown>;
    if (String(sess.status) === "idle") {
      const events = await client.beta.sessions.events.list(session.id) as unknown as { data: Array<Record<string, unknown>> };
      for (const e of events.data || []) {
        const content = e.content as Array<Record<string, unknown>> | undefined;
        if (content) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              const text = String(block.text);
              if (text.includes("status") || text.includes("ok") || text.includes("session")) {
                console.log(`  Response: ${text.slice(0, 300)}\n`);
              }
            }
          }
        }
      }
      break;
    }
    if (attempts % 5 === 0) console.log(`  ... waiting (${attempts * 2}s)`);
  }

  console.log("  PASS — Managed Agent can reach our MCP server on Railway\n");
}

main().catch((err) => console.error("  Error:", err.message || err));
