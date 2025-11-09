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
        
        // Navigate to results page with query parameter
        window.location.href = `results.html?query=${encodeURIComponent(query)}`;
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