/**
 * Summarizers for helper tools
 * These convert verbose API responses into concise, actionable summaries
 */

interface FlightSummary {
  flight: string;
  status: string;
  departure: {
    airport: string;
    scheduled: string;
    estimated?: string;
    actual?: string;
    delay_minutes?: number;
    gate?: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    scheduled: string;
    estimated?: string;
    actual?: string;
    delay_minutes?: number;
    gate?: string;
    terminal?: string;
  };
  aircraft?: {
    type: string;
    registration?: string;
  };
}

export function summarizeFlight(apiResponse: any): FlightSummary {
  const flight = apiResponse?.data?.[0];
  if (!flight) {
    throw new Error("No flight data found");
  }

  const calcDelay = (scheduled: string, estimatedOrActual?: string) => {
    if (!scheduled || !estimatedOrActual) return undefined;
    const diff = new Date(estimatedOrActual).getTime() - new Date(scheduled).getTime();
    return Math.round(diff / 60000); // minutes
  };

  return {
    flight: flight.flight?.iata || flight.flight?.number || "Unknown",
    status: flight.flight_status || "unknown",
    departure: {
      airport: flight.departure?.iata || flight.departure?.airport || "Unknown",
      scheduled: flight.departure?.scheduled || "",
      estimated: flight.departure?.estimated,
      actual: flight.departure?.actual,
      delay_minutes: calcDelay(flight.departure?.scheduled, flight.departure?.estimated || flight.departure?.actual),
      gate: flight.departure?.gate,
      terminal: flight.departure?.terminal
    },
    arrival: {
      airport: flight.arrival?.iata || flight.arrival?.airport || "Unknown",
      scheduled: flight.arrival?.scheduled || "",
      estimated: flight.arrival?.estimated,
      actual: flight.arrival?.actual,
      delay_minutes: calcDelay(flight.arrival?.scheduled, flight.arrival?.estimated || flight.arrival?.actual),
      gate: flight.arrival?.gate,
      terminal: flight.arrival?.terminal
    },
    aircraft: flight.aircraft ? {
      type: flight.aircraft?.iata_type || flight.aircraft?.icao_type || "Unknown",
      registration: flight.aircraft?.registration
    } : undefined
  };
}

interface WeatherSummary {
  airport: {
    iata: string;
    name: string;
    location: string;
  };
  current: {
    condition: string;
    temp_c: number;
    temp_f: number;
    wind_kph: number;
    wind_dir: string;
    visibility_km: number;
    precip_mm: number;
  };
  hazards: {
    high_winds: boolean;
    low_visibility: boolean;
    thunderstorms: boolean;
    snow_ice: boolean;
    description: string;
  };
  next_6h_summary: string;
  alerts: Array<{
    event: string;
    severity: string;
    headline: string;
    effective: string;
    expires: string;
  }>;
}

export function summarizeWeather(geo: any, apiResponse: any): WeatherSummary {
  const current = apiResponse?.current || {};
  const forecast = apiResponse?.forecast?.forecastday?.[0] || {};
  const hours = forecast?.hour || [];
  const alerts = apiResponse?.alerts?.alert || [];

  // Look at next 6 hours for hazards
  const now = Date.now();
  const next6h = hours.filter((h: any) => {
    const t = new Date(h.time).getTime();
    return t >= now && t <= now + 6 * 3600_000;
  }).slice(0, 6);

  const maxWind = Math.max(...next6h.map((h: any) => h.wind_kph ?? 0), current.wind_kph ?? 0);
  const maxGust = Math.max(...next6h.map((h: any) => h.gust_kph ?? 0), current.gust_kph ?? 0);
  const minVis = Math.min(...next6h.map((h: any) => h.vis_km ?? 10), current.vis_km ?? 10);
  const hasThunder = next6h.some((h: any) => /thunder|lightning/i.test(h.condition?.text || ""));
  const hasSnow = next6h.some((h: any) => /snow|ice|sleet|freez/i.test(h.condition?.text || ""));

  const hazards = [];
  if (maxWind > 40 || maxGust > 60) hazards.push("high winds");
  if (minVis < 5) hazards.push("low visibility");
  if (hasThunder) hazards.push("thunderstorms");
  if (hasSnow) hazards.push("snow/ice");

  const next6hSummary = next6h.length > 0
    ? `${next6h[0].condition?.text} → ${next6h[next6h.length - 1].condition?.text}`
    : current.condition?.text || "Unknown";

  return {
    airport: {
      iata: geo?.iata || "Unknown",
      name: geo?.name || "Unknown",
      location: `${geo?.city || ""}, ${geo?.country || ""}`.trim()
    },
    current: {
      condition: current.condition?.text || "Unknown",
      temp_c: current.temp_c ?? 0,
      temp_f: current.temp_f ?? 0,
      wind_kph: current.wind_kph ?? 0,
      wind_dir: current.wind_dir || "N",
      visibility_km: current.vis_km ?? 10,
      precip_mm: current.precip_mm ?? 0
    },
    hazards: {
      high_winds: maxWind > 40 || maxGust > 60,
      low_visibility: minVis < 5,
      thunderstorms: hasThunder,
      snow_ice: hasSnow,
      description: hazards.length > 0 ? hazards.join(", ") : "none"
    },
    next_6h_summary: next6hSummary,
    alerts: alerts.map((a: any) => ({
      event: a.event || "Unknown",
      severity: a.severity || "Unknown",
      headline: a.headline || "",
      effective: a.effective || "",
      expires: a.expires || ""
    }))
  };
}

