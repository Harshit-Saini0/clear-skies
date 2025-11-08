import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testTool(client: Client, name: string, args: any) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Arguments:`, JSON.stringify(args, null, 2));
  console.log("-".repeat(60));
  
  try {
    const res = await client.callTool({ name, arguments: args });
    console.log("✓ Success!");
    console.log(JSON.stringify(res, null, 2));
    return true;
  } catch (error) {
    console.error("✗ Error:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/src/server.js"],
  });

  const client = new Client({ 
    name: "clear-skies-test-all", 
    version: "0.0.1" 
  });

  await client.connect(transport);
  console.log("✓ Connected to MCP server\n");

  // Test each tool
  const results: Record<string, boolean> = {};

  // 1. Parse Intent
  results["parse_intent"] = await testTool(client, "parse_intent", {
    text: "Check my American Airlines flight AA100 tomorrow from JFK"
  });

  // 2. Flight Status
  results["flight_status"] = await testTool(client, "flight_status", {
    flightIata: "UA1",
    date: "2025-11-09"
  });

  // 3. Airport Weather
  results["airport_weather"] = await testTool(client, "airport_weather", {
    iata: "LAX"
  });

  // 4. TSA Wait Times
  results["tsa_wait_times"] = await testTool(client, "tsa_wait_times", {
    iata: "SFO"
  });

  // 5. News Search
  results["news_search"] = await testTool(client, "news_search", {
    query: "airline delays OR weather disruption",
    from: "2025-11-01"
  });

  // 6. Risk Brief
  results["risk_brief"] = await testTool(client, "risk_brief", {
    flightIata: "UA1",
    date: "2025-11-09",
    depIata: "EWR",
    paxType: "domestic"
  });

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = Object.values(results).filter(v => v).length;
  const total = Object.keys(results).length;
  
  for (const [tool, success] of Object.entries(results)) {
    console.log(`${success ? "✓" : "✗"} ${tool}`);
  }
  
  console.log(`\nTotal: ${passed}/${total} tools working`);
  
  await client.close();
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
