export type IsoDate = string; // YYYY-MM-DD
export type IataCode = string; // e.g., "JFK"

export interface FlightQuery {
  flightIata: string;      // e.g., "AA123"
  date: IsoDate;           // local date of departure
}

export interface AirportGeo {
  iata: IataCode;
  name?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
}

export interface RiskBriefInput {
  flightIata: string;
  date: IsoDate;               // departure local date
  depIata?: IataCode;
  arrIata?: IataCode;
  paxType?: "domestic"|"international";
  targetArrivalLeadMins?: number; // e.g., 120 for domestic, 180 for intl
}

export interface RiskComponent {
  key: string;            // "ops" | "weather_dep" | "weather_arr" | "tsa" | "news"
  score: number;          // 0..1
  explanation: string;
  weight: number;         // 0..1
}

export interface RiskBrief {
  flightIata: string;
  date: IsoDate;
  depIata?: string;
  arrIata?: string;
  riskScore: number;          // 0..1
  tier: "green"|"yellow"|"red";
  components: RiskComponent[];
  topSignals: string[];       // human-readable bullets
  recommendedActions: string[];
  dataTimestamps: Record<string, string>; // provider -> ISO timestamp
}