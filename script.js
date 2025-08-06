// Main application controller
class HRDashboard {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.supabase = null;
        this.init();
    }

    async init() {
        try {
            console.log('Initializing HR Dashboard...');
            
            // Initialize Supabase client using configuration
            const config = window.SUPABASE_CONFIG;
            console.log('Supabase config loaded:', config ? 'Yes' : 'No');
            
            if (!config || !config.url || !config.anonKey) {
                this.showError('Supabase configuration not found. Please update config.js with your project details.');
                return;
            }
            
            // Validate configuration
            if (config.url.includes('your-project-id') || config.anonKey.includes('your-anon-key-here')) {
                this.showError('Please update config.js with your actual Supabase project URL and API key.');
                return;
            }
            
            console.log('Creating Supabase client...');
            this.supabase = supabase.createClient(config.url, config.anonKey);
            console.log('Supabase client created successfully');

            // Initialize managers
            console.log('Initializing managers...');
            this.initializeManagers();
            
            // Initialize authentication
            console.log('Initializing authentication...');
            await this.initAuth();
            
            // Setup event listeners
            console.log('Setting up event listeners...');
            this.setupEventListeners();
            
            // Hide loading spinner
            console.log('Hiding loading spinner...');
            this.hideLoading();
            
            console.log('HR Dashboard initialization complete');
        } catch (error) {
            console.error('Failed to initialize HR Dashboard:', error);
            this.showError('Failed to initialize application: ' + error.message);
            this.hideLoading();
        }
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
        // Check if manager classes are available
        const missingClasses = [];
        if (typeof AuthManager === 'undefined') missingClasses.push('AuthManager');
        if (typeof DashboardManager === 'undefined') missingClasses.push('DashboardManager');
        if (typeof ApplicantsManager === 'undefined') missingClasses.push('ApplicantsManager');
        if (typeof ExportManager === 'undefined') missingClasses.push('ExportManager');
        
        if (missingClasses.length > 0) {
            throw new Error(`Manager classes not loaded: ${missingClasses.join(', ')}`);
        }
        
        // Initialize all manager classes with Supabase client
        window.authManager = new AuthManager(this.supabase);
        window.dashboardManager = new DashboardManager(this.supabase);
        window.applicantsManager = new ApplicantsManager(this.supabase);
        window.exportManager = new ExportManager(this.supabase);
        
        console.log('All managers initialized successfully');
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

        // Auto-expand/collapse sidebar functionality  
        this.setupAutoSidebar();
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
        // Convert UTC to Central Time for display
        return date.toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' ' + date.toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: '2-digit', 
            minute: '2-digit'
        }) + ' CT';
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

        // Only check dates relevant to current stage to avoid false alarms after stage advancement
        const currentStage = applicant.current_stage;
        let relevantDate = null;
        
        // Map stages to their relevant date fields
        if (currentStage === 'first_interview' && applicant.interview_date) {
            relevantDate = applicant.interview_date;
        } else if (currentStage === 'sales_mock' && applicant.sales_mock_date) {
            relevantDate = applicant.sales_mock_date;
        } else if (currentStage === 'slack_mock' && applicant.slack_mock_date) {
            relevantDate = applicant.slack_mock_date;
        }

        // If no relevant date for current stage, return OK
        if (!relevantDate) {
            return 'ok';
        }

        // Parse the relevant date
        let scheduledDate = new Date(relevantDate);
        if (!relevantDate.includes('T')) {
            scheduledDate = new Date(relevantDate + 'T00:00:00Z');
        }

        const minutesDiff = (scheduledDate - now) / (1000 * 60);

        // Status logic:
        // - Overdue: scheduled date was 10+ minutes ago
        // - Due: scheduled date is within next 6 hours
        // - Upcoming: scheduled date is within next 12 hours (but not in next 6 hours)
        // - OK: everything else
        if (minutesDiff < -10) {
            return 'overdue';
        } else if (minutesDiff <= 360) { // 6 hours = 360 minutes
            return 'due';
        } else if (minutesDiff <= 720) { // 12 hours = 720 minutes
            return 'upcoming';
        } else {
            return 'ok';
        }
    }

    getNextScheduledDate(applicant) {
        const scheduledDates = [];
        
        // Add scheduled dates if they exist, properly parsing them
        if (applicant.interview_date) {
            let date = new Date(applicant.interview_date);
            // If date doesn't contain timezone info, treat as UTC
            if (!applicant.interview_date.includes('T')) {
                date = new Date(applicant.interview_date + 'T00:00:00Z');
            }
            scheduledDates.push(date);
        }
        
        if (applicant.sales_mock_date) {
            let date = new Date(applicant.sales_mock_date);
            if (!applicant.sales_mock_date.includes('T')) {
                date = new Date(applicant.sales_mock_date + 'T00:00:00Z');
            }
            scheduledDates.push(date);
        }
        
        if (applicant.slack_mock_date) {
            let date = new Date(applicant.slack_mock_date);
            if (!applicant.slack_mock_date.includes('T')) {
                date = new Date(applicant.slack_mock_date + 'T00:00:00Z');
            }
            scheduledDates.push(date);
        }

        if (scheduledDates.length === 0) {
            return null;
        }

        return new Date(Math.min(...scheduledDates));
    }

    setupAutoSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainApp = document.querySelector('.main-app');
        let hoverTimer = null;
        let isCollapsed = true;

        if (!sidebar || !mainApp) return;

        // Initial collapse
        this.collapseSidebar();

        sidebar.addEventListener('mouseenter', () => {
            if (isCollapsed) {
                hoverTimer = setTimeout(() => {
                    this.expandSidebar();
                    isCollapsed = false;
                }, 500); // 0.5 seconds hover delay as requested
            }
        });

        sidebar.addEventListener('mouseleave', () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
            if (!isCollapsed) {
                this.collapseSidebar();
                isCollapsed = true;
            }
        });

        // Store collapse state for internal tracking
        this.sidebarCollapsed = true;
    }

    collapseSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainApp = document.querySelector('.main-app');
        
        if (sidebar && mainApp) {
            sidebar.classList.add('collapsed');
            mainApp.classList.add('sidebar-collapsed');
            this.sidebarCollapsed = true;
        }
    }

    expandSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const mainApp = document.querySelector('.main-app');
        
        if (sidebar && mainApp) {
            sidebar.classList.remove('collapsed');
            mainApp.classList.remove('sidebar-collapsed');
            this.sidebarCollapsed = false;
        }
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

// Global utility function for consistent Central Time formatting
window.formatCentralTime = (dateString, options = {}) => {
    if (!dateString) return options.defaultText || 'N/A';
    
    // Parse UTC timestamp from Supabase properly
    const utcDate = new Date(dateString);
    const formatOptions = {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options.dateOptions
    };
    
    if (options.includeTime !== false) {
        return utcDate.toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            month: formatOptions.month,
            day: formatOptions.day,
            year: formatOptions.year
        }) + ' ' + utcDate.toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: formatOptions.hour,
            minute: formatOptions.minute
        }) + ' CT';
    } else {
        return utcDate.toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            month: formatOptions.month,
            day: formatOptions.day,
            year: formatOptions.year
        }) + ' (CT)';
    }
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
