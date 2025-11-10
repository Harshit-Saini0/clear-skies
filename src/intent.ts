import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export interface ParsedIntent {
  kind: "risk_check" | "flight_status" | "airport_weather" | "tsa_wait" | "news_search";
  flightIata?: string;
  date?: string;       // YYYY-MM-DD
  depIata?: string;
  arrIata?: string;
  paxType?: "domestic"|"international";
  thresholds?: { riskTier?: "green"|"yellow"|"red" };
  actions?: { holdHotel?: boolean; holdAltFlight?: boolean };
  query?: string;      // for news
}

export async function parseIntent(natural: string): Promise<ParsedIntent> {
  // Calculate current date for relative date parsing
  const today = new Date("2025-11-09"); // November 9, 2025
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
const system = [
  "You are an intent parser for air travel risk checks.",
  "Extract flight number (flightIata like 'AA123' or phrases like 'United 456' converted to airline code+number), date (YYYY-MM-DD), and airport codes (3-letter).",
  "CRITICAL: Always provide flightIata and date as separate fields (never put them in 'query'); TODAY is 2025-11-09 and TOMORROW is 2025-11-10 — convert relative dates accordingly.",
  "For flight-related queries set kind='risk_check' and try to populate depIata/arrIata when available.",
  "Return strict JSON matching the schema."
].join(" ");
  
  const schema = {
    type: "OBJECT",
    properties: {
      kind: { 
        type: "STRING", 
        enum: ["risk_check","flight_status","airport_weather","tsa_wait","news_search"], 
        description: "Type of request - use 'risk_check' for all flight safety/risk queries" 
      },
      flightIata: { 
        type: "STRING", 
        description: "Flight code in format: 2-letter airline code + number (e.g., AA123, UA100, DL456). ALWAYS extract this for flight queries. Common airlines: AA, UA, DL, SW, B6, NK, F9, AS, WN." 
      },
      date: { 
        type: "STRING", 
        description: "Date in YYYY-MM-DD format. TODAY=2025-11-09, TOMORROW=2025-11-10. ALWAYS provide date for flight queries." 
      },
      depIata: { 
        type: "STRING", 
        description: "Departure airport 3-letter code (JFK, LAX, ORD, ATL, DFW, DEN, SFO, etc.)" 
      },
      arrIata: { 
        type: "STRING", 
        description: "Arrival airport 3-letter code" 
      },
      paxType: { 
        type: "STRING", 
        enum: ["domestic","international"],
        description: "Passenger type based on flight route" 
      },
      thresholds: {
        type: "OBJECT",
        properties: { riskTier: { type: "STRING", enum: ["green","yellow","red"] } }
      },
      actions: {
        type: "OBJECT",
        properties: {
          holdHotel: { type: "BOOLEAN", description: "User wants hotel backup" },
          holdAltFlight: { type: "BOOLEAN", description: "User wants backup flight" }
        }
      },
      query: { 
        type: "STRING", 
        description: "ONLY for news_search kind. DO NOT put flight information here." 
      }
    },
    required: ["kind"]
  } as any;

  const resp = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: system + "\n\nUser query: " + natural + "\n\nParse this into structured JSON:" }]}],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const text = resp.response.text();
  const parsed = JSON.parse(text);
  
  // Post-processing: If we detect a flight pattern but Gemini missed it, extract manually
  const flightMatch = natural.match(/\b([A-Z]{2})\s*(\d{1,4})\b/i);
  if (flightMatch && !parsed.flightIata) {
    parsed.flightIata = (flightMatch[1].toUpperCase() + flightMatch[2]);
    console.log(`[Intent] Manual extraction of flight: ${parsed.flightIata}`);
  }
  
  // Extract common airline names and convert to codes
  const airlineMap: Record<string, string> = {
    'american': 'AA', 'united': 'UA', 'delta': 'DL', 'southwest': 'WN',
    'jetblue': 'B6', 'spirit': 'NK', 'frontier': 'F9', 'alaska': 'AS'
  };
  
  for (const [name, code] of Object.entries(airlineMap)) {
    const match = natural.match(new RegExp(`\\b${name}\\s+(\\d{1,4})\\b`, 'i'));
    if (match && !parsed.flightIata) {
      parsed.flightIata = code + match[1];
      console.log(`[Intent] Converted "${name} ${match[1]}" to ${parsed.flightIata}`);
    }
  }
  
  // If still no date but found relative date keywords, set default
  if (!parsed.date && (parsed.flightIata || parsed.kind === 'risk_check')) {
    if (/tomorrow/i.test(natural)) {
      parsed.date = tomorrow.toISOString().split('T')[0];
    } else if (/today|now|current/i.test(natural)) {
      parsed.date = today.toISOString().split('T')[0];
    } else {
      // Default to tomorrow for flight checks without explicit date
      parsed.date = tomorrow.toISOString().split('T')[0];
    }
    console.log(`[Intent] Inferred date: ${parsed.date}`);
  }
  
  return parsed;
}