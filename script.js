// Main application controller
class HRDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.supabase = null;
        this.init();
    }

    async init() {
        // Initialize Supabase client using configuration
        const config = window.SUPABASE_CONFIG;
        if (!config || !config.url || !config.anonKey) {
            this.showError('Supabase configuration not found. Please update config.js with your project details.');
            return;
        }
        
        // Validate configuration
        if (config.url.includes('your-project-id') || config.anonKey.includes('your-anon-key')) {
            this.showError('Please update config.js with your actual Supabase project URL and API key.');
            return;
        }
        
        this.supabase = supabase.createClient(config.url, config.anonKey);

        // Initialize managers
        this.initializeManagers();
        
        // Initialize authentication
        await this.initAuth();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Hide loading spinner
        this.hideLoading();
    }

    async initAuth() {
        try {
            // Check for existing session
            const { data: { session } } = await this.supabase.auth.getSession();
            
            if (session) {
                this.currentUser = session.user;
                this.showMainApp();
                await this.loadDashboardData();
            } else {
                this.showLoginScreen();
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    this.currentUser = session.user;
                    this.showMainApp();
                    this.loadDashboardData();
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.showLoginScreen();
                }
            });
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.showError('Failed to initialize authentication. Please check your Supabase configuration.');
        }
    }

    initializeManagers() {
        // Initialize all manager classes with Supabase client
        window.authManager = new AuthManager(this.supabase);
        window.dashboardManager = new DashboardManager(this.supabase);
        window.applicantsManager = new ApplicantsManager(this.supabase);
        window.exportManager = new ExportManager(this.supabase);
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => this.handleLogout(e));
        }

        // Navigation
        const navLinks = document.querySelectorAll('.nav-link[data-page]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Modal close buttons
        const modalCloses = document.querySelectorAll('.modal-close');
        modalCloses.forEach(close => {
            close.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });

        // Close modals when clicking outside
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        // Toast close
        const toastClose = document.querySelector('.toast-close');
        if (toastClose) {
            toastClose.addEventListener('click', () => this.hideToast());
        }

        // Character counter for comments
        const historyComment = document.getElementById('history-comment');
        if (historyComment) {
            historyComment.addEventListener('input', this.updateCharCounter);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.showToast('Successfully signed in!', 'success');
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Login failed. Please check your credentials.');
        }
    }

    async handleLogout(e) {
        e.preventDefault();
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            this.showToast('Successfully signed out!', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Failed to sign out. Please try again.');
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        const page = e.target.closest('.nav-link').dataset.page;
        this.switchPage(page);
    }

    switchPage(page) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`.nav-link[data-page="${page}"]`).classList.add('active');

        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Show selected page
        document.getElementById(`${page}-page`).classList.add('active');
        this.currentPage = page;

        // Load page-specific data
        this.loadPageData(page);
    }

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await window.dashboardManager.loadData();
                break;
            case 'applicants':
                await window.applicantsManager.loadData();
                break;
            case 'export':
                // Export page doesn't need initial data loading
                break;
        }
    }

    async loadDashboardData() {
        if (this.currentPage === 'dashboard') {
            await window.dashboardManager.loadData();
        }
    }

    showLoginScreen() {
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-spinner').classList.add('hidden');
    }

    showError(message) {
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        } else {
            this.showToast(message, 'error');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    hideToast() {
        const toast = document.getElementById('toast');
        toast.classList.remove('show');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    updateCharCounter(e) {
        const input = e.target;
        const counter = input.nextElementSibling;
        if (counter && counter.classList.contains('char-count')) {
            counter.textContent = `${input.value.length}/${input.maxLength}`;
        }
    }

    // Utility methods
    formatDate(dateString) {
        if (!dateString) return 'Not scheduled';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatStage(stage) {
        return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    calculateStatus(applicant) {
        const now = new Date();
        const updatedAt = new Date(applicant.updated_at);
        
        // Check if stalled (updated_at older than 5 days AND not hired/rejected)
        const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 5 && !['hired', 'rejected'].includes(applicant.current_stage)) {
            return 'stalled';
        }

        // Find next scheduled date
        const scheduledDates = [
            applicant.interview_date,
            applicant.sales_mock_date,
            applicant.slack_mock_date
        ].filter(date => date).map(date => new Date(date));

        if (scheduledDates.length === 0) {
            return 'ok';
        }

        const nextDate = new Date(Math.min(...scheduledDates));
        const hoursDiff = (nextDate - now) / (1000 * 60 * 60);

        if (hoursDiff < -24) {
            return 'overdue';
        } else if (hoursDiff < 12 && hoursDiff > -12) {
            return 'due';
        } else {
            return 'ok';
        }
    }

    getNextScheduledDate(applicant) {
        const scheduledDates = [
            applicant.interview_date,
            applicant.sales_mock_date,
            applicant.slack_mock_date
        ].filter(date => date).map(date => new Date(date));

        if (scheduledDates.length === 0) {
            return null;
        }

        return new Date(Math.min(...scheduledDates));
    }
}

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    window.hrDashboard = new HRDashboard();
});

// Utility function to sanitize HTML content
window.sanitizeHtml = (str) => {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (window.hrDashboard) {
        window.hrDashboard.showToast('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.hrDashboard) {
        window.hrDashboard.showToast('An error occurred while processing your request.', 'error');
    }
});