interface TsaSummary {
  airport: string;
  data_source: "tsa_api" | "news_fallback" | "no_data";
  current_wait_estimate: string;
  recent_average_minutes: number;
  data_points: number;
  recommendation: string;
  news_backup?: {
    headlines_count: number;
    key_issues: string[];
    risk_level: string;
  };
}

export function summarizeTsa(iata: string, apiResponse: any): TsaSummary {
  const dataSource = apiResponse?.dataSource || "tsa_api";
  
  // Handle news-based fallback
  if (dataSource === "news_fallback" && apiResponse?.newsBackup) {
    const newsBackup = apiResponse.newsBackup;
    return {
      airport: iata,
      data_source: "news_fallback",
      current_wait_estimate: "Based on news analysis",
      recent_average_minutes: 0,
      data_points: 0,
      recommendation: "TSA API unavailable. Recommend arriving 2+ hours early and checking airport website for current wait times.",
      news_backup: {
        headlines_count: newsBackup.headlines?.length || 0,
        key_issues: newsBackup.keyIssues || [],
        risk_level: newsBackup.headlines?.length > 0 ? "Monitor news for updates" : "No recent security news"
      }
    };
  }
  
  // Handle no data
  if (dataSource === "no_data") {
    return {
      airport: iata,
      data_source: "no_data",
      current_wait_estimate: "No data available",
      recent_average_minutes: 0,
      data_points: 0,
      recommendation: "Arrive 2 hours before departure as standard practice"
    };
  }
  
  // Handle TSA API data
  const series = Array.isArray(apiResponse) ? apiResponse : (apiResponse?.WaitTimes || []);
  
  const recent = series
    .map((x: any) => {
      const dateStr = x.Created_Datetime || x.Created_Datetime2 || x.date || x.timestamp;
      const waitTime = Number(x.WaitTime || x.Wait || x.wait_time || 0);
      if (!dateStr) return null;
      const timestamp = new Date(dateStr).getTime();
      return Number.isFinite(timestamp) && Number.isFinite(waitTime) 
        ? { t: timestamp, w: waitTime } 
        : null;
    })
    .filter((x: { t: number; w: number } | null): x is { t: number; w: number } => x !== null && x.w >= 0)
    .sort((a: { t: number; w: number }, b: { t: number; w: number }) => b.t - a.t)
    .slice(0, 10);

  if (recent.length === 0) {
    return {
      airport: iata,
      data_source: "tsa_api",
      current_wait_estimate: "No data available",
      recent_average_minutes: 0,
      data_points: 0,
      recommendation: "Arrive 2 hours before departure as standard practice"
    };
  }

  const avg = recent.reduce((s: number, x: { t: number; w: number }) => s + x.w, 0) / recent.length;
  const latest = recent[0].w;

  let estimate = "Unknown";
  if (latest < 20) estimate = "Under 20 minutes";
  else if (latest < 40) estimate = "20-40 minutes";
  else if (latest < 60) estimate = "40-60 minutes";
  else estimate = "Over 1 hour";

  let recommendation = "";
  if (avg < 30) recommendation = "Standard arrival buffer is sufficient";
  else if (avg < 45) recommendation = "Consider arriving 30 minutes earlier than usual";
  else recommendation = "Arrive at least 45-60 minutes earlier; consider TSA PreCheck";

  return {
    airport: iata,
    data_source: "tsa_api",
    current_wait_estimate: estimate,
    recent_average_minutes: Math.round(avg),
    data_points: recent.length,
    recommendation
  };
}

interface NewsSummary {
  query: string;
  total_articles: number;
  relevant_headlines: Array<{
    title: string;
    source: string;
    published: string;
    link: string;
  }>;
  risk_keywords_found: string[];
  summary: string;
}

export function summarizeNews(query: string, hits: any[]): NewsSummary {
  const riskKeywords = [
    "strike", "walkout", "industrial action",
    "outage", "system failure", "meltdown",
    "atc", "air traffic", "controller",
    "storm", "blizzard", "hurricane", "typhoon",
    "delay", "cancellation", "disruption"
  ];

  const joined = hits.map(h => (h.title || "").toLowerCase()).join(" ");
  const foundKeywords = riskKeywords.filter(kw => joined.includes(kw));

  const topHeadlines = hits.slice(0, 5).map(h => ({
    title: h.title || "Untitled",
    source: h.source_id || "Unknown",
    published: h.pubDate || "",
    link: h.link || ""
  }));

  let summary = "";
  if (foundKeywords.length === 0) {
    summary = "No significant risk indicators found in recent news";
  } else {
    summary = `Risk indicators detected: ${foundKeywords.slice(0, 3).join(", ")}`;
  }

  return {
    query,
    total_articles: hits.length,
    relevant_headlines: topHeadlines,
    risk_keywords_found: foundKeywords,
    summary
  };
}
