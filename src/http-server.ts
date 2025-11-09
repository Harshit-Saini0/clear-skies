import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
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
import {
  summarizeRiskWithLLM,
  summarizeWeatherWithLLM,
  generateTravelBrief
} from "./llm-summary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.MCP_WS_PORT || "3000", 10);
const HOST = process.env.MCP_WS_HOST || "0.0.0.0";

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
// When compiled, this file is at dist/src/http-server.js
// So we need to go up two levels (../../public) to reach the root public folder
const publicPath = path.join(__dirname, "../../public");
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "clear-skies-mcp", version: "0.1.0" });
});

// List all available tools
app.get("/api/tools", (req: Request, res: Response) => {
  const tools = [
    {
      name: "parse_intent",
      description: "Parse a natural language request into a structured intent for travel risk tools.",
      endpoint: "/api/tools/parse_intent",
      method: "POST",
      input: { text: "string" }
    },
    {
      name: "flight_status",
      description: "Fetch live/scheduled flight status by IATA code and local date.",
      endpoint: "/api/tools/flight_status",
      method: "POST",
      input: { flightIata: "string", date: "string (YYYY-MM-DD)" }
    },
    {
      name: "airport_weather",
      description: "Get current/forecast weather near an airport IATA using WeatherAPI.",
      endpoint: "/api/tools/airport_weather",
      method: "POST",
      input: { iata: "string" }
    },
    {
      name: "tsa_wait_times",
      description: "Get recent TSA wait times for an airport by IATA via MyTSA legacy API.",
      endpoint: "/api/tools/tsa_wait_times",
      method: "POST",
      input: { iata: "string" }
    },
    {
      name: "news_search",
      description: "Search recent news for disruptions (strikes/outages/ATC/weather).",
      endpoint: "/api/tools/news_search",
      method: "POST",
      input: { query: "string", from: "string (optional)" }
    },
    {
      name: "risk_brief",
      description: "Compute a fused travel disruption risk brief for a flight.",
      endpoint: "/api/tools/risk_brief",
      method: "POST",
      input: { 
        flightIata: "string", 
        date: "string (YYYY-MM-DD)", 
        depIata: "string (optional)", 
        arrIata: "string (optional)",
        paxType: "domestic|international (optional)",
        targetArrivalLeadMins: "number (optional)"
      }
    },
    {
      name: "search_backup_flights",
      description: "Search for alternative flight options if current flight is at risk.",
      endpoint: "/api/tools/search_backup_flights",
      method: "POST",
      input: { origin: "string", destination: "string", date: "string (YYYY-MM-DD)", maxResults: "number (optional)" }
    },
    {
      name: "search_nearby_hotels",
      description: "Search for hotels near an airport with flexible cancellation policies.",
      endpoint: "/api/tools/search_nearby_hotels",
      method: "POST",
      input: { airportIata: "string", checkIn: "string (YYYY-MM-DD)", checkOut: "string (optional)", maxResults: "number (optional)" }
    },
    {
      name: "get_rebooking_policy",
      description: "Get airline rebooking and change policy information.",
      endpoint: "/api/tools/get_rebooking_policy",
      method: "POST",
      input: { airline: "string", fareClass: "string (optional)" }
    },
    {
      name: "generate_mitigation_plan",
      description: "Generate prioritized action plan based on risk assessment.",
      endpoint: "/api/tools/generate_mitigation_plan",
      method: "POST",
      input: { riskBrief: "object" }
    },
    {
      name: "summarize_risk_with_llm",
      description: "Generate natural language summary of risk assessment using Gemini AI.",
      endpoint: "/api/tools/summarize_risk_with_llm",
      method: "POST",
      input: { riskBrief: "object" }
    },
    {
      name: "summarize_weather_with_llm",
      description: "Generate conversational weather summary using Gemini AI.",
      endpoint: "/api/tools/summarize_weather_with_llm",
      method: "POST",
      input: { weatherData: "object" }
    },
    {
      name: "generate_travel_brief",
      description: "Generate comprehensive travel brief combining multiple data sources using Gemini AI.",
      endpoint: "/api/tools/generate_travel_brief",
      method: "POST",
      input: { data: "object" }
    }
  ];
  res.json({ tools });
});

