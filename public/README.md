# Clear Skies Frontend

A clean, modern web interface for the Clear Skies travel risk analysis system.

## Features

- 🎯 **Natural Language Input**: Ask questions in plain English
- 📊 **Visual Risk Scoring**: Animated circular progress indicator with color-coded risk levels
- 📈 **Component Breakdown**: Detailed risk scores across flight, weather, TSA, and news
- 💡 **Smart Recommendations**: Actionable advice based on risk tier
- 🎨 **Responsive Design**: Works on desktop, tablet, and mobile

## Quick Start

1. **Start the backend server:**
   ```bash
   npm run dev:http
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

3. **Try example queries:**
   - "Check my flight AA123 tomorrow from JFK"
   - "Is my United UA100 flight on November 10 looking risky?"
   - "Analyze Delta DL456 from LAX on 2025-11-15"

## Usage

1. Enter your travel query in natural language
2. Click "Analyze Risk" (or press Ctrl+Enter)
3. View your comprehensive risk analysis:
   - **Risk Score**: 0-100 scale with visual indicator
   - **Risk Tier**: Green (safe), Yellow (caution), or Red (high risk)
   - **Component Scores**: Breakdown by data source
   - **Key Signals**: Important alerts from various sources
   - **Recommendations**: Specific actions to take

## Architecture

### Frontend Stack
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS custom properties
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Fetch API** - HTTP requests to backend

### API Integration
The frontend calls two main endpoints:

1. **Parse Intent** (`/api/tools/parse_intent`)
   - Converts natural language to structured data
   - Extracts flight number, date, airports

2. **Risk Brief** (`/api/tools/risk_brief`)
   - Gets comprehensive risk analysis
   - Returns scores, signals, and recommendations

### File Structure
```
public/
├── index.html    # Main HTML structure
├── styles.css    # All styling and animations
└── app.js        # API calls and DOM manipulation
```

## Customization

### Colors
Edit CSS custom properties in `styles.css`:
```css
:root {
    --primary: #2563eb;      /* Primary brand color */
    --success: #10b981;      /* Green tier */
    --warning: #f59e0b;      /* Yellow tier */
    --danger: #ef4444;       /* Red tier */
}
```

### API URL
Change the API endpoint in `app.js`:
```javascript
const API_URL = 'http://localhost:3000';  // Update for production
```

### Risk Thresholds
Risk tiers are calculated by the backend, but display logic is in `styles.css`:
- **Green**: < 30 (low risk)
- **Yellow**: 30-60 (moderate risk)
- **Red**: > 60 (high risk)

## Features Breakdown

### Risk Score Circle
- Animated SVG circle that fills based on score
- Color changes based on risk tier
- Smooth animation using stroke-dashoffset

### Component Scores
- Flight operations score
- Weather hazards score
- TSA wait time score
- News/disruption score

### Top Signals
- Most important alerts from each data source
- Sorted by severity
- Color-coded by source

### Recommendations
- Tier-specific advice
- Actionable items with checkmarks
- Prioritized by urgency

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Performance

- **Load Time**: < 1 second
- **API Response**: < 2 seconds average
- **Animations**: 60fps smooth transitions
- **Bundle Size**: ~15KB (unminified)

## Security Notes

⚠️ **For Production:**
- Add HTTPS/SSL certificate
- Implement rate limiting
- Add authentication if needed
- Configure CORS properly
- Use environment variables for API URL

## Development

### Live Reload
Use VS Code Live Server or any static server:
```bash
# Option 1: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 2: Python
python3 -m http.server 8000

# Option 3: Node.js http-server
npx http-server public -p 8000
```

### Debugging
- Open browser DevTools (F12)
- Check Console for API errors
- Use Network tab to inspect API calls
- Example prompts logged to console on load

## Troubleshooting

**API not responding:**
- Ensure backend is running: `npm run dev:http`
- Check API URL in `app.js` matches your server
- Verify no CORS errors in console

**No results shown:**
- Check console for errors
- Verify API keys are set in backend `.env`
- Try a different flight/date combination

**Styling issues:**
- Clear browser cache
- Check for CSS syntax errors
- Ensure `styles.css` is loaded

## Future Enhancements

- 🔄 Real-time updates via WebSocket
- 📱 Progressive Web App (PWA) support
- 🌙 Dark mode toggle
- 📅 Date picker for easier input
- 🔔 Push notifications for risk changes
- 📊 Historical risk trends chart
- 💾 Save favorite flights/routes
- 🌍 Multi-language support

## Contributing

Frontend improvements welcome! Areas for contribution:
- UI/UX enhancements
- Accessibility improvements
- Mobile optimization
- Additional visualizations
- Performance optimizations

## License

MIT - See LICENSE for details
