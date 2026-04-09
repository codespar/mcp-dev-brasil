/**
 * Test: Managed Agent using CodeSpar MCP server via MCP Connector
 * 
 * The agent connects to our deployed brasil-api MCP server on Railway
 * and uses its tools to answer questions.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MCP_URL = "https://mcp-dev-brasil-production.up.railway.app/mcp";

async function main() {
  console.log("\n  === MCP Connector Test ===\n");
  console.log(`  MCP Server: ${MCP_URL}\n`);

  // Use Messages API with MCP connector (server-side MCP)
  console.log("  [1] Calling Claude with MCP server connected...");
  
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: "You are a helpful assistant. Use the available MCP tools to look up Brazilian data when asked.",
    messages: [
      { role: "user", content: "Look up CEP 01001-000 using the MCP tools available to you. What address is it?" }
    ],
    // @ts-ignore — MCP connector may not be in SDK types yet
    mcp_servers: [
      { 
        type: "url",
        url: MCP_URL,
        name: "brasil-api",
      }
    ],
  });

  console.log("  [2] Response received.\n");
  
  for (const block of response.content) {
    if (block.type === "text") {
      console.log(`      ${block.text.slice(0, 500)}\n`);
    }
    if (block.type === "tool_use") {
      console.log(`      Tool: ${block.name}(${JSON.stringify(block.input)})\n`);
    }
  }

  console.log(`  Model: ${response.model}`);
  console.log(`  Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
  console.log(`  Stop: ${response.stop_reason}\n`);
}

main().catch((err) => {
  console.error("  Error:", err.message || err);
  console.error("\n  If mcp_servers is not supported, the MCP Connector");
  console.error("  may need to be enabled on your account.\n");
});
