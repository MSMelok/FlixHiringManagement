#!/usr/bin/env python3
"""
Simple HTTP server to serve the HR Recruitment Dashboard
This serves static files and runs on port 5000 for local development
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler to serve index.html for SPA routing"""
    
    def end_headers(self):
        # Add security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()
    
    def do_GET(self):
        # Parse the URL
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Remove leading slash and handle empty path
        if path == '/' or path == '':
            path = 'index.html'
        else:
            path = path.lstrip('/')
        
        # Security check - prevent directory traversal
        if '..' in path or path.startswith('/'):
            self.send_error(403, "Forbidden")
            return
        
        # Check if file exists
        if os.path.isfile(path):
            super().do_GET()
        else:
            # For SPA routing, serve index.html for unknown routes
            if not path.startswith('api/') and '.' not in os.path.basename(path):
                self.path = '/index.html'
                super().do_GET()
            else:
                self.send_error(404, "File not found")

def main():
    port = 5000
    
    # Check if port is available
    try:
        with socketserver.TCPServer(("", port), None) as test_server:
            pass
    except OSError:
        print(f"Port {port} is already in use. Please stop other services using this port.")
        sys.exit(1)
    
    # Start the server
    try:
        with socketserver.TCPServer(("0.0.0.0", port), CustomHTTPRequestHandler) as httpd:
            print(f"HR Recruitment Dashboard Server")
            print(f"Serving at http://localhost:{port}")
            print(f"Press Ctrl+C to stop the server")
            print()
            print("Setup Instructions:")
            print("1. Create a Supabase project at https://supabase.com")
            print("2. Run the schema.sql file in your Supabase SQL editor")
            print("3. Update the Supabase URL and anon key in script.js")
            print("4. Access the dashboard at http://localhost:5000")
            print()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
