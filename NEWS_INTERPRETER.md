# LLM-Powered News Interpreter for Airport Security

## Overview

When the TSA API is unavailable (which is currently the case), the Clear Skies system now automatically falls back to using **news API + Gemini AI** to assess airport security conditions and disruptions.

## How It Works

### 1. **Enhanced TSA Provider** (`src/providers/tsa.ts`)

The TSA provider now:
- First attempts to fetch data from the MyTSA API
- If the API is down or returns no data, automatically searches news sources for security-related headlines
- Returns a structured response indicating the data source (`tsa_api`, `news_fallback`, or `no_data`)

**News Search Strategy:**
```typescript
// Searches multiple queries for comprehensive coverage
- "{IATA} airport security line"
- "{Airport Name} TSA"
- "{IATA} checkpoint"
- "{Airport Name} security wait"
```

### 2. **LLM News Interpreter** (`src/llm-news-interpreter.ts`)

A new AI-powered module that:
- **Analyzes news headlines** using Google Gemini 2.5 Flash
- **Extracts security intelligence** from unstructured news text
- **Scores risk** on a 0-1 scale based on:
  - Security checkpoint wait times and staffing
  - System outages or technical issues
  - Security incidents or evacuations
  - Protests or labor actions
  - Terminal closures or restricted access

**Example Analysis Output:**
```json
{
  "riskScore": 0.85,
  "keyIssues": [
    "US Federal Government Shutdown",
    "Widespread FAA-mandated Flight Cuts",
    "Potential Airport Security (TSA) Staffing Issues"
  ],
  "waitTimeEstimate": "high",
  "recommendation": "Arrive 2+ hours early. Check airport status frequently.",
  "confidence": "high",
  "summary": "LAX experiencing severe operational disruptions..."
}
```

**Confidence Levels:**
- **Low**: Headlines are generic or not airport-specific
- **Medium**: Headlines mention the airport but lack specific details
- **High**: Headlines provide specific, recent security/disruption information

**Risk Scoring Guidelines:**
- **0.0-0.2**: No security concerns, normal operations
- **0.2-0.4**: Minor delays or routine security measures
- **0.4-0.6**: Moderate concerns (longer lines, staffing issues)
- **0.6-0.8**: Significant disruptions (outages, major delays, protests)
- **0.8-1.0**: Severe issues (closures, evacuations, major incidents)

### 3. **Integrated Risk Scoring** (`src/risk.ts`)

The risk brief now intelligently combines:
- **LLM news analysis** (when TSA API unavailable)
- **Time-based risk** (estimated wait vs. flight lead time)
- **Confidence weighting** (prioritizes high-confidence news)

**Blending Strategy:**
```typescript
// High confidence: Use news risk directly
if (confidence === "high") {
  return newsAnalysis.riskScore;
}

// Medium/Low confidence: Blend news + time-based risk
const confidenceWeight = confidence === "medium" ? 0.6 : 0.3;
const blendedRisk = (newsRisk * confidenceWeight) + (timeRisk * (1 - confidenceWeight));
```

### 4. **New API Endpoint** (`/api/tools/interpret_security_news`)

A dedicated endpoint to access the LLM news interpretation directly:

**Request:**
```bash
curl -X POST http://localhost:3000/api/tools/interpret_security_news \
  -H "Content-Type: application/json" \
  -d '{"iata": "LAX"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "airport": "LAX",
    "dataSource": "news_fallback",
    "analysis": {
      "riskScore": 0.85,
      "keyIssues": ["..."],
      "waitTimeEstimate": "high",
      "recommendation": "...",
      "confidence": "high",
      "summary": "..."
    },
    "rawHeadlines": [...]
  }
}
```

## Usage Examples

### Example 1: Get Security News Analysis

```bash
curl -X POST http://localhost:3000/api/tools/interpret_security_news \
  -H "Content-Type: application/json" \
  -d '{"iata": "JFK"}'
```

### Example 2: Risk Brief with News-Based TSA Data

```bash
curl -X POST http://localhost:3000/api/tools/risk_brief \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA100",
    "date": "2025-11-10",
    "depIata": "LAX",
    "paxType": "domestic"
  }'
```

**Look for the TSA component in the response:**
```json
{
  "key": "tsa",
  "score": 0.21,
  "explanation": "tsa: news-based (~20min est) - US Federal Shutdown",
  "weight": 0.2
}
```

### Example 3: Web Frontend Integration

The web frontend automatically benefits from this enhancement. When you check a flight, the risk analysis now includes AI-interpreted security news when TSA data is unavailable.

## Technical Architecture

```
┌─────────────────┐
│  Risk Brief API │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ TSA Check│
    └────┬─────┘
         │
    ┌────▼────────────────────┐
    │ TSA API Available?      │
    │ ├─ Yes → Use TSA Data   │
    │ └─ No  → News Fallback  │
    └────┬────────────────────┘
         │ (News Fallback)
         │
    ┌────▼────────────────────┐
    │ Search News API         │
    │ - Security headlines    │
    │ - Airport disruptions   │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │ LLM News Interpreter    │
    │ (Gemini 2.5 Flash)      │
    │ - Analyze headlines     │
    │ - Extract risk signals  │
    │ - Generate score        │
    └────┬────────────────────┘
         │
    ┌────▼────────────────────┐
    │ Intelligent Blending    │
    │ - News risk score       │
    │ - Time-based risk       │
    │ - Confidence weighting  │
    └────┬────────────────────┘
         │
    ┌────▼─────────┐
    │ Final TSA    │
    │ Risk Score   │
    └──────────────┘
```

## Benefits

✅ **Resilient**: System continues working even when TSA API is down  
✅ **Intelligent**: AI extracts actionable insights from unstructured news  
✅ **Comprehensive**: Detects issues TSA API might miss (strikes, outages, etc.)  
✅ **Transparent**: Clear indication of data source in responses  
✅ **Automatic**: No code changes needed - works out of the box  

## Fallback Behavior

The system has **three levels of fallback**:

1. **Primary**: TSA API data (when available)
2. **Secondary**: LLM-interpreted news headlines (when TSA unavailable)
3. **Tertiary**: Keyword-based news analysis (if LLM fails)

This ensures the system always provides useful risk assessment, even under adverse conditions.

## Caching Strategy

- **TSA API data**: 1 hour cache
- **News backup data**: 30 minutes cache (shorter due to fast-changing news)
- **LLM interpretations**: Cached with news data (no separate cache)

## Performance

- **Response time**: ~2-3 seconds for news-based analysis (includes news API + LLM)
- **Accuracy**: High confidence when recent, specific headlines available
- **API costs**: 
  - Newsdata.io: Free tier (200 requests/day)
  - Gemini: Free tier (60 requests/minute)

## Monitoring

Check data sources in responses:

```json
{
  "data_source": "news_fallback",  // Indicates news-based analysis
  "explanation": "tsa: news-based (~20min est) - US Federal Shutdown"
}
```

## Future Enhancements

🔜 **Multi-source aggregation**: Combine Twitter, Reddit, airport websites  
🔜 **Historical patterns**: Learn typical wait times by hour/day  
🔜 **Real-time alerts**: Push notifications for breaking security news  
🔜 **Image analysis**: Process photos of security lines from social media  

---

**Built with ❤️ to keep travelers informed even when APIs fail**
