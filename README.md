  # Clear Skies

  **A Model Context Protocol (MCP) server that fuses live aviation, operations, weather, and policy data to track and mitigate travel disruption.**

  [![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
  [![API](https://img.shields.io/badge/API-REST-green.svg)](http://localhost:3000/api/tools)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

  ## Overview

  Clear Skies combines "hard ops" signals (ATC programs, flight delays, weather) with "soft context" (labor actions, international advisories) to provide travelers with:

  - **Risk Scoring:** Weighted analysis across ops, weather, TSA, and news
  - **Actionable Insights:** Tier-based recommendations (green/yellow/red)
  - **Concise Briefs:** No raw API dumps—just what matters

  Perfect for travelers who want to know: *"Is my trip looking good, or do I need a backup plan?"*

  ## Data Sources

  All APIs are integrated and working with free tiers:

  - **Flights:** [aviationstack](https://aviationstack.com/) (100 requests/month, real-time flight data)
  - **Weather:** [WeatherAPI.com](https://www.weatherapi.com/) (1M requests/month, METAR/TAF forecasts)
  - **Security:** [MyTSA API](https://www.tsa.gov/) (Public API, checkpoint wait times) + **AI-powered news fallback** 🆕
  - **News:** [newsdata.io](https://newsdata.io/) (200 requests/day, travel disruption news)
  - **Intent Parsing:** [Google Gemini API](https://ai.google.dev/) (60 requests/minute, natural language processing)
  
  ### 🆕 AI-Powered Security News Interpreter
  
  When the TSA API is unavailable, Clear Skies automatically uses **Gemini AI** to analyze airport security headlines and extract actionable intelligence. The system searches for news about security lines, disruptions, staffing issues, and system outages, then uses AI to score risk and provide recommendations.
  
  **Learn more:** [NEWS_INTERPRETER.md](./NEWS_INTERPRETER.md)

  ## Setup

  ### Prerequisites

  - Node.js v20+
  - API keys for: aviationstack, WeatherAPI, newsdata.io, Google Gemini

  ### Installation

  ```bash
  npm install
  ```

  ### Configuration

  Create a `.env` file in the project root:

  ```env
  # Required API Keys (all have free tiers)
  AVIATIONSTACK_KEY=your_key_here          # Get at: https://aviationstack.com/
  WEATHERAPI_KEY=your_key_here             # Get at: https://www.weatherapi.com/
  NEWSDATA_KEY=your_key_here               # Get at: https://newsdata.io/
  GEMINI_API_KEY=your_key_here             # Get at: https://ai.google.dev/

  # TSA API (public, no key needed)
  MYTSA_APP=https://apps.tsa.dhs.gov/MyTSAWebService/GetConfirmedWaitTimes.ashx

  # Server Configuration
  MCP_WS_HOST=0.0.0.0
  MCP_WS_PORT=3000
  NODE_ENV=production
  ```

  **Free Tier Limits:**
  - Aviationstack: 100 API calls/month
  - WeatherAPI: 1,000,000 API calls/month
  - Newsdata.io: 200 API calls/day
  - Gemini: 60 requests/minute
  - TSA: Unlimited (public API)

  ### Build

  ```bash
  npm run build
  ```

  ## Usage

  ### Web Frontend (New! 🎉)

  The easiest way to use Clear Skies is through the web interface:

  1. **Start the server:**
    ```bash
    npm run dev:http
    ```

  2. **Open your browser:**
    ```
    http://localhost:3000
    ```

  3. **Ask a question:**
    - Type: "Check my flight AA123 tomorrow from JFK"
    - Click "Analyze Risk"
    - View comprehensive risk analysis with visual charts

  The frontend features:
  - Natural language input powered by Gemini AI
  - Animated risk score visualization
  - Component breakdowns and key signals
  - Actionable recommendations
  - Mobile-responsive design

  See [public/README.md](./public/README.md) for frontend documentation.

  ### Deployment Options

  **Option 1: HTTP REST API with Web Frontend (Recommended)**
  ```bash
  # Development
  npm run dev:http

  # Production
  npm run build
  npm run start:http
  ```
  Access web UI at `http://localhost:3000` or use API endpoints directly.

  **Option 2: MCP stdio server (for Claude Desktop)**
  ```bash
  npm run dev
  ```

  **Option 3: Docker (for production deployment)**
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

  **Interpret Security News (AI-powered):** 🆕
  ```bash
  curl -X POST http://localhost:3000/api/tools/interpret_security_news \
    -H "Content-Type: application/json" \
    -d '{"iata": "LAX"}'
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

  ### Available API Tools

  The server exposes 14 tools via HTTP REST API:

  #### Core Tools
  1. **`risk_brief`** - Comprehensive travel risk analysis (main tool)
    - Combines flight, weather, TSA, and news data
    - Returns risk score (0-100) and tier (green/yellow/red)
    - Provides actionable recommendations

  2. **`parse_intent`** - Natural language query parser
    - Converts user questions to structured JSON
    - Powered by Google Gemini AI

  #### Data Tools
  3. **`flight_status`** - Real-time flight information
    - Live departure/arrival times
    - Delays, gates, terminals
    - Flight status (scheduled, active, landed)

  4. **`airport_weather`** - Weather forecasts for airports
    - Current conditions and 3-day forecast
    - Temperature, wind, precipitation
    - Aviation-specific hazards

  5. **`tsa_wait_times`** - TSA checkpoint wait times
    - Current wait times by terminal
    - Historical patterns
    - Peak hour recommendations
    - **Automatic news fallback when API unavailable** 🆕

  6. **`interpret_security_news`** - 🆕 **AI-powered security analysis**
    - Analyzes news headlines using Gemini AI
    - Extracts security/disruption intelligence
    - Risk scoring and recommendations
    - Confidence assessment

  7. **`news_search`** - Travel disruption news
    - Airline strikes, ATC delays
    - Airport closures, weather events
    - Policy changes and advisories

  #### Action Tools
  8. **`search_backup_flights`** - Alternative flight options
  9. **`search_nearby_hotels`** - Hotels with flexible cancellation
  10. **`get_rebooking_policy`** - Airline change policies
  11. **`generate_mitigation_plan`** - Prioritized action plan

  #### AI Summary Tools
  12. **`summarize_risk_with_llm`** - Natural language risk summary
  13. **`summarize_weather_with_llm`** - Conversational weather report
  14. **`generate_travel_brief`** - Complete travel brief combining all data

  See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete API documentation with examples.

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

  ### Quick Start (Local)

  ```bash
  # Build and start the server
  docker compose up --build -d

  # Check container status
  docker compose ps

  # View logs
  docker compose logs -f

  # Stop the server
  docker compose down
  ```

  The API will be available at `http://localhost:3000`

  ### API Testing Examples

  ```bash
  # Health check
  curl http://localhost:3000/health

  # List all available tools
  curl http://localhost:3000/api/tools

  # Get real-time flight status
  curl -X POST http://localhost:3000/api/tools/flight_status \
    -H "Content-Type: application/json" \
    -d '{"flightIata": "AA100", "date": "2025-11-09"}'

  # Get comprehensive risk brief
  curl -X POST http://localhost:3000/api/tools/risk_brief \
    -H "Content-Type: application/json" \
    -d '{
      "flightIata": "AA100",
      "date": "2025-11-09",
      "depIata": "JFK",
      "paxType": "domestic"
    }'

  # Search travel news
  curl -X POST http://localhost:3000/api/tools/news_search \
    -H "Content-Type: application/json" \
    -d '{"query": "airline strike"}'

  # Get airport weather
  curl -X POST http://localhost:3000/api/tools/airport_weather \
    -H "Content-Type: application/json" \
    -d '{"iata": "JFK"}'
  ```

  ### Production Deployment (Vultr/VPS)

  **Step-by-Step Deployment:**

  1. **SSH into your server:**
    ```bash
    ssh root@your-vultr-ip
    ```

  2. **Install Docker:**
    ```bash
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    apt-get install docker-compose-plugin
    ```

  3. **Clone and configure:**
    ```bash
    git clone https://github.com/Harshit-Saini0/clear-skies.git
    cd clear-skies
    nano .env  # Add your API keys
    ```

  4. **Configure firewall:**
    ```bash
    ufw allow 3000/tcp
    ufw reload
    ```

  5. **Build and run:**
    ```bash
    docker compose up --build -d
    ```

  6. **Verify deployment:**
    ```bash
    curl http://your-vultr-ip:3000/health
    ```

  **Management commands:**
  ```bash
  # View logs
  docker compose logs -f

  # Restart
  docker compose restart

  # Update after code changes
  git pull origin main
  docker compose up --build -d

  # Check resource usage
  docker stats
  ```

  See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
  - Nginx reverse proxy with SSL/HTTPS
  - Domain setup with Let's Encrypt
  - Process management with PM2 or systemd
  - Production monitoring and troubleshooting
  - Complete API reference documentation

  ## Architecture

  - **HTTP REST API:** Express.js server for web frontends (`src/http-server.ts`)
  - **MCP Server:** TypeScript with stdio transport for Claude Desktop (`src/server.ts`)
  - **Prompt Gateway:** Gemini API for NLP → structured JSON
  - **Risk Engine:** Weighted scoring across 5 dimensions
  - **Provider Adapters:** Typed wrappers for each API
  - **Deployment:** Docker, Docker Compose, or standalone Node.js

  ## Frontend Integration

  ### JavaScript/React Example

  ```javascript
  const API_URL = 'http://your-vultr-ip:3000';

  async function getRiskBrief(flightIata, date) {
    const response = await fetch(`${API_URL}/api/tools/risk_brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flightIata,
        date,
        depIata: 'JFK',
        paxType: 'domestic'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Risk Score:', result.data.totalScore);
      console.log('Risk Tier:', result.data.tier);
      return result.data;
    } else {
      throw new Error(result.error);
    }
  }

  // Usage
  getRiskBrief('AA100', '2025-11-09')
    .then(data => console.log('Risk Analysis:', data))
    .catch(err => console.error('Error:', err));
  ```

  ### Python Example

  ```python
  import requests

  API_URL = 'http://your-vultr-ip:3000'

  def get_risk_brief(flight_iata, date):
      response = requests.post(
          f'{API_URL}/api/tools/risk_brief',
          json={
              'flightIata': flight_iata,
              'date': date,
              'depIata': 'JFK',
              'paxType': 'domestic'
          }
      )
      result = response.json()
      if result['success']:
          return result['data']
      else:
          raise Exception(result['error'])

  # Usage
  data = get_risk_brief('AA100', '2025-11-09')
  print(f"Risk Score: {data['totalScore']}")
  print(f"Risk Tier: {data['tier']}")
  ```

  ## API Response Format

  All endpoints return JSON with consistent structure:

  **Success Response:**
  ```json
  {
    "success": true,
    "data": {
      // Tool-specific data here
    }
  }
  ```

  **Error Response:**
  ```json
  {
    "success": false,
    "error": "Error message description"
  }
  ```

  ## Project Status

  ✅ HTTP REST API for web frontends  
  ✅ Core risk scoring engine  
  ✅ Multi-source data fusion (5 APIs)  
  ✅ Real-time flight data (Aviationstack)  
  ✅ Weather forecasts (WeatherAPI)  
  ✅ Travel news (Newsdata.io)  
  ✅ TSA wait times  
  ✅ **AI-powered security news interpretation** 🆕  
  ✅ **Automatic TSA fallback with Gemini AI** 🆕  
  ✅ MCP stdio transport  
  ✅ Gemini AI intent parsing & summaries  
  ✅ Docker containerization  
  ✅ Automatic error handling & fallbacks  
  ✅ Response caching (30s-1hr)  
  🔜 Rate limiting middleware  
  🔜 WebSocket support for real-time updates  
  🔜 Authentication/API keys  
  🔜 Enhanced backup search (hotels, alt flights)

  ## Performance & Caching

  - **Flight data:** 30 second cache
  - **Airport data:** 1 hour cache  
  - **Weather data:** 10 minute cache
  - **News data:** 10 minute cache
  - **Response time:** < 2 seconds average

  ## Security Notes

  ⚠️ **For Production:**
  - Add API authentication (API keys or JWT)
  - Configure CORS properly for your domain
  - Use HTTPS with SSL certificate
  - Implement rate limiting
  - Never commit `.env` file to git
  - Use environment-specific API keys  

  ## Troubleshooting

  ### Common Issues

  **Port 3000 already in use:**
  ```bash
  lsof -i :3000
  kill -9 <PID>
  ```

  **Docker build fails:**
  ```bash
  docker compose down
  docker system prune -a
  docker compose up --build -d
  ```

  **API returns 403 errors:**
  - Check API keys in `.env` file
  - Verify free tier limits haven't been exceeded
  - Aviationstack: 100 calls/month limit
  - Newsdata.io: 200 calls/day limit

  **Container keeps restarting:**
  ```bash
  docker compose logs --tail=50
  # Check for missing environment variables or API key issues
  ```

  ## API Rate Limits (Free Tiers)

  | API | Free Tier Limit | Caching |
  |-----|----------------|---------|
  | Aviationstack | 100/month | 30s (flights), 1hr (airports) |
  | WeatherAPI | 1M/month | 10 min |
  | Newsdata.io | 200/day | 10 min |
  | Gemini | 60/min | None |
  | TSA | Unlimited | 1 hour |

  ## Support & Documentation

  - **Full Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
  - **API Reference:** `http://your-server:3000/api/tools`
  - **Issues:** [GitHub Issues](https://github.com/Harshit-Saini0/clear-skies/issues)

  ## Tech Stack

  - **Runtime:** Node.js 20+ with TypeScript
  - **Server:** Express.js (HTTP) + MCP SDK (stdio)
  - **APIs:** Aviationstack, WeatherAPI, Newsdata.io, TSA, Gemini
  - **Caching:** LRU Cache
  - **Deployment:** Docker + Docker Compose
  - **Transport:** HTTP REST (web) + stdio (Claude Desktop)

  ## Contributing

  Contributions are welcome! Please:
  1. Fork the repository
  2. Create a feature branch
  3. Submit a pull request

  See project specification in `DEPLOYMENT.md` for detailed design goals.

  ## License

  MIT - See [LICENSE](LICENSE) for details

  ---

  **Built with ❤️ for travelers who want to stay ahead of disruptions**
