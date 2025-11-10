// Landing page functionality
document.addEventListener('DOMContentLoaded', function() {
    const landingInput = document.getElementById('landing-input');
    const landingSubmit = document.getElementById('landing-submit');
    const ctaSubmit = document.getElementById('cta-submit');
    const toggleAdvanced = document.getElementById('toggle-advanced');
    const advancedInputs = document.getElementById('advanced-inputs');
    const toggleText = document.getElementById('toggle-text');
    
    // Advanced input fields
    const flightNumber = document.getElementById('flight-number');
    const flightDate = document.getElementById('flight-date');
    const departureAirport = document.getElementById('departure-airport');
    const arrivalAirport = document.getElementById('arrival-airport');
    
    // Set default date to tomorrow
    if (flightDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        flightDate.valueAsDate = tomorrow;
    }
    
    // Toggle advanced inputs
    let advancedVisible = false;
    if (toggleAdvanced) {
        toggleAdvanced.addEventListener('click', function() {
            advancedVisible = !advancedVisible;
            if (advancedVisible) {
                advancedInputs.style.display = 'block';
                toggleText.textContent = '− Hide Specific Details';
            } else {
                advancedInputs.style.display = 'none';
                toggleText.textContent = '+ Add Specific Details';
            }
        });
    }
    
    // Auto-uppercase airport codes
    [departureAirport, arrivalAirport].forEach(input => {
        if (input) {
            input.addEventListener('input', function(e) {
                e.target.value = e.target.value.toUpperCase();
            });
        }
    });
    
    // Handle main search
    if (landingSubmit) {
        landingSubmit.addEventListener('click', handleSearch);
    }
    
    // Handle CTA search
    if (ctaSubmit) {
        ctaSubmit.addEventListener('click', function() {
            // Scroll to main input
            landingInput.scrollIntoView({ behavior: 'smooth' });
            landingInput.focus();
        });
    }
    
    // Handle Enter key
    if (landingInput) {
        landingInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
    }
    
    async function handleSearch() {
        let query = landingInput.value.trim();
        
        // Check if user filled out advanced inputs
        const hasAdvancedInput = flightNumber.value || departureAirport.value || arrivalAirport.value;
        
        if (!query && !hasAdvancedInput) {
            alert('Please enter your flight information');
            landingInput.focus();
            return;
        }
        
        // Build query from advanced inputs if provided
        if (hasAdvancedInput) {
            const parts = [];
            if (flightNumber.value) parts.push(flightNumber.value);
            if (flightDate.value) {
                const date = new Date(flightDate.value);
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                if (date.toDateString() === today.toDateString()) {
                    parts.push('today');
                } else if (date.toDateString() === tomorrow.toDateString()) {
                    parts.push('tomorrow');
                } else {
                    parts.push('on ' + flightDate.value);
                }
            }
            if (departureAirport.value) parts.push('from ' + departureAirport.value);
            if (arrivalAirport.value) parts.push('to ' + arrivalAirport.value);
            
            query = parts.join(' ');
        }
        
        console.log('Query being sent:', query);
        
        // Show loading and switch to results
        Navigation.showLoading();
        
        try {
            // Call your existing API
            const analysis = await ClearSkiesAPI.analyzeQuery(query);
            
            // Store results for results page
            sessionStorage.setItem('analysisResults', JSON.stringify(analysis));
            sessionStorage.setItem('originalQuery', query);
            
            // Switch to results page
            Navigation.hideLoading();
            Navigation.showPage('results-view');
            
            // Trigger results display
            window.dispatchEvent(new Event('resultsReady'));
            
        } catch (error) {
            Navigation.hideLoading();
            alert('Analysis failed. Please try again.');
            console.error(error);
        }
    }
    
    // Smooth scrolling for nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});