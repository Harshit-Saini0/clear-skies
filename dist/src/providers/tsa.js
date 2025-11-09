import { cache } from "../cache.js";
// MyTSA legacy endpoint — crowdsourced wait times
// Example: https://apps.tsa.dhs.gov/MyTSAWebService/GetWaitTimes.ashx?ap=SFO&output=json
const BASE = "https://apps.tsa.dhs.gov/MyTSAWebService";
function cacheKey(url) { return `tsa:${url}`; }
export async function getTsaWaitTimes(iata) {
    const url = `${BASE}/GetWaitTimes.ashx?ap=${encodeURIComponent(iata.toUpperCase())}&output=json`;
    const ck = cacheKey(url);
    const cached = cache.get(ck);
    if (cached)
        return cached;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`tsa failed: ${res.status}`);
    const json = await res.json().catch(() => null);
    cache.set(ck, json, { ttl: 5 * 60 * 1000 });
    return json;
}
