// Enhanced Results Page Logic
class ResultsDisplay {
    constructor() {
        this.loadingComplete = false;
    }

    async initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('query');
        
        if (!query) {
            this.showError('No query provided');
            return;
        }

        // Show what we're analyzing
        document.getElementById('analyzed-query').textContent = `Analysis for: ${query}`;
        
        try {
            // Get the analysis data
            const data = await ClearSkiesAPI.analyzeQuery(query);
            this.displayResults(data, query);
        } catch (error) {
            console.error('Error loading results:', error);
            this.showError('Failed to load analysis. Please try again.');
        }
    }

    displayResults(data, query) {
        // Update risk score with animation
        this.animateScore(data.totalScore);
        
        // Update risk tier
        const tierElement = document.getElementById('risk-tier');
        tierElement.textContent = data.tier;
        tierElement.className = `risk-tier ${this.getTierClass(data.tier)}`;

        // Update flight status
        this.updateFlightStatus(data.flightStatus);
        
        // Update weather
        this.updateWeather(data.weather);
        
        // Update TSA
        this.updateTSA(data.tsa);
        
        // Update recommendations
        this.updateRecommendations(data.recommendations);
        
        // Update insights
        this.updateInsights(data, query);
        
        this.loadingComplete = true;
    }

    animateScore(score) {
        const scoreElement = document.getElementById('total-score');
        const circle = scoreElement.closest('.score-circle');
        
        // Animate number counting up
        let current = 0;
        const increment = score / 30; // 30 frames of animation
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= score) {
                current = score;
                clearInterval(timer);
            }
            scoreElement.textContent = Math.floor(current);
        }, 50);
        
        // Update circle color based on score
        const color = this.getScoreColor(score);
        circle.style.background = `conic-gradient(from 0deg, ${color} ${score * 3.6}deg, #e2e8f0 0deg)`;
    }

    getScoreColor(score) {
        if (score <= 30) return '#68d391'; // Green (low risk)
        if (score <= 70) return '#f6e05e'; // Yellow (medium risk)
        return '#fc8181'; // Red (high risk)
    }

    getTierClass(tier) {
        const lowerTier = tier.toLowerCase();
        if (lowerTier.includes('low')) return 'low-risk';
        if (lowerTier.includes('medium')) return 'medium-risk';
        if (lowerTier.includes('high')) return 'high-risk';
        return '';
    }

    updateFlightStatus(status) {
        const statusElement = document.getElementById('flight-status');
        const indicator = document.getElementById('flight-indicator');
        const details = document.getElementById('flight-details');
        
        statusElement.textContent = status;
        details.textContent = this.getFlightDetails(status);
        
        // Update status dot color
        const dot = indicator.querySelector('.status-dot');
        if (status.toLowerCase().includes('delay') || status.toLowerCase().includes('cancel')) {
            dot.className = 'status-dot danger';
        } else if (status.toLowerCase().includes('time')) {
            dot.className = 'status-dot';
        } else {
            dot.className = 'status-dot warning';
        }
    }

    updateWeather(weather) {
        const mainElement = document.getElementById('weather-main');
        const detailsElement = document.getElementById('weather-details');
        
        mainElement.innerHTML = `<i class="${this.getWeatherIcon(weather)}"></i> ${weather}`;
        detailsElement.textContent = 'Current conditions at departure airport';
    }

    updateTSA(tsa) {
        const timeElement = document.getElementById('tsa-time');
        timeElement.textContent = tsa;
    }

    updateRecommendations(recommendations) {
        const container = document.getElementById('recommendations-list');
        
        if (!recommendations || recommendations.length === 0) {
            container.innerHTML = '<div class="no-recommendations">No specific recommendations available.</div>';
            return;
        }

        const icons = ['fa-clock', 'fa-info-circle', 'fa-exclamation-triangle', 'fa-check-circle'];
        
        container.innerHTML = recommendations.map((rec, index) => `
            <div class="recommendation-item">
                <i class="fas ${icons[index % icons.length]}"></i>
                <span>${rec}</span>
            </div>
        `).join('');
    }

    updateInsights(data, query) {
        const container = document.getElementById('insights-content');
        
        const insights = this.generateInsights(data, query);
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <i class="fas fa-arrow-right"></i>
                <span>${insight}</span>
            </div>
        `).join('');
    }

    generateInsights(data, query) {
        const insights = [];
        
        // Flight-specific insights
        if (query.match(/\b[A-Z]{2}\d+/)) {
            insights.push(`Flight ${query.match(/\b[A-Z]{2}\d+/)[0]} analysis complete`);
        }
        
        // Score-based insights
        if (data.totalScore <= 30) {
            insights.push('Low risk conditions detected');
        } else if (data.totalScore <= 70) {
            insights.push('Moderate disruption potential');
        } else {
            insights.push('High risk factors present');
        }
        
        // Weather insights
        if (data.weather.toLowerCase().includes('clear')) {
            insights.push('Favorable weather conditions');
        }
        
        return insights.length > 0 ? insights : ['Analysis data processed successfully'];
    }

    getFlightDetails(status) {
        if (status.toLowerCase().includes('time')) {
            return 'No delays currently reported';
        }
        if (status.toLowerCase().includes('delay')) {
            return 'Monitor for updates from airline';
        }
        return 'Check with airline for latest information';
    }

    getWeatherIcon(weather) {
        const w = weather.toLowerCase();
        if (w.includes('clear') || w.includes('sunny')) return 'fas fa-sun';
        if (w.includes('cloud')) return 'fas fa-cloud';
        if (w.includes('rain')) return 'fas fa-cloud-rain';
        if (w.includes('snow')) return 'fas fa-snowflake';
        if (w.includes('storm')) return 'fas fa-bolt';
        return 'fas fa-cloud-sun';
    }

    showError(message) {
        document.querySelector('.container').innerHTML = `
            <div class="error-container">
                <h2><i class="fas fa-exclamation-triangle"></i> Error</h2>
                <p>${message}</p>
                <a href="index.html" class="btn btn-primary">
                    <i class="fas fa-arrow-left"></i> Back to Search
                </a>
            </div>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const results = new ResultsDisplay();
    results.initialize();
});