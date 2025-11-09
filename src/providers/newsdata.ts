import { cache } from "../cache.js";

const BASE = "https://newsdata.io/api/1/news";
const KEY = process.env.NEWSDATA_KEY!;

function cacheKey(url: string) { return `newsdata:${url}`; }

export interface NewsHit {
  title: string;
  link: string;
  pubDate: string;
  source_id?: string;
}

export async function searchNews(q: string, fromIso?: string) {
  const params = new URLSearchParams({
    apikey: KEY,
    q,
    language: "en"
  });
  
  // Only add from_date if it's provided and valid
  if (fromIso) {
    const dateStr = fromIso.slice(0, 10); // YYYY-MM-DD
    // Newsdata.io free plan may have date restrictions
    params.set("from_date", dateStr);
  }

  const url = `${BASE}?${params.toString()}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  try {
    console.log(`[Newsdata] Fetching news for query: ${q}`);
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`Newsdata API Error: ${res.status} - ${errorText}`);
      
      // If 422 (likely date parameter issue on free plan), retry without date
      if (res.status === 422 && fromIso) {
        console.warn('Newsdata API: Retrying without date parameter (free plan limitation)');
        const simpleParams = new URLSearchParams({
          apikey: KEY,
          q,
          language: "en"
        });
        const simpleUrl = `${BASE}?${simpleParams.toString()}`;
        const retryRes = await fetch(simpleUrl);
        
        if (!retryRes.ok) {
          throw new Error(`newsdata failed: ${retryRes.status}`);
        }
        
        const retryJson = await retryRes.json();
        const retryHits: NewsHit[] = (retryJson?.results || []).map((r: any) => ({
          title: r.title,
          link: r.link || r.url,
          pubDate: r.pubDate || r.pubDate_tz || r.date,
          source_id: r.source_id
        }));
        cache.set(ck, retryHits, { ttl: 10 * 60 * 1000 });
        return retryHits;
      }
      
      throw new Error(`newsdata failed: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Check for API-level errors
    if (json.status === "error") {
      console.error('Newsdata API Error:', json.message);
      throw new Error(`newsdata error: ${json.message}`);
    }
    
    const hits: NewsHit[] = (json?.results || []).map((r: any) => ({
      title: r.title,
      link: r.link || r.url,
      pubDate: r.pubDate || r.pubDate_tz || r.date,
      source_id: r.source_id
    }));
    
    console.log(`[Newsdata] Retrieved ${hits.length} news articles`);
    cache.set(ck, hits, { ttl: 10 * 60 * 1000 });
    return hits;
  } catch (error) {
    console.error('Newsdata API failed:', error);
    // Return empty array instead of throwing to allow other tools to work
    return [];
  }
}