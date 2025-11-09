import type { RiskBrief, RiskBriefInput, RiskComponent } from "./types.js";
import { getFlightByIata, getAirportByIata } from "./providers/aviationstack.js";
import { getForecast } from "./providers/weatherapi.js";
import { getTsaWaitTimes } from "./providers/tsa.js";
import { searchNews } from "./providers/newsdata.js";

// Heuristic weights; sum to 1.0
const W_OPS = 0.40;      // Operations (delays, cancellations) - most critical
const W_WX_DEP = 0.20;   // Departure weather - very important
const W_WX_ARR = 0.15;   // Arrival weather - important
const W_TSA = 0.15;      // TSA wait times - affects departure
const W_NEWS = 0.10;     // News/disruptions - context

// Map raw component scores (0..1) into a tier.
function tierFromScore(s: number): "green"|"yellow"|"red" {
  if (s < 0.30) return "green";   // < 30% risk is low
  if (s < 0.60) return "yellow";  // 30-60% is moderate
  return "red";                    // >= 60% is high risk
}

// Normalize into 0..1 with clamp
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

function scoreWeatherFromForecast(forecast: any, windowHours = 6): { score: number; detail: string } {
  try {
    // Look at immediate window from current or next hours
    const hours = forecast?.forecast?.forecastday?.flatMap((d: any) => d.hour) || [];
    const now = Date.now();
    const soon = hours.filter((h: any) => {
      const t = new Date(h.time).getTime();
      return t >= now && t <= now + windowHours * 3600_000;
    });
    const sample = soon.length ? soon : hours.slice(0, 6);
    
    if (sample.length === 0) {
      return { score: 0.20, detail: "wx: no forecast data available" };
    }
    
    // Hazard features with better extraction
    const maxWind = Math.max(...sample.map((h: any) => h.wind_kph ?? 0), 0);
    const maxGust = Math.max(...sample.map((h: any) => h.gust_kph ?? 0), 0);
    const minVis = Math.min(...sample.map((h: any) => h.vis_km ?? 10), 10);
    const maxPrecip = Math.max(...sample.map((h: any) => h.precip_mm ?? 0), 0);
    const conditions = sample.map((h: any) => String(h.condition?.text || "").toLowerCase()).join(" ");
    
    const thunder = /thunder|lightning|storm/i.test(conditions);
    const snow = /snow|freez|ice|sleet|blizzard/i.test(conditions);
    const rain = /rain|drizzle|shower/i.test(conditions);
    const fog = /fog|mist/i.test(conditions);

    // More granular risk calculation
    let r = 0;
    
    // Wind risk (0-1 scale)
    if (maxWind < 20) r = Math.max(r, 0.05);      // Light wind
    else if (maxWind < 35) r = Math.max(r, 0.15); // Moderate wind
    else if (maxWind < 50) r = Math.max(r, 0.40); // Strong wind
    else if (maxWind < 70) r = Math.max(r, 0.70); // Very strong wind
    else r = Math.max(r, 0.90);                    // Dangerous wind
    
    // Gust risk
    if (maxGust > 45) r = Math.max(r, 0.50);
    if (maxGust > 65) r = Math.max(r, 0.75);
    
    // Visibility risk
    if (minVis < 10) r = Math.max(r, 0.10);       // Reduced vis
    if (minVis < 5) r = Math.max(r, 0.35);        // Low vis
    if (minVis < 2) r = Math.max(r, 0.60);        // Very low vis
    if (minVis < 1) r = Math.max(r, 0.85);        // Minimal vis
    
    // Precipitation risk
    if (maxPrecip > 1) r = Math.max(r, 0.15);     // Light precip
    if (maxPrecip > 5) r = Math.max(r, 0.35);     // Moderate precip
    if (maxPrecip > 10) r = Math.max(r, 0.55);    // Heavy precip
    
    // Condition-based risks
    if (thunder) r = Math.max(r, 0.70);            // Thunderstorms are high risk
    if (snow) r = Math.max(r, 0.60);               // Snow is high risk
    if (fog && minVis < 3) r = Math.max(r, 0.50); // Fog with low vis
    if (rain && maxPrecip > 5) r = Math.max(r, 0.40); // Heavy rain

    const detail = `wx: wind=${Math.round(maxWind)}kph gust=${Math.round(maxGust)}kph vis=${minVis.toFixed(1)}km precip=${maxPrecip.toFixed(1)}mm${thunder ? ' THUNDER' : ''}${snow ? ' SNOW' : ''}${fog ? ' FOG' : ''}`;
    return { score: clamp01(r), detail };
  } catch (err) {
    console.error('Weather scoring error:', err);
    return { score: 0.20, detail: "wx: error parsing forecast data" };
  }
}

