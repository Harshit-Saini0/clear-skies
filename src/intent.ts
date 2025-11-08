import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
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
    "You are an intent parser for air travel risk checks and related tools.",
    "Return strict JSON matching the schema. Never return text outside JSON."
  ].join(" ");
  const schema = {
    type: "OBJECT",
    properties: {
      kind: { type: "STRING", enum: ["risk_check","flight_status","airport_weather","tsa_wait","news_search"] },
      flightIata: { type: "STRING" },
      date: { type: "STRING", description: "YYYY-MM-DD" },
      depIata: { type: "STRING" },
      arrIata: { type: "STRING" },
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
      query: { type: "STRING" }
    }
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