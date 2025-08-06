// Configuration for the HR Recruitment Dashboard
// This file contains the Supabase configuration

// Supabase Configuration
// Replace these with your actual Supabase project credentials
window.SUPABASE_CONFIG = {
    url: 'https://qsmpbfvgtcwgshbkjixy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbXBiZnZndGN3Z3NoYmtqaXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTQzMzEsImV4cCI6MjA2OTk3MDMzMX0.pf1iwdgTbVfbryKK2F-10LhM_KlIwW0YS7hg-T94rjw'
};

// You can get these values from:
// 1. Go to your Supabase project dashboard
// 2. Click on "Settings" > "API"
// 3. Copy the "Project URL" and "anon/public" key
// 4. Replace the values above

// Optional: Advanced configuration
window.APP_CONFIG = {
    // Application settings
    appName: 'FlixAT HR Portal',
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