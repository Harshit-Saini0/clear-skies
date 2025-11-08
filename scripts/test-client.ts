import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  // Spawn the MCP server as a child process
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/src/server.js"],
  });

  const client = new Client({ 
    name: "clear-skies-test", 
    version: "0.0.1" 
  });

  await client.connect(transport);
  console.log("Connected to MCP server");

  // List available tools
  const tools = await client.listTools();
  console.log("Available tools:", JSON.stringify(tools, null, 2));

  // Example: call risk_brief
  const res = await client.callTool({
    name: "risk_brief",
    arguments: {
      flightIata: "AA123",
      date: "2025-11-09",
      depIata: "JFK",
      paxType: "domestic"
    }
  });

  console.log("Risk brief result:", JSON.stringify(res, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
