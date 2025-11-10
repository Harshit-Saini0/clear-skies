#!/bin/bash

# Test script for LLM News Interpreter feature
# Demonstrates the new AI-powered security news analysis

echo "================================================"
echo "Clear Skies: LLM News Interpreter Test"
echo "================================================"
echo ""

API_URL="http://localhost:3000"

echo "1. Testing health check..."
curl -s "$API_URL/health" | python3 -m json.tool
echo ""
echo ""

echo "2. Testing interpret_security_news for LAX..."
echo "   (Should return AI analysis of security headlines)"
curl -s -X POST "$API_URL/api/tools/interpret_security_news" \
  -H "Content-Type: application/json" \
  -d '{"iata": "LAX"}' | python3 -m json.tool | head -60
echo "   ... (truncated)"
echo ""
echo ""

echo "3. Testing interpret_security_news for JFK..."
curl -s -X POST "$API_URL/api/tools/interpret_security_news" \
  -H "Content-Type: application/json" \
  -d '{"iata": "JFK"}' | python3 -m json.tool | head -40
echo "   ... (truncated)"
echo ""
echo ""

echo "4. Testing risk_brief with news-based TSA scoring..."
echo "   (Flight AA100, LAX departure)"
curl -s -X POST "$API_URL/api/tools/risk_brief" \
  -H "Content-Type: application/json" \
  -d '{
    "flightIata": "AA100",
    "date": "2025-11-10",
    "depIata": "LAX",
    "paxType": "domestic"
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data['success']:
    brief = data['data']
    print(f\"  Flight: {brief['flightIata']}\")
    print(f\"  Date: {brief['date']}\")
    print(f\"  Departure: {brief['depIata']}\")
    print(f\"  Risk Score: {brief['riskScore']:.2f}\")
    print(f\"  Risk Tier: {brief['tier'].upper()}\")
    print()
    print('  Risk Components:')
    for comp in brief['components']:
        print(f\"    {comp['key']:15} Score: {comp['score']:.2f}  Weight: {comp['weight']:.2f}\")
        print(f\"                    Explanation: {comp['explanation']}\")
    print()
    print('  Top Signals:')
    for signal in brief['topSignals'][:3]:
        print(f\"    - {signal}\")
    print()
    print('  Recommended Actions:')
    for action in brief['recommendedActions']:
        print(f\"    - {action}\")
else:
    print(f\"  Error: {data.get('error', 'Unknown error')}\")
"
echo ""
echo ""

echo "5. Testing TSA wait times (with news fallback)..."
curl -s -X POST "$API_URL/api/tools/tsa_wait_times" \
  -H "Content-Type: application/json" \
  -d '{"iata": "SFO"}' | python3 -c "
import json, sys
data = json.load(sys.stdin)
if data['success']:
    tsa = data['data']
    print(f\"  Airport: {tsa['airport']}\")
    print(f\"  Data Source: {tsa['data_source']}\")
    print(f\"  Wait Estimate: {tsa['current_wait_estimate']}\")
    print(f\"  Recent Average: {tsa['recent_average_minutes']} minutes\")
    print(f\"  Data Points: {tsa['data_points']}\")
    print(f\"  Recommendation: {tsa['recommendation']}\")
    if 'news_backup' in tsa:
        print()
        print('  News Backup:')
        print(f\"    Headlines: {tsa['news_backup']['headlines_count']}\")
        print(f\"    Risk Level: {tsa['news_backup']['risk_level']}\")
        if tsa['news_backup']['key_issues']:
            print(f\"    Key Issues: {', '.join(tsa['news_backup']['key_issues'])}\")
else:
    print(f\"  Error: {data.get('error', 'Unknown error')}\")
"
echo ""
echo ""

echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Key Features Demonstrated:"
echo "  ✓ LLM-powered news interpretation"
echo "  ✓ Automatic fallback when TSA API unavailable"
echo "  ✓ AI-extracted security insights"
echo "  ✓ Integration with risk scoring system"
echo ""
