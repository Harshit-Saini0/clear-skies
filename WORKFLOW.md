# Complete Workflow Example

This document shows a complete end-to-end workflow using the Clear Skies MCP server.

## Scenario

A traveler wants to check if their flight tomorrow is safe to take, and if not, what backup options they have.

## Step-by-Step Workflow

### 1. Parse Natural Language Query

**User says:** "Check my flight AA123 tomorrow from JFK; if risky, find backup options"

```bash
npm run prompt parse_intent '{
  "text": "Check my flight AA123 tomorrow from JFK; if risky, find backup options"
}'
```

**Output:**
```json
{
  "intent": "risk_assessment_with_backup",
  "entities": {
    "flight": "AA123",
    "date": "tomorrow",
    "origin": "JFK",
    "request_backups": true
  }
}
```

### 2. Get Comprehensive Risk Assessment

```bash
npm run prompt risk_brief '{
  "flightIata": "AA123",
  "date": "2025-11-09",
  "depIata": "JFK"
}'
```

**Output:**
```json
{
  "flightIata": "AA123",
  "date": "2025-11-09",
  "depIata": "JFK",
  "arrIata": "LAX",
  "riskScore": 0.62,
  "tier": "yellow",
  "components": [
    {
      "key": "ops",
      "score": 0.45,
      "explanation": "ops: status=active delay≈30m",
      "weight": 0.4
    },
    {
      "key": "weather_dep",
      "score": 0.75,
      "explanation": "wx dep: wind=45kph gust=68kph thunder=true",
      "weight": 0.15
    },
    {
      "key": "weather_arr",
      "score": 0.1,
      "explanation": "wx arr: clear conditions",
      "weight": 0.15
    },
    {
      "key": "tsa",
      "score": 0.5,
      "explanation": "tsa: avg=40min lead=120min",
      "weight": 0.2
    },
    {
      "key": "news",
      "score": 0.3,
      "explanation": "news: hits=2",
      "weight": 0.1
    }
  ],
  "topSignals": [
    "ops: delay 30 minutes",
    "weather_dep: thunderstorms at departure",
    "tsa: above-average wait times"
  ],
  "recommendedActions": [
    "Monitor for gate/EDCT updates; enable push alerts.",
    "Consider earlier airport arrival buffer (+30–45m)."
  ]
}
```

### 3. Generate Mitigation Plan

```bash
npm run prompt generate_mitigation_plan '{
  "riskBrief": {
    "tier": "yellow",
    "riskScore": 0.62
  }
}'
```

**Output:**
```json
{
  "priority": "medium",
  "actions": [
    {
      "action": "Review backup options",
      "urgency": "before_departure",
      "description": "Identify next available flights on your route"
    },
    {
      "action": "Arrive earlier",
      "urgency": "before_departure",
      "description": "Add 30-45 minutes to your normal arrival buffer"
    },
    {
      "action": "Monitor conditions",
      "urgency": "monitor",
      "description": "Check for updates every 2-3 hours before departure"
    }
  ],
  "estimated_cost": "$0-50",
  "time_investment": "15-30 minutes"
}
```

### 4. Check Current Conditions at Departure Airport

```bash
npm run prompt airport_weather '{"iata":"JFK"}'
```

**Output:**
```json
{
  "airport": {
    "iata": "JFK",
    "name": "John F Kennedy International",
    "location": "NYC, United States"
  },
  "current": {
    "condition": "Thunderstorms",
    "temp_c": 18.3,
    "temp_f": 64.9,
    "wind_kph": 45.2,
    "wind_dir": "W",
    "visibility_km": 8,
    "precip_mm": 5.2
  },
  "hazards": {
    "high_winds": true,
    "low_visibility": false,
    "thunderstorms": true,
    "snow_ice": false,
    "description": "high winds, thunderstorms"
  },
  "next_6h_summary": "Thunderstorms → Partly cloudy",
  "alerts": []
}
```

### 5. Check TSA Wait Times

```bash
npm run prompt tsa_wait_times '{"iata":"JFK"}'
```

**Output:**
```json
{
  "airport": "JFK",
  "current_wait_estimate": "20-40 minutes",
  "recent_average_minutes": 38,
  "data_points": 8,
  "recommendation": "Consider arriving 30 minutes earlier than usual"
}
```

### 6. Search for Backup Flights (if needed)

```bash
npm run prompt search_backup_flights '{
  "origin": "JFK",
  "destination": "LAX",
  "date": "2025-11-09"
}'
```

**Output:**
```json
[
  {
    "flight": "Example: Next available departure",
    "airline": "Multiple carriers available",
    "departure": "2025-11-09",
    "arrival": "2025-11-09",
    "duration_minutes": 0,
    "availability": "Not implemented - integrate Amadeus/Sabre API",
    "price_estimate": "Unknown"
  }
]
```

### 7. Get Rebooking Policy

```bash
npm run prompt get_rebooking_policy '{"airline":"American Airlines"}'
```

**Output:**
```json
{
  "airline": "American Airlines",
  "policy_type": "flexible",
  "change_fee": "Varies by fare class",
  "conditions": [
    "Check airline website for specific policy",
    "Elite status may waive change fees",
    "Basic economy typically most restrictive"
  ],
  "protection_window_hours": 24,
  "recommendation": "Contact airline directly for current policy"
}
```

### 8. Search for Nearby Hotels (if needed)

```bash
npm run prompt search_nearby_hotels '{
  "airportIata": "LAX",
  "checkIn": "2025-11-09",
  "checkOut": "2025-11-10"
}'
```

**Output:**
```json
[
  {
    "name": "Airport hotels available",
    "location": "Near LAX",
    "distance_from_airport_km": 0,
    "price_per_night": "Unknown",
    "cancellation_policy": "Not implemented - integrate Amadeus Hotel API",
    "availability": "Unknown"
  }
]
```

## Decision Tree

```
┌─────────────────────────┐
│ Parse User Intent       │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Get Risk Brief          │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │  Tier?  │
        └────┬────┘
             │
     ┌───────┼───────┐
     │       │       │
     ▼       ▼       ▼
  ┌─────┐ ┌─────┐ ┌─────┐
  │Green│ │Yellow│ │ Red │
  └──┬──┘ └──┬──┘ └──┬──┘
     │       │       │
     │       │       └──► Search backup flights
     │       │           Search hotels
     │       │           Get rebooking policy
     │       │           Generate mitigation plan
     │       │
     │       └──────────► Check detailed weather
     │                   Check TSA times
     │                   Monitor updates
     │
     └──────────────────► Enable alerts only
```

## Summary

The Clear Skies MCP server provides:

1. **Concise Risk Assessments** - Not raw API dumps, but analyzed risk scores
2. **Actionable Recommendations** - Specific steps to take based on risk level
3. **Backup Planning Tools** - Find alternatives when things look risky
4. **Natural Language Understanding** - Parse user questions into structured queries
5. **Multi-Source Data Fusion** - Combine flight ops, weather, TSA, news into single view

All outputs are designed to be:
- **Concise** (~1-2KB vs 10KB+ raw data)
- **Structured** (easy for LLMs to parse and act on)
- **Actionable** (includes specific recommendations and next steps)
