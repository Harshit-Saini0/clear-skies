import type { RiskBrief, RiskBriefInput, RiskComponent } from "./types.js";
import { getFlightByIata, getAirportByIata } from "./providers/aviationstack.js";
import { getForecast } from "./providers/weatherapi.js";
import { getTsaWaitTimes } from "./providers/tsa.js";
import { searchNews } from "./providers/newsdata.js";

// Heuristic weights; sum to 1.0
const W_OPS = 0.4;
const W_WX_DEP = 0.15;
const W_WX_ARR = 0.15;
const W_TSA = 0.2;
const W_NEWS = 0.1;

// Map raw component scores (0..1) into a tier.
function tierFromScore(s: number): "green"|"yellow"|"red" {
  if (s < 0.33) return "green";
  if (s < 0.66) return "yellow";
  return "red";
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
    // Hazard features
    const maxWind = Math.max(...sample.map((h: any) => h.wind_kph ?? 0), 0);
    const maxGust = Math.max(...sample.map((h: any) => h.gust_kph ?? 0), 0);
    const minVis = Math.min(...sample.map((h: any) => h.vis_km ?? 10), 10);
    const thunder = sample.some((h: any) => String(h.condition?.text || "").toLowerCase().includes("thunder"));
    const snow = sample.some((h: any) => /(snow|freez|ice|sleet)/i.test(h.condition?.text || ""));

    // Heuristic risk
    let r = 0;
    r = Math.max(r, clamp01((maxWind - 30) / 40));    // 30-70 kph wind escalation
    r = Math.max(r, clamp01((maxGust - 45) / 40));    // gusts
    r = Math.max(r, clamp01((5 - minVis) / 5));       // vis < 5 km
    if (thunder) r = Math.max(r, 0.6);
    if (snow) r = Math.max(r, 0.55);

    const detail = `wx: wind=${maxWind}kph gust=${maxGust}kph vis=${minVis}km thunder=${thunder} snow=${snow}`;
    return { score: clamp01(r), detail };
  } catch {
    return { score: 0.1, detail: "wx: unknown (fallback)" };
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
      return { score: 0.3, detail: "tsa: no recent data (fallback)" };
    }

    const avg = recent.reduce((s: number, x: { t: number; w: number }) => s + x.w, 0) / recent.length;
    
    // Risk that screening consumes too much of the lead time
    // If lead time is very short (< 60 min), that's inherently risky
    if (leadMins < 60) {
      const r = Math.min(1.0, 0.5 + (60 - leadMins) / 120); // escalate as lead shrinks
      return { score: r, detail: `tsa: avg=${avg.toFixed(0)}min lead=${leadMins}min (short lead)` };
    }
    
    // Standard case: r_tsa = (avg - 20) / (lead - 20), clamped to [0, 1]
    const numerator = Math.max(0, avg - 20);
    const denom = Math.max(1, leadMins - 20); // avoid division by zero
    const r = clamp01(numerator / denom);
    const detail = `tsa: avg=${avg.toFixed(0)}min lead=${leadMins}min`;
    return { score: r, detail };
  } catch (err) {
    return { score: 0.2, detail: `tsa: error (${err instanceof Error ? err.message : 'unknown'})` };
  }
}

function scoreNews(hits: { title: string }[]): { score: number; detail: string } {
  // Simple keyword escalation: strikes, outage, ATC, weather alerts
  const joined = hits.map(h => h.title.toLowerCase()).join(" | ");
  let r = 0;
  if (/(strike|walkout|industrial action)/i.test(joined)) r = Math.max(r, 0.7);
  if (/(outage|system failure|it outage|meltdown)/i.test(joined)) r = Math.max(r, 0.6);
  if (/(atc|air traffic|controller)/i.test(joined)) r = Math.max(r, 0.5);
  if (/(storm|blizzard|hurricane|typhoon|heatwave)/i.test(joined)) r = Math.max(r, 0.5);
  const detail = `news: hits=${hits.length}`;
  return { score: r, detail };
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
  let opsScore = 0.2;
  let opsExplain = "ops: nominal";
  if (f0) {
    const status = String(f0.status || "").toLowerCase();
    const schedDep = f0?.departure?.scheduled;
    const estDep = f0?.departure?.estimated || f0?.departure?.actual;
    const schedArr = f0?.arrival?.scheduled;
    const estArr = f0?.arrival?.estimated || f0?.arrival?.actual;
    let deltaDep = 0, deltaArr = 0;
    if (schedDep && estDep) deltaDep = Math.abs((new Date(estDep).getTime() - new Date(schedDep).getTime()) / 60000);
    if (schedArr && estArr) deltaArr = Math.abs((new Date(estArr).getTime() - new Date(schedArr).getTime()) / 60000);

    const delayMins = Math.max(deltaDep, deltaArr);
    opsScore = clamp01(delayMins / 120); // 0..1 at 2h delay
    if (/cancel/.test(status)) opsScore = 1.0;
    else if (/divert/.test(status)) opsScore = Math.max(opsScore, 0.9);
    else if (/landed|active|scheduled/.test(status)) opsScore = Math.max(opsScore, 0.1);

    opsExplain = `ops: status=${status} delay≈${Math.round(delayMins)}m`;
  } else {
    opsExplain = "ops: unknown flight (fallback)";
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