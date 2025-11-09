import { cache } from "../cache.js";
import type { AirportGeo, FlightQuery } from "../types.js";

const BASE = "http://api.aviationstack.com/v1";
const KEY = process.env.AVIATIONSTACK_KEY!;
const USE_MOCK = process.env.USE_MOCK_FLIGHT_DATA === "true";

function cacheKey(url: string) { return `aviationstack:${url}`; }

// Mock flight data for testing when API is unavailable
function getMockFlightData(query: FlightQuery) {
  return {
    data: [{
      flight_date: query.date,
      flight_status: "scheduled",
      departure: {
        airport: "JFK",
        timezone: "America/New_York",
        iata: "JFK",
        scheduled: `${query.date}T10:00:00+00:00`,
      },
      arrival: {
        airport: "LAX",
        timezone: "America/Los_Angeles",
        iata: "LAX",
        scheduled: `${query.date}T13:00:00+00:00`,
      },
      airline: { name: "Sample Airline", iata: query.flightIata.substring(0, 2) },
      flight: { iata: query.flightIata }
    }]
  };
}

export async function getFlightByIata(query: FlightQuery) {
  // Aviationstack FREE plan supports /flights endpoint!
  // Note: Free plan has limitations - 100 requests/month, HTTP only (no HTTPS)
  // Using flight_iata without flight_date for better compatibility
  const url = `${BASE}/flights?access_key=${KEY}&flight_iata=${encodeURIComponent(query.flightIata)}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  try {
    console.log(`[Aviationstack] Fetching flight data for ${query.flightIata}`);
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`Aviationstack API Error: ${res.status} - ${errorText}`);
      
      // If 403 or other error, fall back to mock data
      if (res.status === 403) {
        console.warn('Aviationstack API quota exceeded or restriction - using mock data');
        return getMockFlightData(query);
      }
      
      throw new Error(`aviationstack failed: ${res.status}`);
    }
    
    const json = await res.json();
    
    // Check for API-level errors
    if (json.error) {
      console.error('Aviationstack API Error:', json.error);
      console.warn('Using mock data due to API error');
      return getMockFlightData(query);
    }
    
    console.log(`[Aviationstack] Successfully retrieved flight data for ${query.flightIata}`);
    cache.set(ck, json, { ttl: 30_000 }); // 30 second cache
    return json;
    
  } catch (error) {
    console.error('Aviationstack API failed, using mock data:', error);
    return getMockFlightData(query);
  }
}

export async function getAirportByIata(iata: string): Promise<AirportGeo | null> {
  const url = `${BASE}/airports?access_key=${KEY}&iata_code=${encodeURIComponent(iata)}`;
  const ck = cacheKey(url);
  const cached = cache.get(ck);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    console.error(`Aviationstack Airports API Error: ${res.status} - ${errorText}`);
    throw new Error(`aviationstack airports failed: ${res.status} - Check API key, quota, or plan restrictions`);
  }
  const json = await res.json();
  
  // Check for API-level errors
  if (json.error) {
    console.error('Aviationstack Airports API Error:', json.error);
    throw new Error(`aviationstack error: ${json.error.message || JSON.stringify(json.error)}`);
  }
  
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