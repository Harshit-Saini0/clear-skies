/**
 * LLM-powered news interpretation for airport security and disruptions
 * Uses Gemini to analyze news headlines and extract actionable security intelligence
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TsaDataWithNews } from "./providers/tsa.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export interface SecurityNewsAnalysis {
  riskScore: number; // 0-1 scale
  keyIssues: string[]; // List of identified security/disruption issues
  waitTimeEstimate: "unknown" | "low" | "moderate" | "high" | "severe";
  recommendation: string; // Actionable advice
  confidence: "low" | "medium" | "high";
  summary: string; // Brief human-readable summary
}

/**
 * Analyze airport security/disruption news headlines using LLM
 */
export async function interpretSecurityNews(
  tsaData: TsaDataWithNews,
  airportIata: string
): Promise<SecurityNewsAnalysis> {
  // If we have real TSA data, no need for LLM interpretation
  if (tsaData.dataSource === "tsa_api" || !tsaData.newsBackup?.headlines || tsaData.newsBackup.headlines.length === 0) {
    return {
      riskScore: 0.15,
      keyIssues: [],
      waitTimeEstimate: "unknown",
      recommendation: "No recent security news. Normal precautions advised.",
      confidence: "low",
      summary: "No specific security concerns detected in recent news."
    };
  }

  const headlines = tsaData.newsBackup.headlines;
  const airportName = tsaData.newsBackup.airportName || airportIata;

  // Build prompt for Gemini
  const prompt = `You are an expert travel security analyst. Analyze these news headlines about ${airportName} (${airportIata}) airport security and disruptions.

NEWS HEADLINES:
${headlines.map((h, i) => `${i + 1}. "${h.title}" (${h.pubDate})`).join('\n')}

Analyze these headlines and provide a JSON response with the following structure:
{
  "riskScore": <number between 0 and 1, where 0=no risk, 1=severe risk>,
  "keyIssues": [<array of specific security or disruption issues found>],
  "waitTimeEstimate": <one of: "unknown", "low", "moderate", "high", "severe">,
  "recommendation": <specific actionable advice for travelers>,
  "confidence": <one of: "low", "medium", "high" based on headline relevance>,
  "summary": <2-3 sentence summary of security situation>
}

SCORING GUIDELINES:
- 0.0-0.2: No security concerns, normal operations
- 0.2-0.4: Minor delays or routine security measures
- 0.4-0.6: Moderate concerns (longer lines, staffing issues, minor incidents)
- 0.6-0.8: Significant disruptions (system outages, major delays, protests)
- 0.8-1.0: Severe issues (closures, evacuations, major security incidents)

CONFIDENCE GUIDELINES:
- "low": Headlines are generic or not specifically about this airport
- "medium": Headlines mention the airport but lack specific security details
- "high": Headlines provide specific, recent information about security/disruptions

Focus on:
1. Security checkpoint wait times and staffing
2. System outages or technical issues
3. Security incidents or evacuations
4. Protests or labor actions affecting security
5. Terminal closures or restricted access

Ignore general travel advice or unrelated news.`;

  try {
    console.log(`[LLM News Interpreter] Analyzing ${headlines.length} headlines for ${airportIata}`);
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3, // Lower temperature for more consistent analysis
      }
    });

    const response = result.response.text();
    const analysis = JSON.parse(response) as SecurityNewsAnalysis;
    
    console.log(`[LLM News Interpreter] Analysis complete - Risk: ${analysis.riskScore.toFixed(2)}, Confidence: ${analysis.confidence}`);
    
    // Validate and clamp risk score
    analysis.riskScore = Math.max(0, Math.min(1, analysis.riskScore || 0.15));
    
    return analysis;
  } catch (error) {
    console.error('[LLM News Interpreter] Failed to analyze news:', error);
    
    // Fallback: Simple keyword-based analysis
    return fallbackNewsAnalysis(headlines, airportIata);
  }
}

/**
 * Fallback analysis if LLM fails - uses simple keyword matching
 */
function fallbackNewsAnalysis(
  headlines: Array<{ title: string; pubDate: string }>,
  airportIata: string
): SecurityNewsAnalysis {
  const combinedText = headlines.map(h => h.title.toLowerCase()).join(' ');
  
  let riskScore = 0.15;
  const keyIssues: string[] = [];
  let waitTimeEstimate: SecurityNewsAnalysis['waitTimeEstimate'] = "unknown";
  
  // Critical keywords (high risk)
  if (/(closure|closed|evacuate|evacuation|shutdown)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.85);
    keyIssues.push("Possible airport closure or evacuation");
    waitTimeEstimate = "severe";
  }
  
  if (/(bomb|threat|suspicious package|security breach)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.8);
    keyIssues.push("Security incident reported");
    waitTimeEstimate = "severe";
  }
  
  // High concern keywords
  if (/(strike|walkout|protest|labor action)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.7);
    keyIssues.push("Labor action or protest affecting operations");
    waitTimeEstimate = "high";
  }
  
  if (/(outage|system down|technical issue|computer problem)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.65);
    keyIssues.push("System outage or technical problems");
    waitTimeEstimate = "high";
  }
  
  // Moderate concern keywords
  if (/(long line|wait time|delay|slow|crowded)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.5);
    keyIssues.push("Extended wait times reported");
    waitTimeEstimate = "moderate";
  }
  
  if (/(staff shortage|understaffed|short staff)/i.test(combinedText)) {
    riskScore = Math.max(riskScore, 0.45);
    keyIssues.push("Staffing issues");
    waitTimeEstimate = "moderate";
  }
  
  // Build recommendation
  let recommendation = "Monitor airport status before departure.";
  if (riskScore > 0.7) {
    recommendation = "Arrive 2+ hours early. Consider backup travel plans. Check airport status frequently.";
  } else if (riskScore > 0.4) {
    recommendation = "Arrive 60-90 minutes earlier than usual. Check real-time airport updates.";
  }
  
  const summary = keyIssues.length > 0
    ? `Recent news indicates: ${keyIssues.join(', ')}. Extra time recommended.`
    : `Limited recent security news for ${airportIata}. Normal precautions advised.`;
  
  return {
    riskScore,
    keyIssues,
    waitTimeEstimate,
    recommendation,
    confidence: keyIssues.length > 0 ? "medium" : "low",
    summary
  };
}

/**
 * Convert wait time estimate to approximate minutes for risk calculation
 */
export function estimateWaitMinutes(estimate: SecurityNewsAnalysis['waitTimeEstimate']): number {
  const mapping = {
    unknown: 20,
    low: 15,
    moderate: 35,
    high: 60,
    severe: 90
  };
  return mapping[estimate] || 20;
}
