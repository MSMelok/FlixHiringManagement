// Export manager
class ExportManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Export buttons
        document.getElementById('export-json-btn')?.addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('export-csv-btn')?.addEventListener('click', () => {
            this.exportCSV();
        });
    }

    async exportJSON() {
        try {
            window.hrDashboard.showToast('Preparing JSON export...', 'success');

            // Get all applicants with their stage history
            const { data: applicants, error: applicantsError } = await this.supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });

            if (applicantsError) throw applicantsError;

            // Get all stage history
            const { data: stageHistory, error: historyError } = await this.supabase
                .from('stage_history')
                .select('*')
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;

            // Combine applicants with their history
            const applicantsWithHistory = applicants.map(applicant => ({
                ...applicant,
                stage_history: stageHistory.filter(history => history.applicant_id === applicant.id)
            }));

            // Create export data
            const exportData = {
                exported_at: new Date().toISOString(),
                total_applicants: applicants.length,
                applicants: applicantsWithHistory
            };

            // Download JSON file
            this.downloadFile(
                JSON.stringify(exportData, null, 2),
                `hr-applicants-${this.formatDateForFilename()}.json`,
                'application/json'
            );

            window.hrDashboard.showToast('JSON export completed successfully', 'success');

        } catch (error) {
            console.error('JSON export error:', error);
            window.hrDashboard.showToast('Failed to export JSON data', 'error');
        }
    }

    async exportCSV() {
        try {
            window.hrDashboard.showToast('Preparing CSV export...', 'success');

            // Get all applicants
            const { data: applicants, error } = await this.supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Define CSV headers
            const headers = [
                'ID',
                'Full Name',
                'Email',
                'US Name',
                'Date of Birth',
                'Current Stage',
                'Interview Date',
                'Sales Mock Date',
                'Slack Mock Date',
                'Status',
                'Next Scheduled Date',
                'Notes',
                'Created At',
                'Updated At'
            ];

            // Convert applicants to CSV rows
            const rows = applicants.map(applicant => {
                const status = this.calculateStatus(applicant);
                const nextScheduled = this.getNextScheduledDate(applicant);

                return [
                    applicant.id,
                    this.escapeCsvField(applicant.full_name),
                    this.escapeCsvField(applicant.email),
                    this.escapeCsvField(applicant.us_name || ''),
                    applicant.dob || '',
                    this.escapeCsvField(this.formatStage(applicant.current_stage)),
                    applicant.interview_date || '',
                    applicant.sales_mock_date || '',
                    applicant.slack_mock_date || '',
                    status.toUpperCase(),
                    nextScheduled ? nextScheduled.toISOString() : '',
                    this.escapeCsvField(applicant.notes || ''),
                    applicant.created_at,
                    applicant.updated_at
                ];
            });

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Download CSV file
            this.downloadFile(
                csvContent,
                `hr-applicants-${this.formatDateForFilename()}.csv`,
                'text/csv'
            );

            window.hrDashboard.showToast('CSV export completed successfully', 'success');

        } catch (error) {
            console.error('CSV export error:', error);
            window.hrDashboard.showToast('Failed to export CSV data', 'error');
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        URL.revokeObjectURL(url);
    }

    escapeCsvField(field) {
        if (field === null || field === undefined) {
            return '';
        }
        
        const stringField = String(field);
        
        // If field contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return '"' + stringField.replace(/"/g, '""') + '"';
        }
        
        return stringField;
    }

    formatDateForFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}_${hours}-${minutes}`;
    }

    // Utility methods
    calculateStatus(applicant) {
        return window.hrDashboard.calculateStatus(applicant);
    }

    getNextScheduledDate(applicant) {
        return window.hrDashboard.getNextScheduledDate(applicant);
    }

    formatStage(stage) {
        const stages = {
            'challenge_email': 'Challenge Email',
            'equipment_email': 'Equipment Email',
            'first_interview': 'First Interview',
            'sales_mock': 'Sales Mockup',
            'slack_mock': 'Slack Mock Call',
            'hired': 'Hired',
            'rejected': 'Rejected'
        };
        
        return stages[stage] || stage;
    }

    // Method to export stage history as separate CSV
    async exportStageHistoryCSV() {
        try {
            window.hrDashboard.showToast('Preparing stage history export...', 'success');

            // Get all stage history with applicant names
            const { data: history, error } = await this.supabase
                .from('stage_history')
                .select(`
                    *,
                    applicants (
                        full_name,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Define CSV headers for stage history
            const headers = [
                'ID',
                'Applicant Name',
                'Applicant Email',
                'Stage',
                'Result',
                'Comment',
                'Created At'
            ];

            // Convert history to CSV rows
            const rows = history.map(entry => [
                entry.id,
                this.escapeCsvField(entry.applicants?.full_name || 'Unknown'),
                this.escapeCsvField(entry.applicants?.email || 'Unknown'),
                this.escapeCsvField(this.formatStage(entry.stage)),
                this.escapeCsvField(entry.result || ''),
                this.escapeCsvField(entry.comment || ''),
                entry.created_at
            ]);

            // Create CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Download CSV file
            this.downloadFile(
                csvContent,
                `hr-stage-history-${this.formatDateForFilename()}.csv`,
                'text/csv'
            );

            window.hrDashboard.showToast('Stage history export completed successfully', 'success');

        } catch (error) {
            console.error('Stage history export error:', error);
            window.hrDashboard.showToast('Failed to export stage history', 'error');
        }
    }
}

// Initialize export manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    // This will be initialized by the main app once Supabase is ready
    window.exportManager = null;
});

// Export for use in other modules
window.ExportManager = ExportManager;
