import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
async function main() {
    const [toolName, ...argsArray] = process.argv.slice(2);
    if (!toolName) {
        console.log("Usage: npm run prompt <tool_name> <json_args>");
        console.log("\nExamples:");
        console.log('  npm run prompt parse_intent \'{"text":"Check AA123 tomorrow from JFK; if risky hold a hotel."}\'');
        console.log('  npm run prompt flight_status \'{"flightIata":"AA123","date":"2025-11-09"}\'');
        console.log('  npm run prompt airport_weather \'{"iata":"LAX"}\'');
        console.log('  npm run prompt tsa_wait_times \'{"iata":"SFO"}\'');
        console.log('  npm run prompt news_search \'{"query":"airline strikes","from":"2025-11-01"}\'');
        console.log('  npm run prompt risk_brief \'{"flightIata":"AA123","date":"2025-11-09","depIata":"JFK","paxType":"domestic"}\'');
        process.exit(0);
    }
    const argsString = argsArray.join(" ");
    let args = {};
    if (argsString) {
        try {
            args = JSON.parse(argsString);
        }
        catch (e) {
            console.error("Error parsing JSON arguments:", e);
            console.error("Make sure to pass valid JSON, e.g.: '{\"text\":\"hello\"}'");
            process.exit(1);
        }
    }
    const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/src/server.js"],
    });
    const client = new Client({
        name: "clear-skies-interactive",
        version: "0.0.1"
    });
    await client.connect(transport);
    try {
        const result = await client.callTool({
            name: toolName,
            arguments: args
        });
        // Extract and display only the content
        const content = result.content;
        if (content && Array.isArray(content) && content.length > 0) {
            const textContent = content.find((c) => c.type === "text");
            if (textContent) {
                console.log(textContent.text);
            }
            else {
                console.log(JSON.stringify(content, null, 2));
            }
        }
        else {
            console.log(JSON.stringify(result, null, 2));
        }
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
    await client.close();
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
