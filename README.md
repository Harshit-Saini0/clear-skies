# Clear Skies

**A Model Context Protocol (MCP) server that fuses live aviation, operations, weather, and policy data to track and mitigate travel disruption.**

## Overview

Clear Skies combines "hard ops" signals (ATC programs, flight delays, weather) with "soft context" (labor actions, international advisories) to provide travelers with:

- **Risk Scoring:** Weighted analysis across ops, weather, TSA, and news
- **Actionable Insights:** Tier-based recommendations (green/yellow/red)
- **Concise Briefs:** No raw API dumps—just what matters

Perfect for travelers who want to know: *"Is my trip looking good, or do I need a backup plan?"*

## Data Sources

- **Flights:** aviationstack (live status, schedules, aircraft data)
- **Weather:** WeatherAPI.com (METAR/TAF, hazard forecasts)
- **Security:** MyTSA API (checkpoint wait times)
- **News:** newsdata.io (strikes, disruptions, policy changes)
- **Intent Parsing:** Google Gemini API (natural language → structured)

## Setup

### Prerequisites

- Node.js v20+
- API keys for: aviationstack, WeatherAPI, newsdata.io, Google Gemini

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:

```env
AVIATIONSTACK_API_KEY=your_key_here
WEATHERAPI_KEY=your_key_here
NEWSDATA_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

### Build

```bash
npm run build
```

## Usage

### Deployment Options

**Option 1: HTTP REST API (for web frontends)**
```bash
# Development
npm run dev:http

# Production
npm run build
npm run start:http
```

**Option 2: MCP stdio server (for Claude Desktop)**
```bash
npm run dev
```

**Option 3: Docker (recommended for production)**
```bash
docker compose up -d
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

### HTTP API Endpoints

Once the server is running (default: `http://localhost:3000`):

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Get Risk Brief:**
```bash
curl -X POST http://localhost:3000/api/tools/risk_brief \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA123",
    "date": "2025-11-09",
    "depIata": "JFK",
    "paxType": "domestic"
  }'
```

**List All Tools:**
```bash
curl http://localhost:3000/api/tools
```

### MCP Client Usage (stdio)

For MCP-compatible clients like Claude Desktop:

```bash
npm run prompt risk_brief '{
  "flightIata": "AA123",
  "date": "2025-11-09",
  "depIata": "JFK",
  "paxType": "domestic"
}'
```

**Output:** Structured JSON with risk score, tier, component breakdowns, top signals, and recommendations.

### Parse Natural Language

Convert user questions into structured intents:

```bash
npm run prompt parse_intent '{
  "text": "Check my flight AA123 tomorrow from JFK; if risky hold a hotel."
}'
```

### Helper Tools

- `flight_status` - Current flight operations
- `airport_weather` - Weather forecast for airport
- `tsa_wait_times` - Security checkpoint queues
- `news_search` - Recent travel disruption news

See [USAGE.md](./USAGE.md) for detailed examples and architecture.

## Example Workflow

1. **User asks:** *"Is my flight AA123 tomorrow looking risky?"*
2. **Parse intent:** Extract flight, date, origin
3. **Get risk brief:** Fetch all data, compute scores
4. **Return analysis:** "Yellow tier - thunderstorms at departure, arrive 45min early"

## Development

```bash
# Run HTTP API in dev mode (for web frontends)
npm run dev:http

# Run MCP stdio server in dev mode (for Claude Desktop)
npm run dev

# Test all tools
npm run test:all

# Interactive testing
npm run prompt <tool_name> <json_args>
```

## Docker Deployment

### Quick Start

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### API Testing

```bash
# Health check
curl http://localhost:3000/health

# Get risk brief
curl -X POST http://localhost:3000/api/tools/risk_brief \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA123",
    "date": "2025-11-09",
    "depIata": "JFK",
    "paxType": "domestic"
  }'
```

### Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Vultr/VPS server setup
- Nginx reverse proxy configuration
- SSL/HTTPS setup with Let's Encrypt
- Process management with PM2 or systemd
- Complete API documentation

## Architecture

- **HTTP REST API:** Express.js server for web frontends (`src/http-server.ts`)
- **MCP Server:** TypeScript with stdio transport for Claude Desktop (`src/server.ts`)
- **Prompt Gateway:** Gemini API for NLP → structured JSON
- **Risk Engine:** Weighted scoring across 5 dimensions
- **Provider Adapters:** Typed wrappers for each API
- **Deployment:** Docker, Docker Compose, or standalone Node.js

## Project Status

✅ Core risk scoring engine  
✅ Multi-source data fusion  
✅ MCP stdio transport  
✅ Gemini intent parsing  
⚠️ API rate limits (need caching)  
🔜 Delta updates (streaming changes)  
🔜 Backup search (hotels, alt flights)  
🔜 Production deployment (Vultr)  

## Contributing

See project specification in `USAGE.md` for detailed design goals.

## License

MIT
