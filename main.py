#!/usr/bin/env python3
"""
WSGI application for the HR Recruitment Dashboard
This serves the static frontend files for the Supabase-powered dashboard
"""

import os
from flask import Flask, send_from_directory, send_file, Response

app = Flask(__name__)

@app.route('/')
def index():
    """Serve the main dashboard page"""
    return send_file('index.html')

@app.route('/config.js')
def serve_config():
    """Serve the config.js file with environment variables injected"""
    # Get environment variables
    supabase_url = os.environ.get('SUPABASE_URL', 'your-project-url-here')
    supabase_anon_key = os.environ.get('SUPABASE_ANON_KEY', 'your-anon-key-here')
    
    # Generate the config.js file with actual values
    config_js = f'''// Configuration for the HR Recruitment Dashboard
// This file contains the Supabase configuration

// Supabase Configuration
window.SUPABASE_CONFIG = {{
    url: '{supabase_url}',
    anonKey: '{supabase_anon_key}'
}};

// Optional: Advanced configuration
window.APP_CONFIG = {{
    // Application settings
    appName: 'HR Recruitment Dashboard',
    version: '2.0.0',
    
    // Feature flags
    features: {{
        exportEnabled: true,
        advancedFiltering: true,
        bulkOperations: true,
        notifications: true
    }},
    
    // UI settings
    ui: {{
        theme: 'light',
        sidebarCollapsed: false,
        pageSize: 25,
        autoRefresh: false,
        autoRefreshInterval: 30000 // 30 seconds
    }},
    
    // Recruitment pipeline settings
    pipeline: {{
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
        thresholds: {{
            due: 12,
            overdue: 24,
            stalled: 120 // 5 days
        }}
    }},
    
    // Validation rules
    validation: {{
        email: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/,
        maxCommentLength: 200,
        requiredFields: ['full_name', 'email', 'current_stage']
    }}
}};

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ SUPABASE_CONFIG: window.SUPABASE_CONFIG, APP_CONFIG: window.APP_CONFIG }};
}}'''
    
    # Return the JavaScript file with proper content type
    return Response(config_js, mimetype='application/javascript')

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files (CSS, JS, etc.)"""
    # Security check to prevent directory traversal
    if '..' in filename or filename.startswith('/'):
        return "Forbidden", 403
    
    # Check if file exists
    if os.path.exists(filename):
        return send_file(filename)
    else:
        # For SPA routing, serve index.html for unknown routes that don't look like files
        if '.' not in os.path.basename(filename):
            return send_file('index.html')
        else:
            return "Not Found", 404

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://*.supabase.co; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self' https://*.supabase.co"
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)