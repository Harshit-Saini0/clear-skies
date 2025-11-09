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
  const system = [
    "You are an intent parser for air travel risk checks.",
    "Extract flight number (flightIata like 'AA123'), date (YYYY-MM-DD format), and airport codes.",
    "IMPORTANT: Extract flightIata and date as separate fields, not in query.",
    "For relative dates like 'tomorrow', 'today', calculate from November 8, 2025.",
    "Return strict JSON matching the schema."
  ].join(" ");
  
  const schema = {
    type: "OBJECT",
    properties: {
      kind: { type: "STRING", enum: ["risk_check","flight_status","airport_weather","tsa_wait","news_search"], description: "Type of request - use risk_check for general flight checks" },
      flightIata: { type: "STRING", description: "Flight code like AA123, UA100, DL456 - REQUIRED for flight queries" },
      date: { type: "STRING", description: "Date in YYYY-MM-DD format - REQUIRED for flight queries" },
      depIata: { type: "STRING", description: "Departure airport code like JFK, LAX, ORD" },
      arrIata: { type: "STRING", description: "Arrival airport code" },
      paxType: { type: "STRING", enum: ["domestic","international"] },
      thresholds: {
        type: "OBJECT",
        properties: { riskTier: { type: "STRING", enum: ["green","yellow","red"] } }
      },
      actions: {
        type: "OBJECT",
        properties: {
          holdHotel: { type: "BOOLEAN" },
          holdAltFlight: { type: "BOOLEAN" }
        }
      },
      query: { type: "STRING", description: "Only for news_search queries, not for flight information" }
    },
    required: ["kind"]
  } as any;

  const resp = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: system + "\nUser: " + natural }]}],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const text = resp.response.text();
  return JSON.parse(text);
}