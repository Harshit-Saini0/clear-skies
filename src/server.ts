import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { parseIntent } from "./intent.js";
import { getFlightByIata, getAirportByIata } from "./providers/aviationstack.js";
import { getForecast } from "./providers/weatherapi.js";
import { getTsaWaitTimes } from "./providers/tsa.js";
import { searchNews } from "./providers/newsdata.js";
import { buildRiskBrief } from "./risk.js";
import { 
  summarizeFlight, 
  summarizeWeather, 
  summarizeTsa, 
  summarizeNews 
} from "./summarizers.js";
import {
  searchBackupFlights,
  searchNearbyHotels,
  getRebookingPolicy,
  generateMitigationPlan
} from "./actions.js";

const server = new Server(
  { name: "clear-skies-mcp", version: "0.1.0" }
);

// Define available tools
const TOOLS = [
  {
    name: "parse_intent",
    description: "Parse a natural language request into a structured intent for travel risk tools.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Natural language travel query" } },
      required: ["text"]
    }
  },
  {
    name: "flight_status",
    description: "Fetch live/scheduled flight status by IATA code and local date.",
    inputSchema: {
      type: "object",
      properties: {
        flightIata: { type: "string", description: "Flight IATA code (e.g., AA100)" },
        date: { type: "string", description: "Flight date in YYYY-MM-DD format" }
      },
      required: ["flightIata", "date"]
    }
  },
  {
    name: "airport_weather",
    description: "Get current/forecast weather near an airport IATA using WeatherAPI.",
    inputSchema: {
      type: "object",
      properties: { iata: { type: "string", description: "Airport IATA code (e.g., LAX)" } },
      required: ["iata"]
    }
  },
  {
    name: "tsa_wait_times",
    description: "Get recent TSA wait times for an airport by IATA via MyTSA legacy API.",
    inputSchema: {
      type: "object",
      properties: { iata: { type: "string", description: "Airport IATA code (e.g., SFO)" } },
      required: ["iata"]
    }
  },
  {
    name: "news_search",
    description: "Search recent news for disruptions (strikes/outages/ATC/weather).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for news articles" },
        from: { type: "string", description: "ISO date or datetime to search from (optional)" }
      },
      required: ["query"]
    }
  },
  {
    name: "risk_brief",
    description: "Compute a fused travel disruption risk brief for a flight.",
    inputSchema: {
      type: "object",
      properties: {
        flightIata: { type: "string", description: "Flight IATA code" },
        date: { type: "string", description: "Flight date YYYY-MM-DD" },
        depIata: { type: "string", description: "Departure airport IATA (optional)" },
        arrIata: { type: "string", description: "Arrival airport IATA (optional)" },
        paxType: { type: "string", enum: ["domestic","international"], description: "Passenger type (optional)" },
        targetArrivalLeadMins: { type: "number", description: "Target arrival lead time in minutes (optional)" }
      },
      required: ["flightIata", "date"]
    }
  },
  {
    name: "search_backup_flights",
    description: "Search for alternative flight options if current flight is at risk.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Origin airport IATA" },
        destination: { type: "string", description: "Destination airport IATA" },
        date: { type: "string", description: "Desired departure date YYYY-MM-DD" },
        maxResults: { type: "number", description: "Maximum number of results (optional)" }
      },
      required: ["origin", "destination", "date"]
    }
  },
  {
    name: "search_nearby_hotels",
    description: "Search for hotels near an airport with flexible cancellation policies.",
    inputSchema: {
      type: "object",
      properties: {
        airportIata: { type: "string", description: "Airport IATA code" },
        checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
        checkOut: { type: "string", description: "Check-out date YYYY-MM-DD (optional)" },
        maxResults: { type: "number", description: "Maximum number of results (optional)" }
      },
      required: ["airportIata", "checkIn"]
    }
  },
  {
    name: "get_rebooking_policy",
    description: "Get airline rebooking and change policy information.",
    inputSchema: {
      type: "object",
      properties: {
        airline: { type: "string", description: "Airline name or code" },
        fareClass: { type: "string", description: "Fare class (optional)" }
      },
      required: ["airline"]
    }
  },
  {
    name: "generate_mitigation_plan",
    description: "Generate prioritized action plan based on risk assessment.",
    inputSchema: {
      type: "object",
      properties: {
        riskBrief: { type: "object", description: "Risk brief object from risk_brief tool" }
      },
      required: ["riskBrief"]
    }
  }
];

// Handle tools/list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tools/call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "parse_intent": {
        const schema = z.object({ text: z.string().min(1) });
        const { text } = schema.parse(args);
        const intent = await parseIntent(text);
        return { 
          content: [{ type: "text", text: JSON.stringify(intent, null, 2) }] 
        };
      }

      case "flight_status": {
        const schema = z.object({ flightIata: z.string(), date: z.string() });
        const params = schema.parse(args);
        const data = await getFlightByIata(params);
        const summary = summarizeFlight(data);
        return { 
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] 
        };
      }

      case "airport_weather": {
        const schema = z.object({ iata: z.string() });
        const { iata } = schema.parse(args);
        const geo = await getAirportByIata(iata);
        if (!geo?.lat || !geo?.lon) {
          throw new Error(`Airport geocoding failed for ${iata}`);
        }
        const wx = await getForecast(geo.lat, geo.lon);
        const summary = summarizeWeather(geo, wx);
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(summary, null, 2) 
          }] 
        };
      }

      case "tsa_wait_times": {
        const schema = z.object({ iata: z.string() });
        const { iata } = schema.parse(args);
        const data = await getTsaWaitTimes(iata);
        const summary = summarizeTsa(iata, data);
        return { 
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] 
        };
      }

      case "news_search": {
        const schema = z.object({ 
          query: z.string(), 
          from: z.string().optional() 
        });
        const { query, from } = schema.parse(args);
        const hits = await searchNews(query, from);
        const summary = summarizeNews(query, hits);
        return { 
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] 
        };
      }

      case "risk_brief": {
        const schema = z.object({
          flightIata: z.string(),
          date: z.string(),
          depIata: z.string().optional(),
          arrIata: z.string().optional(),
          paxType: z.enum(["domestic","international"]).optional(),
          targetArrivalLeadMins: z.number().optional()
        });
        const params = schema.parse(args);
        const brief = await buildRiskBrief(params);
        return { 
          content: [{ type: "text", text: JSON.stringify(brief, null, 2) }] 
        };
      }

      case "search_backup_flights": {
        const schema = z.object({
          origin: z.string(),
          destination: z.string(),
          date: z.string(),
          maxResults: z.number().optional()
        });
        const params = schema.parse(args);
        const results = await searchBackupFlights(params);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
        };
      }

      case "search_nearby_hotels": {
        const schema = z.object({
          airportIata: z.string(),
          checkIn: z.string(),
          checkOut: z.string().optional(),
          maxResults: z.number().optional()
        });
        const params = schema.parse(args);
        const results = await searchNearbyHotels(params);
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
        };
      }

      case "get_rebooking_policy": {
        const schema = z.object({
          airline: z.string(),
          fareClass: z.string().optional()
        });
        const params = schema.parse(args);
        const policy = await getRebookingPolicy(params);
        return {
          content: [{ type: "text", text: JSON.stringify(policy, null, 2) }]
        };
      }

      case "generate_mitigation_plan": {
        const schema = z.object({
          riskBrief: z.any()
        });
        const { riskBrief } = schema.parse(args);
        const plan = generateMitigationPlan(riskBrief);
        return {
          content: [{ type: "text", text: JSON.stringify(plan, null, 2) }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clear Skies MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
