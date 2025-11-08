import { cache } from "../cache.js";
import type { AirportGeo, FlightQuery } from "../types.js";

const BASE = "http://api.aviationstack.com/v1";
const KEY = process.env.AVIATIONSTACK_KEY!;

function cacheKey(url: string) { return `aviationstack:${url}`; }

export async function getFlightByIata(query: FlightQuery) {
  const url = `${BASE}/flights?access_key=${KEY}&flight_iata=${encodeURIComponent(query.flightIata)}&flight_date=${query.date}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`aviationstack failed: ${res.status}`);
  const json = await res.json();
  cache.set(ck, json, { ttl: 30_000 }); // short TTL
  return json;
}

export async function getAirportByIata(iata: string): Promise<AirportGeo | null> {
  const url = `${BASE}/airports?access_key=${KEY}&iata_code=${encodeURIComponent(iata)}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`aviationstack airports failed: ${res.status}`);
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data[0] : null;
  const result: AirportGeo | null = data ? {
    iata: data.iata_code,
    name: data.airport_name,
    city: data.city_iata_code || data.city,
    country: data.country_name,
    lat: data.latitude,
    lon: data.longitude
  } : null;
  cache.set(ck, result, { ttl: 60 * 60 * 1000 });
  return result;
}