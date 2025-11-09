class ClearSkiesAPI {
    static async analyzeQuery(query) {
        try {
            // Try the real API first
            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'analyze_travel_risk',
                    arguments: { query }
                })
            });
            
            if (!response.ok) {
                // If API fails, use mock data for now
                console.log('API failed, using mock data');
                return this.getMockData(query);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('API Error:', error);
            // Fall back to mock data
            return this.getMockData(query);
        }
    }
    
    static getMockData(query) {
        // Temporary mock data so the results page works
        return {
            totalScore: Math.floor(Math.random() * 100),
            tier: 'Low Risk',
            weather: 'Clear skies',
            flightStatus: 'On time',
            tsa: '< 10 min',
            recommendations: [
                'Arrive 90 minutes before departure',
                'Check in online to save time',
                'Weather conditions are favorable'
            ]
        };
    }
}