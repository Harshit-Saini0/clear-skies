import { cache } from "../cache.js";
const BASE = "https://newsdata.io/api/1/news";
const KEY = process.env.NEWSDATA_KEY;
function cacheKey(url) { return `newsdata:${url}`; }
export async function searchNews(q, fromIso) {
    // Free tier doesn't support from_date parameter, so we ignore it
    const params = new URLSearchParams({
        apikey: KEY,
        q,
        language: "en"
    });
    const url = `${BASE}?${params.toString()}`;
    const ck = cacheKey(url);
    const cached = cache.get(ck);
    if (cached)
        return cached;
    try {
        console.log(`[Newsdata] Fetching news for query: ${q}`);
        const res = await fetch(url);
        if (!res.ok) {
            const errorText = await res.text().catch(() => 'Unknown error');
            console.error(`Newsdata API Error: ${res.status} - ${errorText}`);
            // Return empty array instead of throwing to allow other tools to work
            return [];
        }
        const json = await res.json();
        // Check for API-level errors
        if (json.status === "error") {
            console.error('Newsdata API Error:', json.results?.message || json.message);
            // Return empty array instead of throwing
            return [];
        }
        const hits = (json?.results || []).map((r) => ({
            title: r.title,
            link: r.link || r.url,
            pubDate: r.pubDate || r.pubDate_tz || r.date,
            source_id: r.source_id
        }));
        console.log(`[Newsdata] Retrieved ${hits.length} news articles`);
        cache.set(ck, hits, { ttl: 10 * 60 * 1000 });
        return hits;
    }
    catch (error) {
        console.error('Newsdata API failed:', error);
        // Return empty array instead of throwing to allow other tools to work
        return [];
    }
}
