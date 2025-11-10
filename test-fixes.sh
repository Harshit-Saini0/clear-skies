#!/bin/bash

echo "=== Testing Clear Skies API Fixes ==="
echo ""

BASE_URL="http://localhost:3000"

echo "1. Testing Health Check..."
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. Testing Intent Parsing (American 100)..."
curl -s -X POST "$BASE_URL/api/tools/parse_intent" \
  -H "Content-Type: application/json" \
  -d '{"text": "Check American flight 100 tomorrow from JFK"}' | jq .
echo ""

echo "3. Testing Intent Parsing (AA123)..."
curl -s -X POST "$BASE_URL/api/tools/parse_intent" \
  -H "Content-Type: application/json" \
  -d '{"text": "Is my flight AA123 tomorrow risky?"}' | jq .
echo ""

echo "4. Testing TSA Wait Times (should return quickly even if API times out)..."
curl -s -m 8 -X POST "$BASE_URL/api/tools/tsa_wait_times" \
  -H "Content-Type: application/json" \
  -d '{"iata": "JFK"}' | jq .
echo ""

echo "5. Testing Flight Status..."
curl -s -m 10 -X POST "$BASE_URL/api/tools/flight_status" \
  -H "Content-Type: application/json" \
  -d '{"flightIata": "AA100", "date": "2025-11-10"}' | jq .
echo ""

echo "6. Testing Risk Brief (should complete quickly now)..."
curl -s -m 15 -X POST "$BASE_URL/api/tools/risk_brief" \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA100",
    "date": "2025-11-10",
    "depIata": "JFK",
    "paxType": "domestic"
  }' | jq .
echo ""

echo "=== Tests Complete ==="
