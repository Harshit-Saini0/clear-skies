const API_URL = 'http://localhost:3000';

// DOM Elements
const userPrompt = document.getElementById('userPrompt');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const resultsSection = document.getElementById('results');
const errorDiv = document.getElementById('error');

// Event Listeners
analyzeBtn.addEventListener('click', handleAnalyze);
clearBtn.addEventListener('click', handleClear);
userPrompt.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        handleAnalyze();
    }
});

async function handleAnalyze() {
    const prompt = userPrompt.value.trim();
    
    if (!prompt) {
        showError('Please enter a prompt to analyze');
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();
    hideResults();

    try {
        // Step 1: Parse the intent
        const intent = await parseIntent(prompt);
        console.log('Parsed intent:', intent);
        
        if (!intent.flightIata || !intent.date) {
            showError('Could not extract flight information. Please include flight number and date. Debug: ' + JSON.stringify(intent));
            return;
        }

        // Step 2: Get risk brief
        const riskData = await getRiskBrief({
            flightIata: intent.flightIata,
            date: intent.date,
            depIata: intent.depIata || 'JFK',
            paxType: intent.paxType || 'domestic'
        });
        
        console.log('Risk data received:', riskData);

        // Step 3: Display results
        displayResults(riskData);

    } catch (error) {
        showError(error.message || 'Failed to analyze travel risk. Please try again.');
        console.error('Analysis error:', error);
    } finally {
        setLoading(false);
    }
}

async function parseIntent(text) {
    const response = await fetch(`${API_URL}/api/tools/parse_intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });

    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Failed to parse intent');
    }

    return result.data;
}

async function getRiskBrief(params) {
    const response = await fetch(`${API_URL}/api/tools/risk_brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });

    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Failed to get risk brief');
    }

    return result.data;
}

function displayResults(data) {
    resultsSection.style.display = 'block';

    // Risk Badge
    const riskBadge = document.getElementById('riskBadge');
    riskBadge.textContent = data.tier;
    riskBadge.className = `risk-badge ${data.tier}`;

    // Risk Score Circle (convert 0-1 to 0-100)
    const scorePercent = Math.round(data.riskScore * 100);
    displayRiskScore(scorePercent, data.tier);

    // Flight Info (if available)
    if (data.flightData) {
        displayFlightInfo(data.flightData);
    }

    // Component Scores
    displayComponentScores(data.components);

    // Top Signals
    displayTopSignals(data.topSignals);

    // Recommendations
    displayRecommendations(data.recommendedActions);

    // AI Summary (if available)
    if (data.summary) {
        displaySummary(data.summary);
    }

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displayRiskScore(score, tier) {
    const scoreValue = document.getElementById('scoreValue');
    const scoreCircle = document.getElementById('scoreCircle');
    const circle = document.querySelector('.score-circle');

    // Set tier class for color
    circle.className = `score-circle ${tier}`;

    // Animate score
    let currentScore = 0;
    const increment = score / 50;
    const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= score) {
            currentScore = score;
            clearInterval(timer);
        }
        scoreValue.textContent = Math.round(currentScore);
    }, 20);

    // Animate circle
    const circumference = 314;
    const offset = circumference - (score / 100) * circumference;
    scoreCircle.style.strokeDashoffset = offset;
}

function displayFlightInfo(flightData) {
    const flightInfo = document.getElementById('flightInfo');
    const flightDetails = document.getElementById('flightDetails');

    if (!flightData || !flightData.flight) {
        flightInfo.style.display = 'none';
        return;
    }

    const flight = flightData.flight;
    
    flightDetails.innerHTML = `
        <div class="flight-detail">
            <span class="detail-label">Flight:</span>
            <span class="detail-value">${flight.iata || 'N/A'}</span>
        </div>
        <div class="flight-detail">
            <span class="detail-label">Status:</span>
            <span class="detail-value">${flight.status || 'N/A'}</span>
        </div>
        <div class="flight-detail">
            <span class="detail-label">Departure:</span>
            <span class="detail-value">${flight.departure?.airport || 'N/A'}</span>
        </div>
        <div class="flight-detail">
            <span class="detail-label">Arrival:</span>
            <span class="detail-value">${flight.arrival?.airport || 'N/A'}</span>
        </div>
        ${flight.departure?.delay ? `
        <div class="flight-detail">
            <span class="detail-label">Delay:</span>
            <span class="detail-value" style="color: var(--danger);">${flight.departure.delay} min</span>
        </div>
        ` : ''}
    `;

    flightInfo.style.display = 'block';
}

