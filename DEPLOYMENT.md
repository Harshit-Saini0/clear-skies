# Clear Skies - Deployment Guide

## Overview

This guide covers deploying the Clear Skies MCP server as an HTTP REST API for use with web frontends.

## Architecture

- **HTTP Server**: Express.js REST API (`src/http-server.ts`)
- **MCP Server**: Original stdio transport (`src/server.ts`) - for Claude Desktop integration
- **Port**: 3000 (configurable via `MCP_WS_PORT`)
- **Host**: 0.0.0.0 (configurable via `MCP_WS_HOST`)

## Prerequisites

- Node.js v20+
- Docker & Docker Compose (for containerized deployment)
- API Keys:
  - Aviationstack API
  - WeatherAPI
  - Newsdata.io
  - Google Gemini

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
AVIATIONSTACK_KEY=your_key_here
WEATHERAPI_KEY=your_key_here
MYTSA_APP=https://apps.tsa.dhs.gov/MyTSAWebService/GetConfirmedWaitTimes.ashx
NEWSDATA_KEY=your_key_here
GEMINI_API_KEY=your_key_here

MCP_WS_HOST=0.0.0.0
MCP_WS_PORT=3000
NODE_ENV=development
```

### 3. Run Development Server

```bash
# HTTP API server (for web frontend)
npm run dev:http

# Or MCP stdio server (for Claude Desktop)
npm run dev
```

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List all available tools
curl http://localhost:3000/api/tools

# Test risk brief
curl -X POST http://localhost:3000/api/tools/risk_brief \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA123",
    "date": "2025-11-09",
    "depIata": "JFK",
    "paxType": "domestic"
  }'
```

## Vultr Server Deployment

### Option 1: Docker Compose (Recommended)

```bash
# 1. SSH into your Vultr server
ssh root@your-vultr-ip

# 2. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install docker-compose-plugin

# 3. Clone repository
git clone https://github.com/Harshit-Saini0/clear-skies.git
cd clear-skies

# 4. Create .env file with your API keys
nano .env
# (Paste your environment variables)

# 5. Build and start
docker compose up --build -d

# 6. Check logs
docker compose logs -f

# 7. Test the API
curl http://localhost:3000/health
```

### Option 2: Direct Node.js Deployment

```bash
# 1. SSH into Vultr server
ssh root@your-vultr-ip

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# 3. Clone and setup
git clone https://github.com/Harshit-Saini0/clear-skies.git
cd clear-skies
npm install

# 4. Create .env file
nano .env
# (Add your keys)

# 5. Build
npm run build

# 6. Run with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "clear-skies-api" -- run start:http
pm2 save
pm2 startup
```

### Option 3: Systemd Service

Create `/etc/systemd/system/clear-skies.service`:

```ini
[Unit]
Description=Clear Skies API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/clear-skies
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start:http
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable clear-skies
systemctl start clear-skies
systemctl status clear-skies
```

## Firewall Configuration

Allow incoming connections to port 3000:

