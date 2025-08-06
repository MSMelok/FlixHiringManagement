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

        // Data erasure functionality
        document.getElementById('erase-data-btn')?.addEventListener('click', () => {
            this.initiateDataErasure();
        });

        document.getElementById('confirm-erase-btn')?.addEventListener('click', () => {
            this.confirmDataErasure();
        });

        // Initialize erasure state
        this.csvExported = false;
        this.updateEraseButtonState();
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
            
            // Mark CSV as exported and update erase button state
            this.csvExported = true;
            this.updateEraseButtonState();

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
            'sales_mock': 'Sales Mockup Calls',
            'slack_mock': 'Slack Mockup Calls',
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

    updateEraseButtonState() {
        const eraseBtn = document.getElementById('erase-data-btn');
        const csvIcon = document.getElementById('csv-requirement-icon');
        const csvText = document.getElementById('csv-requirement-text');
        
        if (eraseBtn && csvIcon && csvText) {
            if (this.csvExported) {
                eraseBtn.disabled = false;
                csvIcon.classList.add('fulfilled');
                csvText.textContent = 'CSV export completed ✓';
                csvText.style.color = 'var(--success-color)';
            } else {
                eraseBtn.disabled = true;
                csvIcon.classList.remove('fulfilled');
                csvText.textContent = 'CSV export must be completed first';
                csvText.style.color = 'var(--text-secondary)';
            }
        }
    }

    initiateDataErasure() {
        if (!this.csvExported) {
            window.hrDashboard.showToast('CSV export must be completed before data erasure', 'error');
            return;
        }

        // Clear form
        document.getElementById('super-admin-password').value = '';
        document.getElementById('confirmation-text').value = '';
        
        // Show modal
        window.hrDashboard.showModal('super-admin-modal');
    }

    async confirmDataErasure() {
        const password = document.getElementById('super-admin-password').value;
        const confirmation = document.getElementById('confirmation-text').value;

        // Validate inputs
        if (!password.trim()) {
            window.hrDashboard.showToast('Super admin password is required', 'error');
            return;
        }

        if (confirmation !== 'ERASE ALL DATA') {
            window.hrDashboard.showToast('Confirmation text must match exactly: "ERASE ALL DATA"', 'error');
            return;
        }

        // Check super admin password (using environment variable or hardcoded)
        const superAdminPassword = 'MSM_1053'; // In production, this should come from environment variables
        
        if (password !== superAdminPassword) {
            window.hrDashboard.showToast('Invalid super admin password', 'error');
            return;
        }

        try {
            window.hrDashboard.showToast('Erasing all data...', 'error');

            // Delete all stage history first (due to foreign key constraints)
            const { error: historyError } = await this.supabase
                .from('stage_history')
                .delete()
                .neq('id', 0); // Delete all records

            if (historyError) throw historyError;

            // Delete all recent activity if table exists
            try {
                const { error: activityError } = await this.supabase
                    .from('recent_activity')
                    .delete()
                    .neq('id', 0); // Delete all records

                // Ignore error if table doesn't exist
                if (activityError && !activityError.message.includes('does not exist')) {
                    throw activityError;
                }
            } catch (e) {
                // Table might not exist, continue
                console.warn('Recent activity table might not exist:', e);
            }

            // Delete all applicants
            const { error: applicantsError } = await this.supabase
                .from('applicants')
                .delete()
                .neq('id', 0); // Delete all records

            if (applicantsError) throw applicantsError;

            // Close modal
            window.hrDashboard.closeModal('super-admin-modal');

            // Show success message
            window.hrDashboard.showToast('All data has been permanently erased', 'success');

            // Reset CSV exported state
            this.csvExported = false;
            this.updateEraseButtonState();

            // Refresh dashboard and applicants data
            if (window.dashboardManager) {
                await window.dashboardManager.loadData();
            }
            if (window.applicantsManager) {
                await window.applicantsManager.loadData();
            }

            // Navigate to dashboard
            if (window.hrDashboard) {
                window.hrDashboard.showPage('dashboard');
            }

        } catch (error) {
            console.error('Data erasure error:', error);
            window.hrDashboard.showToast('Failed to erase data: ' + error.message, 'error');
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
