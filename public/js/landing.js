// Landing page functionality
document.addEventListener('DOMContentLoaded', function() {
    const landingInput = document.getElementById('landing-input');
    const landingSubmit = document.getElementById('landing-submit');
    const ctaSubmit = document.getElementById('cta-submit');
    
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
        const query = landingInput.value.trim();
        
        if (!query) {
            alert('Please enter your flight information');
            landingInput.focus();
            return;
        }
        
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