// Parse Intent
app.post("/api/tools/parse_intent", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing required field: text" });
    }
    const intent = await parseIntent(text);
    res.json({ success: true, data: intent });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Flight Status
app.post("/api/tools/flight_status", async (req: Request, res: Response) => {
  try {
    const { flightIata, date } = req.body;
    if (!flightIata || !date) {
      return res.status(400).json({ error: "Missing required fields: flightIata, date" });
    }
    const data = await getFlightByIata({ flightIata, date });
    const summary = summarizeFlight(data);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Airport Weather
app.post("/api/tools/airport_weather", async (req: Request, res: Response) => {
  try {
    const { iata } = req.body;
    if (!iata) {
      return res.status(400).json({ error: "Missing required field: iata" });
    }
    const geo = await getAirportByIata(iata);
    if (!geo?.lat || !geo?.lon) {
      return res.status(404).json({ error: `Airport geocoding failed for ${iata}` });
    }
    const wx = await getForecast(geo.lat, geo.lon);
    const summary = summarizeWeather(geo, wx);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// TSA Wait Times
app.post("/api/tools/tsa_wait_times", async (req: Request, res: Response) => {
  try {
    const { iata } = req.body;
    if (!iata) {
      return res.status(400).json({ error: "Missing required field: iata" });
    }
    const data = await getTsaWaitTimes(iata);
    const summary = summarizeTsa(iata, data);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// News Search
app.post("/api/tools/news_search", async (req: Request, res: Response) => {
  try {
    const { query, from } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing required field: query" });
    }
    const hits = await searchNews(query, from);
    const summary = summarizeNews(query, hits);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Risk Brief
app.post("/api/tools/risk_brief", async (req: Request, res: Response) => {
  try {
    const { flightIata, date, depIata, arrIata, paxType, targetArrivalLeadMins } = req.body;
    if (!flightIata || !date) {
      return res.status(400).json({ error: "Missing required fields: flightIata, date" });
    }
    const params = { flightIata, date, depIata, arrIata, paxType, targetArrivalLeadMins };
    const brief = await buildRiskBrief(params);
    res.json({ success: true, data: brief });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Search Backup Flights
app.post("/api/tools/search_backup_flights", async (req: Request, res: Response) => {
  try {
    const { origin, destination, date, maxResults } = req.body;
    if (!origin || !destination || !date) {
      return res.status(400).json({ error: "Missing required fields: origin, destination, date" });
    }
    const results = await searchBackupFlights({ origin, destination, date, maxResults });
    res.json({ success: true, data: results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Search Nearby Hotels
app.post("/api/tools/search_nearby_hotels", async (req: Request, res: Response) => {
  try {
    const { airportIata, checkIn, checkOut, maxResults } = req.body;
    if (!airportIata || !checkIn) {
      return res.status(400).json({ error: "Missing required fields: airportIata, checkIn" });
    }
    const results = await searchNearbyHotels({ airportIata, checkIn, checkOut, maxResults });
    res.json({ success: true, data: results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Get Rebooking Policy
app.post("/api/tools/get_rebooking_policy", async (req: Request, res: Response) => {
  try {
    const { airline, fareClass } = req.body;
    if (!airline) {
      return res.status(400).json({ error: "Missing required field: airline" });
    }
    const policy = await getRebookingPolicy({ airline, fareClass });
    res.json({ success: true, data: policy });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Generate Mitigation Plan
app.post("/api/tools/generate_mitigation_plan", async (req: Request, res: Response) => {
  try {
    const { riskBrief } = req.body;
    if (!riskBrief) {
      return res.status(400).json({ error: "Missing required field: riskBrief" });
    }
    const plan = generateMitigationPlan(riskBrief);
    res.json({ success: true, data: plan });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Summarize Risk with LLM
app.post("/api/tools/summarize_risk_with_llm", async (req: Request, res: Response) => {
  try {
    const { riskBrief } = req.body;
    if (!riskBrief) {
      return res.status(400).json({ error: "Missing required field: riskBrief" });
    }
    const summary = await summarizeRiskWithLLM(riskBrief);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Summarize Weather with LLM
app.post("/api/tools/summarize_weather_with_llm", async (req: Request, res: Response) => {
  try {
    const { weatherData } = req.body;
    if (!weatherData) {
      return res.status(400).json({ error: "Missing required field: weatherData" });
    }
    const summary = await summarizeWeatherWithLLM(weatherData);
    res.json({ success: true, data: summary });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Generate Travel Brief
app.post("/api/tools/generate_travel_brief", async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: "Missing required field: data" });
    }
    const brief = await generateTravelBrief(data);
    res.json({ success: true, data: brief });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Tool dispatcher endpoint for frontend
app.post("/api/tools", async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body;
    
    if (name === 'analyze_travel_risk') {
      const { query } = args;
      
      // Parse intent and get risk brief
      const intent = await parseIntent(query);
      console.log('Intent:', intent);
      
      // Default to today if no date provided
      if (intent.flightIata && !intent.date) {
        intent.date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        console.log(`No date provided, defaulting to today: ${intent.date}`);
      }
      
      if (intent.flightIata && intent.date) {
        const riskBrief = await buildRiskBrief({
          flightIata: intent.flightIata,
          date: intent.date,
          depIata: intent.depIata,
          arrIata: intent.arrIata,
          paxType: intent.paxType
        });
        
        console.log('RiskBrief:', riskBrief);
        console.log(`Risk Score: ${riskBrief.riskScore} (${Math.round(riskBrief.riskScore * 100)}%)`);
        console.log(`Tier: ${riskBrief.tier}`);
        
        // Extract component details for better frontend display
        const opsComponent = riskBrief.components.find(c => c.key === 'ops');
        const wxDepComponent = riskBrief.components.find(c => c.key === 'weather_dep');
        const wxArrComponent = riskBrief.components.find(c => c.key === 'weather_arr');
        const tsaComponent = riskBrief.components.find(c => c.key === 'tsa');
        const newsComponent = riskBrief.components.find(c => c.key === 'news');
        
        // Build comprehensive analysis response
        const analysis = {
          totalScore: Math.round(riskBrief.riskScore * 100), // Convert 0-1 to 0-100
          tier: riskBrief.tier === 'green' ? 'Low Risk' : 
                riskBrief.tier === 'yellow' ? 'Medium Risk' : 'High Risk',
          riskScore: riskBrief.riskScore, // Keep original for calculations
          components: {
            operations: {
              score: Math.round((opsComponent?.score ?? 0) * 100),
              explanation: opsComponent?.explanation || 'No operations data',
              weight: opsComponent?.weight ?? 0
            },
            weather_departure: {
              score: Math.round((wxDepComponent?.score ?? 0) * 100),
              explanation: wxDepComponent?.explanation || 'No weather data',
              weight: wxDepComponent?.weight ?? 0
            },
            weather_arrival: {
              score: Math.round((wxArrComponent?.score ?? 0) * 100),
              explanation: wxArrComponent?.explanation || 'No weather data',
              weight: wxArrComponent?.weight ?? 0
            },
            tsa: {
              score: Math.round((tsaComponent?.score ?? 0) * 100),
              explanation: tsaComponent?.explanation || 'No TSA data',
              weight: tsaComponent?.weight ?? 0
            },
            news: {
              score: Math.round((newsComponent?.score ?? 0) * 100),
              explanation: newsComponent?.explanation || 'No news alerts',
              weight: newsComponent?.weight ?? 0
            }
          },
          topSignals: riskBrief.topSignals || [],
          recommendations: riskBrief.recommendedActions || ['Monitor flight status'],
          flightInfo: {
            flightIata: riskBrief.flightIata,
            date: riskBrief.date,
            departure: riskBrief.depIata || 'Unknown',
            arrival: riskBrief.arrIata || 'Unknown'
          },
          dataTimestamps: riskBrief.dataTimestamps
        };
        
        return res.json(analysis);
      } else {
        // Intent parsed but missing critical data
        return res.status(400).json({
          error: 'Could not extract flight information. Please provide flight number and date.',
          intent: intent
        });
      }
    }
    
    // Unknown tool or missing parameters
    res.status(400).json({
      error: 'Invalid tool name or missing parameters',
      expectedFormat: {
        name: 'analyze_travel_risk',
        arguments: { query: 'your natural language query' }
      }
    });
    
  } catch (error) {
    console.error('Tool dispatcher error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Analysis failed. Please try again.',
      details: errorMessage 
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Clear Skies HTTP API running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`API docs: http://${HOST}:${PORT}/api/tools`);
});