function scoreTsa(waitJson: any, leadMins: number): { score: number; detail: string } {
  // MyTSA legacy returns list of points with "Created_Datetime" and "WaitTime"
  try {
    const series = Array.isArray(waitJson) ? waitJson : (waitJson?.WaitTimes || []);
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
      .slice(0, 6); // last 6 reports

    if (recent.length === 0) {
      return { score: 0.15, detail: "tsa: no recent data" };
    }

    const avg = recent.reduce((s: number, x: { t: number; w: number }) => s + x.w, 0) / recent.length;
    const max = Math.max(...recent.map((x: { t: number; w: number }) => x.w));
    
    // More sophisticated TSA risk scoring
    let r = 0;
    
    // Very short lead time is inherently risky
    if (leadMins < 45) {
      r = 0.90; // Critical - very short lead time
    } else if (leadMins < 60) {
      r = 0.70; // High risk - short lead time
    } else if (leadMins < 90) {
      r = 0.40; // Moderate risk
    } else if (leadMins >= 180) {
      r = 0.05; // Plenty of time
    } else {
      // Standard 90-180 min range: score based on wait times
      if (avg < 10) r = 0.05;
      else if (avg < 20) r = 0.15;
      else if (avg < 30) r = 0.30;
      else if (avg < 45) r = 0.50;
      else r = 0.70; // Very long waits
      
      // Adjust for max wait time
      if (max > 60) r = Math.max(r, 0.60);
      if (max > 90) r = Math.max(r, 0.75);
    }
    
    // If lead time is adequate but wait times are extreme, still flag it
    if (leadMins >= 120 && avg > 45) {
      r = Math.max(r, 0.40);
    }
    
    const detail = `tsa: avg=${Math.round(avg)}min max=${Math.round(max)}min lead=${leadMins}min`;
    return { score: clamp01(r), detail };
  } catch (err) {
    console.error('TSA scoring error:', err);
    return { score: 0.15, detail: `tsa: error parsing data` };
  }
}

function scoreNews(hits: { title: string }[]): { score: number; detail: string } {
  // Analyze news for travel disruption keywords
  if (hits.length === 0) {
    return { score: 0.05, detail: "news: no relevant alerts" };
  }
  
  const joined = hits.map(h => h.title.toLowerCase()).join(" | ");
  let r = 0;
  let keywords: string[] = [];
  
  // Critical disruptions (highest priority)
  if (/(strike|walkout|industrial action|labor dispute)/i.test(joined)) {
    r = Math.max(r, 0.75);
    keywords.push('STRIKE');
  }
  if (/(outage|system failure|it outage|meltdown|cyberattack)/i.test(joined)) {
    r = Math.max(r, 0.70);
    keywords.push('OUTAGE');
  }
  if (/(ground stop|ground delay program|gdp|edct)/i.test(joined)) {
    r = Math.max(r, 0.65);
    keywords.push('GROUND-STOP');
  }
  
  // High-impact events
  if (/(atc|air traffic|controller shortage)/i.test(joined)) {
    r = Math.max(r, 0.55);
    keywords.push('ATC');
  }
  if (/(hurricane|typhoon|blizzard|severe storm)/i.test(joined)) {
    r = Math.max(r, 0.55);
    keywords.push('SEVERE-WEATHER');
  }
  if (/(cancel|cancellation|mass cancellation)/i.test(joined)) {
    r = Math.max(r, 0.60);
    keywords.push('CANCELLATIONS');
  }
  
  // Moderate-impact events
  if (/(delay|delayed flights|widespread delays)/i.test(joined)) {
    r = Math.max(r, 0.35);
    keywords.push('delays');
  }
  if (/(storm|weather advisory|fog)/i.test(joined)) {
    r = Math.max(r, 0.30);
    keywords.push('weather');
  }
  if (/(airport closure|runway closure)/i.test(joined)) {
    r = Math.max(r, 0.65);
    keywords.push('CLOSURE');
  }
  
  // Minor issues
  if (/(maintenance|crew shortage|staffing)/i.test(joined)) {
    r = Math.max(r, 0.25);
    keywords.push('ops-issues');
  }
  
  const keywordStr = keywords.length > 0 ? ` [${keywords.join(', ')}]` : '';
  const detail = `news: ${hits.length} article${hits.length !== 1 ? 's' : ''}${keywordStr}`;
  return { score: clamp01(r), detail };
}

