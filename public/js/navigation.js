// Page navigation system
class Navigation {
    static showPage(pageId) {
        document.querySelectorAll('.page-view').forEach(page => {
            page.classList.remove('active');
            page.classList.add('hidden');
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            targetPage.classList.add('active');
        }
    }
    
    static showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }
    
    static hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
}