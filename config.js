// Supabase Configuration
// IMPORTANT: Replace these with your actual Supabase project credentials
const SUPABASE_CONFIG = {
    url: 'https://mcyppxpnkbonjvbojtaj.supabase.co', // Replace with your project URL from Supabase dashboard
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jeXBweHBua2Jvbmp2Ym9qdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzE5MTksImV4cCI6MjA2OTkwNzkxOX0.3_jrKVB3aFGa8QD5QvfGEK1l2Exe8qu6gYe7AzJ1tqE' // Replace with your anon public key from Supabase dashboard
};

// Stage configurations
const STAGES = {
    challenge_email: 'Challenge Email',
    equipment_email: 'Equipment Email',
    first_interview: 'First Interview',
    sales_mock: 'Sales Mock',
    slack_mock: 'Slack Mock',
    hired: 'Hired',
    rejected: 'Rejected'
};

const RESULTS = {
    Passed: 'Passed',
    Failed: 'Failed',
    Redo: 'Redo',
    Fit: 'Fit',
    NoFit: 'NoFit'
};

// Status thresholds (in days)
const STATUS_CONFIG = {
    STALLED_DAYS: 5,
    DUE_THRESHOLD_DAYS: 1
};
