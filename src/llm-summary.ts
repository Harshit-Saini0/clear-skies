/**
 * LLM-powered summarizer using Gemini
 * Demonstrates how to consume our concise API outputs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RiskBrief } from "./types.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
});

/**
 * Generate a natural language summary of risk assessment
 */
export async function summarizeRiskWithLLM(riskBrief: RiskBrief): Promise<string> {
  const prompt = `You are a travel assistant. Analyze this flight risk assessment and provide a concise, helpful summary for the traveler.

Risk Assessment Data:
${JSON.stringify(riskBrief, null, 2)}

Provide a 3-4 sentence summary that:
1. States the overall risk level clearly
2. Mentions the top 2-3 risk factors
3. Gives specific, actionable advice
4. Uses a friendly but professional tone

Keep it under 100 words.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // Fallback to structured summary if LLM fails
    return generateFallbackSummary(riskBrief);
  }
}

/**
 * Fallback summary if LLM is unavailable
 */
function generateFallbackSummary(riskBrief: RiskBrief): string {
  const { tier, riskScore, topSignals, recommendedActions } = riskBrief;
  
  let summary = "";
  
  // Opening
  if (tier === "green") {
    summary = `✅ Your flight looks good! Risk score: ${(riskScore * 100).toFixed(0)}% (Green). `;
  } else if (tier === "yellow") {
    summary = `⚠️ Moderate risk detected. Risk score: ${(riskScore * 100).toFixed(0)}% (Yellow). `;
  } else {
    summary = `🚨 High risk alert! Risk score: ${(riskScore * 100).toFixed(0)}% (Red). `;
  }
  
  // Top signals
  if (topSignals.length > 0) {
    const signals = topSignals.slice(0, 2).map(s => {
      const key = s.split(':')[0].trim();
      return key;
    }).join(' and ');
    summary += `Main concerns: ${signals}. `;
  }
  
  // Action
  if (recommendedActions.length > 0) {
    summary += recommendedActions[0];
  }
  
  return summary;
}

/**
 * Generate conversational response to weather data
 */
export async function summarizeWeatherWithLLM(weatherData: any): Promise<string> {
  const prompt = `You are a travel assistant. Summarize this airport weather for a traveler:

${JSON.stringify(weatherData, null, 2)}

Provide a 2-3 sentence weather brief that mentions:
- Current conditions
- Any hazards or alerts
- Whether it's good for flying

Keep it conversational and under 60 words.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    const wx = weatherData;
    return `Current conditions at ${wx.airport?.name}: ${wx.current?.condition}. ${
      wx.hazards?.description !== "none" 
        ? `⚠️ Hazards: ${wx.hazards.description}. ` 
        : "No weather hazards. "
    }${wx.alerts?.length > 0 ? `Alert: ${wx.alerts[0].event}` : ""}`;
  }
}

/**
 * Generate complete travel brief combining multiple data sources
 */
export async function generateTravelBrief(data: {
  riskBrief?: any;
  weather?: any;
  tsa?: any;
  news?: any;
}): Promise<string> {
  const sections: string[] = [];
  
  // Build context for LLM
  let context = "Generate a complete travel brief based on this data:\n\n";
  
  if (data.riskBrief) {
    context += `RISK ASSESSMENT:\n${JSON.stringify(data.riskBrief, null, 2)}\n\n`;
  }
  
  if (data.weather) {
    context += `WEATHER:\n${JSON.stringify(data.weather, null, 2)}\n\n`;
  }
  
  if (data.tsa) {
    context += `TSA WAIT TIMES:\n${JSON.stringify(data.tsa, null, 2)}\n\n`;
  }
  
  if (data.news) {
    context += `NEWS:\n${JSON.stringify(data.news, null, 2)}\n\n`;
  }
  
  const prompt = `${context}

Create a comprehensive but concise travel brief (150-200 words) that:
1. Opens with overall trip outlook (good/caution/concerning)
2. Highlights key risk factors in order of importance
3. Mentions weather conditions briefly
4. Notes TSA/security considerations
5. Provides 2-3 specific action items
6. Ends with a confidence statement

Use a friendly, professional tone. Format with clear paragraphs.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // Fallback: combine individual summaries
    if (data.riskBrief) {
      sections.push(generateFallbackSummary(data.riskBrief));
    }
    if (data.weather) {
      sections.push(`Weather: ${data.weather.current?.condition} at ${data.weather.airport?.name}.`);
    }
    if (data.tsa) {
      sections.push(`Security: ${data.tsa.recommendation}`);
    }
    
    return sections.join("\n\n");
  }
}
