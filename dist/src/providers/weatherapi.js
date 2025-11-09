import { cache } from "../cache.js";
const BASE = "https://api.weatherapi.com/v1";
const KEY = process.env.WEATHERAPI_KEY;
function cacheKey(url) { return `weatherapi:${url}`; }
export async function getForecast(lat, lon) {
    const q = `${lat},${lon}`;
    const url = `${BASE}/forecast.json?key=${KEY}&q=${encodeURIComponent(q)}&days=2&aqi=no&alerts=yes`;
    const ck = cacheKey(url);
    const cached = cache.get(ck);
    if (cached)
        return cached;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`weatherapi failed: ${res.status}`);
    const json = await res.json();
    cache.set(ck, json, { ttl: 10 * 60 * 1000 }); // 10 min
    return json;
}
