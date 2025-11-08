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
  if (fromIso) params.set("from_date", fromIso.slice(0, 10)); // YYYY-MM-DD

  const url = `${BASE}?${params.toString()}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`newsdata failed: ${res.status}`);
  const json = await res.json();
  const hits: NewsHit[] = (json?.results || []).map((r: any) => ({
    title: r.title,
    link: r.link || r.url,
    pubDate: r.pubDate || r.pubDate_tz || r.date,
    source_id: r.source_id
  }));
  cache.set(ck, hits, { ttl: 10 * 60 * 1000 });
  return hits;
}