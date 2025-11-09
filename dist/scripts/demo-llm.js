#!/usr/bin/env tsx
/**
 * Demo script showing LLM-powered summaries
 * Run with: npm run demo:llm
 */
import { getAirportByIata } from "../src/providers/aviationstack.js";
import { getForecast } from "../src/providers/weatherapi.js";
import { getTsaWaitTimes } from "../src/providers/tsa.js";
import { summarizeWeather } from "../src/summarizers.js";
import { summarizeWeatherWithLLM, generateTravelBrief } from "../src/llm-summary.js";
async function demo() {
    console.log("=== LLM Summary Demo ===\n");
    // Get weather data
    console.log("📍 Fetching weather for JFK...");
    const geo = await getAirportByIata("JFK");
    if (!geo?.lat || !geo?.lon) {
        console.error("Could not geocode JFK");
        return;
    }
    const wx = await getForecast(geo.lat, geo.lon);
    const weatherSummary = summarizeWeather(geo, wx);
    console.log("\n📊 Structured Weather Data (400 bytes):");
    console.log(JSON.stringify(weatherSummary, null, 2));
    // Get LLM summary
    console.log("\n🤖 LLM Natural Language Summary:");
    try {
        const llmSummary = await summarizeWeatherWithLLM(weatherSummary);
        console.log(llmSummary);
    }
    catch (error) {
        console.log("(Using fallback - Gemini API unavailable)");
        console.log(`Current conditions at ${weatherSummary.airport.name}: ${weatherSummary.current.condition}. ${weatherSummary.hazards.description !== "none"
            ? `⚠️ Hazards: ${weatherSummary.hazards.description}. `
            : "No weather hazards. "}`);
    }
    // Get TSA data
    console.log("\n🔐 Fetching TSA wait times...");
    const tsa = await getTsaWaitTimes("JFK");
    // Generate complete brief
    console.log("\n📋 Complete Travel Brief:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
        const fullBrief = await generateTravelBrief({
            weather: weatherSummary,
            tsa: tsa
        });
        console.log(fullBrief);
    }
    catch (error) {
        console.log("(Using structured fallback)");
        console.log("\n**Weather:** " + weatherSummary.current.condition);
        console.log("**Hazards:** " + weatherSummary.hazards.description);
        console.log("**Visibility:** " + weatherSummary.current.visibility_km + "km");
        console.log("\n**Recommendation:** " + (weatherSummary.hazards.description === "none"
            ? "Good conditions for flying ✅"
            : "Monitor weather updates ⚠️"));
    }
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ Benefits of LLM Summaries:");
    console.log("  • Structured data → Natural language");
    console.log("  • Context-aware insights");
    console.log("  • Actionable recommendations");
    console.log("  • User-friendly presentation");
    console.log("\n📊 Data Efficiency:");
    console.log("  • API Response: 10KB+ raw JSON");
    console.log("  • Our Summary: 400 bytes structured");
    console.log("  • LLM Input: 400 bytes (95% reduction!)");
    console.log("  • LLM Output: ~60 words, easy to understand");
}
demo().catch(console.error);