function displayComponentScores(components) {
    const componentDetails = document.getElementById('componentDetails');
    
    // Components is an array of objects with {key, score, explanation, weight}
    if (!components || components.length === 0) {
        componentDetails.innerHTML = '<p style="color: var(--gray-700);">No component data available.</p>';
        return;
    }
    
    componentDetails.innerHTML = components
        .map(comp => {
            const scorePercent = Math.round(comp.score * 100);
            return `
                <div class="component-item">
                    <span class="component-label">${formatComponentName(comp.key)}</span>
                    <span class="component-score" style="color: ${getScoreColor(scorePercent)}">${scorePercent}</span>
                </div>
            `;
        }).join('');
}

function displayTopSignals(signals) {
    const signalsList = document.getElementById('signalsList');
    
    if (!signals || signals.length === 0) {
        signalsList.innerHTML = '<p style="color: var(--gray-700);">No significant signals detected.</p>';
        return;
    }

    signalsList.innerHTML = signals.map(signal => {
        // Signal is a string like "ops: Flight delayed 30 minutes"
        const parts = signal.split(':');
        const source = parts[0]?.trim() || 'UNKNOWN';
        const message = parts.slice(1).join(':').trim() || signal;
        
        return `
            <div class="signal-item">
                <div class="signal-source">${source}</div>
                <div class="signal-message">${message}</div>
            </div>
        `;
    }).join('');
}

function displayRecommendations(recommendations) {
    const recommendationsList = document.getElementById('recommendationsList');
    
    if (!recommendations || recommendations.length === 0) {
        recommendationsList.innerHTML = '<p style="color: var(--gray-700);">No specific recommendations at this time.</p>';
        return;
    }

    recommendationsList.innerHTML = `<ul>${recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>`;
}

function displaySummary(summary) {
    const summaryDiv = document.getElementById('summary');
    const summaryText = document.getElementById('summaryText');
    
    if (summary) {
        summaryText.textContent = summary;
        summaryDiv.style.display = 'block';
    } else {
        summaryDiv.style.display = 'none';
    }
}

function formatComponentName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function getScoreColor(score) {
    if (score < 30) return 'var(--success)';
    if (score < 60) return 'var(--warning)';
    return 'var(--danger)';
}

function setLoading(loading) {
    const btnText = analyzeBtn.querySelector('.btn-text');
    const loader = analyzeBtn.querySelector('.loader');
    
    analyzeBtn.disabled = loading;
    
    if (loading) {
        btnText.textContent = 'Analyzing...';
        loader.style.display = 'inline-block';
    } else {
        btnText.textContent = 'Analyze Risk';
        loader.style.display = 'none';
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    errorDiv.style.display = 'none';
}

function hideResults() {
    resultsSection.style.display = 'none';
}

function handleClear() {
    userPrompt.value = '';
    hideResults();
    hideError();
    userPrompt.focus();
}

// Example prompts for quick testing (you can remove this in production)
const examples = [
    "Check my flight AA123 tomorrow from JFK",
    "Is my United UA100 flight on November 10 looking risky?",
    "Analyze Delta DL456 from LAX on 2025-11-15"
];

// Log examples on load
console.log('Example prompts you can try:');
examples.forEach((ex, i) => console.log(`${i + 1}. ${ex}`));
