document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-button');
    const newQueryButton = document.getElementById('new-query');
    
    // Back to landing
    if (backButton) {
        backButton.addEventListener('click', function() {
            Navigation.showPage('landing-view');
        });
    }
    
    // New query
    if (newQueryButton) {
        newQueryButton.addEventListener('click', function() {
            Navigation.showPage('landing-view');
            document.getElementById('landing-input').value = '';
        });
    }
    
    // Handle results display
    window.addEventListener('resultsReady', function() {
        const results = JSON.parse(sessionStorage.getItem('analysisResults') || '{}');
        const query = sessionStorage.getItem('originalQuery') || '';
        
        // Update the display elements
        document.getElementById('risk-score').textContent = results.totalScore || 'N/A';
        document.getElementById('risk-tier').textContent = results.tier || 'Unknown';
        document.getElementById('weather-metric').textContent = results.weather || 'Clear';
        document.getElementById('flight-metric').textContent = results.flightStatus || 'On Time';
        document.getElementById('tsa-metric').textContent = results.tsa || '< 10 min';
        
        // Update recommendations
        const recommendations = document.getElementById('recommendations-list');
        if (results.recommendations && results.recommendations.length > 0) {
            const html = results.recommendations.map(rec => `<li>${rec}</li>`).join('');
            recommendations.innerHTML = `<ul>${html}</ul>`;
        } else {
            recommendations.innerHTML = '<p>No specific recommendations at this time.</p>';
        }
    });
});