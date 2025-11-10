import { cache } from "../cache.js";
import { searchNews } from "./newsdata.js";
import { getAirportByIata } from "./aviationstack.js";

// MyTSA legacy endpoint — crowdsourced wait times
// Example: https://apps.tsa.dhs.gov/MyTSAWebService/GetWaitTimes.ashx?ap=SFO&output=json
const BASE = "https://apps.tsa.dhs.gov/MyTSAWebService";

function cacheKey(url: string) { return `tsa:${url}`; }

export interface TsaDataWithNews {
  WaitTimes: any[];
  newsBackup?: {
    headlines: Array<{ title: string; link: string; pubDate: string }>;
    airportName?: string;
    interpretedRisk?: number; // 0-1 scale
    keyIssues?: string[];
  };
  dataSource: "tsa_api" | "news_fallback" | "no_data";
}

/**
 * Get TSA wait times, with news API fallback when TSA is unavailable
 */
export async function getTsaWaitTimes(iata: string): Promise<TsaDataWithNews> {
  const url = `${BASE}/GetWaitTimes.ashx?ap=${encodeURIComponent(iata.toUpperCase())}&output=json`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  try {
    console.log(`[TSA] Fetching wait times for ${iata}`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.error(`[TSA] API Error: ${res.status} - falling back to news data`);
      return await getTsaNewsBackup(iata);
    }
    
    const json = await res.json().catch(() => ({ WaitTimes: [] }));
    
    if (!json.WaitTimes || json.WaitTimes.length === 0) {
      console.warn(`[TSA] No wait time data for ${iata} - falling back to news data`);
      return await getTsaNewsBackup(iata);
    }
    
    console.log(`[TSA] Successfully retrieved wait times for ${iata}`);
    
    const result: TsaDataWithNews = {
      WaitTimes: json.WaitTimes,
      dataSource: "tsa_api"
    };
    
    cache.set(ck, result, { ttl: 60 * 60 * 1000 }); // 1 hour cache
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[TSA] Request timeout for ${iata} - falling back to news data`);
    } else {
      console.error(`[TSA] API failed for ${iata}:`, error);
    }
    return await getTsaNewsBackup(iata);
  }
}

/**
 * Fallback: Use news API to search for airport security/disruption news
 */
async function getTsaNewsBackup(iata: string): Promise<TsaDataWithNews> {
  try {
    console.log(`[TSA Fallback] Searching news for ${iata} airport security/disruptions`);
    
    // Get airport name for better search results
    const airportData = await getAirportByIata(iata);
    const airportName = airportData?.name || iata;
    
    // Search for security-related news at this airport
    const queries = [
      `${iata} airport security line`,
      `${airportName} TSA`,
      `${iata} checkpoint`,
      `${airportName} security wait`
    ];
    
    // Try multiple search queries and combine results
    const allHeadlines: Array<{ title: string; link: string; pubDate: string }> = [];
    for (const query of queries) {
      const newsResults = await searchNews(query);
      if (newsResults && newsResults.length > 0) {
        allHeadlines.push(...newsResults.slice(0, 3)); // Take top 3 from each query
      }
    }
    
    // Deduplicate by title
    const uniqueHeadlines = Array.from(
      new Map(allHeadlines.map(h => [h.title, h])).values()
    );
    
    console.log(`[TSA Fallback] Found ${uniqueHeadlines.length} relevant news articles`);
    
    const result: TsaDataWithNews = {
      WaitTimes: [],
      newsBackup: {
        headlines: uniqueHeadlines,
        airportName,
        keyIssues: [] // Will be populated by LLM interpretation
      },
      dataSource: uniqueHeadlines.length > 0 ? "news_fallback" : "no_data"
    };
    
    // Cache for 30 minutes (shorter than TSA data since news changes faster)
    const ck = cacheKey(`news-backup:${iata}`);
    cache.set(ck, result, { ttl: 30 * 60 * 1000 });
    
    return result;
  } catch (error) {
    console.error(`[TSA Fallback] Failed to get news backup for ${iata}:`, error);
    return {
      WaitTimes: [],
      dataSource: "no_data"
    };
  }
}