```bash
# UFW (Ubuntu/Debian)
ufw allow 3000/tcp
ufw reload

# iptables
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

## Nginx Reverse Proxy (Optional)

For production, use Nginx as reverse proxy with SSL:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Add SSL with Let's Encrypt:

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## API Endpoints

### Health Check
```
GET /health
Response: {"status": "ok", "service": "clear-skies-mcp", "version": "0.1.0"}
```

### List Tools
```
GET /api/tools
Response: {"tools": [...]}
```

### Tool Endpoints (All POST)

#### 1. Parse Intent
```
POST /api/tools/parse_intent
Body: {"text": "Check my flight AA123 tomorrow"}
```

#### 2. Flight Status
```
POST /api/tools/flight_status
Body: {"flightIata": "AA123", "date": "2025-11-09"}
```

#### 3. Airport Weather
```
POST /api/tools/airport_weather
Body: {"iata": "JFK"}
```

#### 4. TSA Wait Times
```
POST /api/tools/tsa_wait_times
Body: {"iata": "LAX"}
```

#### 5. News Search
```
POST /api/tools/news_search
Body: {"query": "airline strike", "from": "2025-11-01"}
```

#### 6. Risk Brief (Main Tool)
```
POST /api/tools/risk_brief
Body: {
  "flightIata": "AA123",
  "date": "2025-11-09",
  "depIata": "JFK",
  "arrIata": "LAX",
  "paxType": "domestic",
  "targetArrivalLeadMins": 120
}
```

#### 7. Search Backup Flights
```
POST /api/tools/search_backup_flights
Body: {"origin": "JFK", "destination": "LAX", "date": "2025-11-09"}
```

#### 8. Search Nearby Hotels
```
POST /api/tools/search_nearby_hotels
Body: {"airportIata": "LAX", "checkIn": "2025-11-09", "checkOut": "2025-11-10"}
```

#### 9. Get Rebooking Policy
```
POST /api/tools/get_rebooking_policy
Body: {"airline": "American Airlines", "fareClass": "Economy"}
```

#### 10. Generate Mitigation Plan
```
POST /api/tools/generate_mitigation_plan
Body: {"riskBrief": {...}}
```

#### 11. Summarize Risk with LLM
```
POST /api/tools/summarize_risk_with_llm
Body: {"riskBrief": {...}}
```

#### 12. Summarize Weather with LLM
```
POST /api/tools/summarize_weather_with_llm
Body: {"weatherData": {...}}
```

#### 13. Generate Travel Brief
```
POST /api/tools/generate_travel_brief
Body: {"data": {"riskBrief": {...}, "weather": {...}, "tsa": {...}, "news": {...}}}
```

## Response Format

All endpoints return JSON with this structure:

**Success:**
```json
{
  "success": true,
  "data": {...}
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Frontend Integration Example

### JavaScript/React

```javascript
const API_BASE = 'http://your-vultr-ip:3000';

// Get risk brief for a flight
async function getRiskBrief(flightIata, date) {
  const response = await fetch(`${API_BASE}/api/tools/risk_brief`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      flightIata,
      date,
      paxType: 'domestic'
    })
  });
  
  const result = await response.json();
  if (result.success) {
    return result.data;
  } else {
    throw new Error(result.error);
  }
}

// Usage
getRiskBrief('AA123', '2025-11-09')
  .then(data => console.log('Risk Brief:', data))
  .catch(err => console.error('Error:', err));
```

## Monitoring

### Docker Compose

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps

# Restart
docker compose restart

# Stop
docker compose down
```

### PM2

```bash
# Status
pm2 status

# Logs
pm2 logs clear-skies-api

# Restart
pm2 restart clear-skies-api

# Monitor
pm2 monit
```

### Systemd

```bash
# Status
systemctl status clear-skies

# Logs
journalctl -u clear-skies -f

# Restart
systemctl restart clear-skies
```

## Security Considerations

1. **API Keys**: Never commit `.env` to git
2. **CORS**: Configure appropriate origins in production
3. **Rate Limiting**: Add rate limiting middleware for production
4. **SSL**: Use HTTPS in production with Let's Encrypt
5. **Firewall**: Only open necessary ports
6. **Authentication**: Consider adding API key authentication for production

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill the process
kill -9 <PID>
```

### Environment Variables Not Loading
```bash
# Verify .env file exists and has correct permissions
ls -la .env
cat .env

# Ensure docker-compose.yml references .env
docker compose config
```

### API Returns 500 Errors
```bash
# Check logs for detailed error
docker compose logs -f
# or
pm2 logs
# or
journalctl -u clear-skies -f
```

## Updates and Maintenance

```bash
# Pull latest changes
cd clear-skies
git pull origin main

# Rebuild and restart (Docker)
docker compose up --build -d

# Or restart (PM2)
npm install
npm run build
pm2 restart clear-skies-api

# Or restart (Systemd)
npm install
npm run build
systemctl restart clear-skies
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/Harshit-Saini0/clear-skies/issues
- Review logs and error messages carefully
- Ensure all API keys are valid and have appropriate quotas