export async function buildRiskBrief(input: RiskBriefInput): Promise<RiskBrief> {
  const {
    flightIata,
    date,
    depIata,
    arrIata,
    paxType = "domestic",
    targetArrivalLeadMins
  } = input;

  const leadMins = targetArrivalLeadMins ?? (paxType === "international" ? 180 : 120);

  // OPS
  const flights = await getFlightByIata({ flightIata, date });
  const f0 = flights?.data?.[0];
  const dep = depIata || f0?.departure?.iata;
  const arr = arrIata || f0?.arrival?.iata;

  // Simple ops score: delay flags if scheduled vs estimated differ, status not "scheduled" or "active"
  let opsScore = 0.05; // Start with very low baseline for nominal flights
  let opsExplain = "ops: nominal";
  if (f0) {
    const status = String(f0.status || "").toLowerCase();
    const schedDep = f0?.departure?.scheduled;
    const estDep = f0?.departure?.estimated || f0?.departure?.actual;
    const schedArr = f0?.arrival?.scheduled;
    const estArr = f0?.arrival?.estimated || f0?.arrival?.actual;
    let deltaDep = 0, deltaArr = 0;
    if (schedDep && estDep) {
      deltaDep = Math.abs((new Date(estDep).getTime() - new Date(schedDep).getTime()) / 60000);
    }
    if (schedArr && estArr) {
      deltaArr = Math.abs((new Date(estArr).getTime() - new Date(schedArr).getTime()) / 60000);
    }

    const delayMins = Math.max(deltaDep, deltaArr);
    
    // More nuanced delay scoring
    if (delayMins <= 15) {
      opsScore = 0.05; // Minimal delay, very low risk
    } else if (delayMins <= 30) {
      opsScore = 0.15; // Minor delay
    } else if (delayMins <= 60) {
      opsScore = 0.35; // Moderate delay
    } else if (delayMins <= 120) {
      opsScore = 0.60; // Significant delay
    } else {
      opsScore = 0.85; // Major delay (>2 hours)
    }
    
    // Status overrides
    if (/cancel/i.test(status)) {
      opsScore = 1.0;
      opsExplain = `ops: CANCELLED`;
    } else if (/divert/i.test(status)) {
      opsScore = 0.95;
      opsExplain = `ops: DIVERTED`;
    } else if (/landed/i.test(status)) {
      opsScore = 0.05; // Already landed, minimal risk
      opsExplain = `ops: landed (delay≈${Math.round(delayMins)}m)`;
    } else if (/active/i.test(status)) {
      opsScore = Math.max(opsScore, 0.10); // In flight, slight uncertainty
      opsExplain = `ops: active (delay≈${Math.round(delayMins)}m)`;
    } else if (/scheduled/i.test(status)) {
      // Use delay-based score
      opsExplain = `ops: scheduled (delay≈${Math.round(delayMins)}m)`;
    } else {
      opsExplain = `ops: ${status} (delay≈${Math.round(delayMins)}m)`;
    }
  } else {
    opsScore = 0.25; // Unknown flight carries some risk
    opsExplain = "ops: flight not found (check flight number)";
  }

  // GEO lookup for dep/arr
  const depGeo = dep ? await getAirportByIata(dep) : null;
  const arrGeo = arr ? await getAirportByIata(arr) : null;

  // WX
  let wxDepScore = 0.1, wxDepExplain = "wx dep: n/a";
  let wxArrScore = 0.1, wxArrExplain = "wx arr: n/a";
  if (depGeo?.lat && depGeo?.lon) {
    const wx = await getForecast(depGeo.lat, depGeo.lon);
    const s = scoreWeatherFromForecast(wx);
    wxDepScore = s.score; wxDepExplain = s.detail.replace(/^wx/, "wx dep");
  }
  if (arrGeo?.lat && arrGeo?.lon) {
    const wx = await getForecast(arrGeo.lat, arrGeo.lon);
    const s = scoreWeatherFromForecast(wx);
    wxArrScore = s.score; wxArrExplain = s.detail.replace(/^wx/, "wx arr");
  }

  // TSA
  let tsaScore = 0.2, tsaExplain = "tsa: n/a";
  if (dep) {
    const tsa = await getTsaWaitTimes(dep);
    const s = scoreTsa(tsa, leadMins);
    tsaScore = s.score; tsaExplain = s.detail;
  }

  // NEWS
  const airline = f0?.airline?.name || f0?.airline?.iata || "";
  const newsHits = await searchNews(`${airline} ${dep ?? ""} ${arr ?? ""} strike OR outage OR ATC OR weather`, new Date(Date.now() - 72*3600_000).toISOString());
  const { score: newsScore, detail: newsExplain } = scoreNews(newsHits);

  // Aggregate
  // r = w_ops*r_ops + w_dep*r_wx_dep + w_arr*r_wx_arr + w_tsa*r_tsa + w_news*r_news
  const components: RiskComponent[] = [
    { key: "ops", score: opsScore, explanation: opsExplain, weight: W_OPS },
    { key: "weather_dep", score: wxDepScore, explanation: wxDepExplain, weight: W_WX_DEP },
    { key: "weather_arr", score: wxArrScore, explanation: wxArrExplain, weight: W_WX_ARR },
    { key: "tsa", score: tsaScore, explanation: tsaExplain, weight: W_TSA },
    { key: "news", score: newsScore, explanation: newsExplain, weight: W_NEWS }
  ];

  const riskScore = components.reduce((s, c) => s + c.score * c.weight, 0);
  const tier = tierFromScore(riskScore);

  const topSignals = components
    .slice()
    .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
    .slice(0, 3)
    .map(c => `${c.key}: ${c.explanation} (×${c.weight})`);

  const recommendations: string[] = [];
  if (tier === "red") {
    recommendations.push("Hold backup flight or request protected rebooking window.");
    recommendations.push("Pre-book hotel with free cancellation near arrival.");
    recommendations.push("Arrive earlier for TSA or use PreCheck/Clear if available.");
  } else if (tier === "yellow") {
    recommendations.push("Monitor for gate/EDCT updates; enable push alerts.");
    recommendations.push("Consider earlier airport arrival buffer (+30–45m).");
  } else {
    recommendations.push("Proceed as planned; set alerts for status changes.");
  }

  const dataTimestamps = {
    aviationstack: new Date().toISOString(),
    weatherapi: new Date().toISOString(),
    myTSA: new Date().toISOString(),
    newsdata: new Date().toISOString()
  };

  return {
    flightIata,
    date,
    depIata: dep,
    arrIata: arr,
    riskScore,
    tier,
    components,
    topSignals,
    recommendedActions: recommendations,
    dataTimestamps
  };
}