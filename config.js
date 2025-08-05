// Configuration for the HR Recruitment Dashboard
// This file contains the Supabase configuration

// Supabase Configuration
// Replace these values with your actual Supabase project details
window.SUPABASE_CONFIG = {
    url: 'https://your-project-id.supabase.co',
    anonKey: 'your-anon-key-here'
};

// You can get these values from:
// 1. Go to your Supabase project dashboard
// 2. Click on "Settings" > "API"
// 3. Copy the "Project URL" and "anon/public" key
// 4. Replace the values above

// Optional: Advanced configuration
window.APP_CONFIG = {
    // Application settings
    appName: 'HR Recruitment Dashboard',
    version: '2.0.0',
    
    // Feature flags
    features: {
        exportEnabled: true,
        advancedFiltering: true,
        bulkOperations: true,
        notifications: true
    },
    
    // UI settings
    ui: {
        theme: 'light',
        sidebarCollapsed: false,
        pageSize: 25,
        autoRefresh: false,
        autoRefreshInterval: 30000 // 30 seconds
    },
    
    // Recruitment pipeline settings
    pipeline: {
        stages: [
            'challenge_email',
            'equipment_email', 
            'first_interview',
            'sales_mock',
            'slack_mock',
            'hired',
            'rejected'
        ],
        
        // Time thresholds for status calculation (in hours)
        thresholds: {
            due: 12,
            overdue: 24,
            stalled: 120 // 5 days
        }
    },
    
    // Validation rules
    validation: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        maxCommentLength: 200,
        requiredFields: ['full_name', 'email', 'current_stage']
    }
};

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_CONFIG: window.SUPABASE_CONFIG, APP_CONFIG: window.APP_CONFIG };
}