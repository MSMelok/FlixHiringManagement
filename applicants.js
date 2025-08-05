// Applicants manager
class ApplicantsManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.applicants = [];
        this.currentApplicant = null;
        this.isEditing = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add applicant button
        document.getElementById('add-applicant-btn')?.addEventListener('click', () => {
            this.openAddModal();
        });

        // Edit modal buttons
        document.getElementById('save-applicant-btn')?.addEventListener('click', () => {
            this.saveApplicant();
        });

        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
            window.hrDashboard.closeModal('edit-modal');
        });

        document.getElementById('edit-applicant-btn')?.addEventListener('click', () => {
            this.switchToEditMode();
        });

        document.getElementById('delete-applicant-btn')?.addEventListener('click', () => {
            this.confirmDeleteApplicant();
        });

        // Stage change handler for conditional scheduling
        document.getElementById('current-stage')?.addEventListener('change', (e) => {
            this.handleStageChange(e.target.value);
        });

        // Add history entry button
        document.getElementById('add-history-btn')?.addEventListener('click', () => {
            this.addHistoryEntry();
        });

        // Character counter for history comment
        document.getElementById('history-comment')?.addEventListener('input', (e) => {
            this.updateCharCounter(e.target);
        });
    }

    async loadData() {
        try {
            const { data: applicants, error } = await this.supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.applicants = applicants || [];
            this.renderApplicantsTable();
        } catch (error) {
            console.error('Applicants load error:', error);
            window.hrDashboard.showToast('Failed to load applicants data', 'error');
        }
    }

    renderApplicantsTable() {
        const tbody = document.getElementById('applicants-tbody');
        const noApplicants = document.getElementById('no-applicants');
        
        if (!tbody) return;

        if (this.applicants.length === 0) {
            tbody.innerHTML = '';
            if (noApplicants) noApplicants.style.display = 'block';
            return;
        }

        if (noApplicants) noApplicants.style.display = 'none';

        tbody.innerHTML = this.applicants.map(applicant => {
            const status = this.calculateStatus(applicant);
            const nextScheduled = this.getNextScheduledDate(applicant);
            
            return `
                <tr class="${status}" data-id="${applicant.id}">
                    <td>${window.sanitizeHtml(applicant.full_name)}</td>
                    <td>${window.sanitizeHtml(applicant.email)}</td>
                    <td>${window.sanitizeHtml(applicant.us_name || 'N/A')}</td>
                    <td>
                        <span class="stage-badge ${applicant.current_stage}">
                            ${this.formatStage(applicant.current_stage)}
                        </span>
                    </td>
                    <td>${nextScheduled ? this.formatDateTime(nextScheduled) : 'Not scheduled'}</td>
                    <td>
                        <span class="status-badge ${status}">
                            ${status.toUpperCase()}
                        </span>
                    </td>
                    <td>${this.formatDateTime(applicant.updated_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.applicantsManager.viewApplicant(${applicant.id})">
                                <i class="bi bi-eye"></i>
                                View
                            </button>
                            <button class="action-btn edit" onclick="window.applicantsManager.editApplicant(${applicant.id})">
                                <i class="bi bi-pencil"></i>
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async viewApplicant(id) {
        try {
            const applicant = this.applicants.find(a => a.id === id);
            if (!applicant) throw new Error('Applicant not found');

            // Load stage history
            const { data: history, error } = await this.supabase
                .from('stage_history')
                .select('*')
                .eq('applicant_id', id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.currentApplicant = { ...applicant, history: history || [] };
            this.renderViewModal();
            window.hrDashboard.showModal('view-modal');
        } catch (error) {
            console.error('View applicant error:', error);
            window.hrDashboard.showToast('Failed to load applicant details', 'error');
        }
    }

    editApplicant(id) {
        const applicant = this.applicants.find(a => a.id === id);
        if (!applicant) {
            window.hrDashboard.showToast('Applicant not found', 'error');
            return;
        }

        this.currentApplicant = applicant;
        this.isEditing = true;
        this.renderEditModal();
        window.hrDashboard.showModal('edit-modal');
    }

    openAddModal() {
        this.currentApplicant = {
            full_name: '',
            email: '',
            us_name: '',
            dob: '',
            current_stage: 'challenge_email',
            interview_date: null,
            sales_mock_date: null,
            slack_mock_date: null,
            notes: ''
        };
        this.isEditing = false;
        this.renderEditModal();
        window.hrDashboard.showModal('edit-modal');
    }

    renderViewModal() {
        const modalBody = document.getElementById('view-modal-body');
        if (!modalBody || !this.currentApplicant) return;

        const applicant = this.currentApplicant;
        const nextScheduled = this.getNextScheduledDate(applicant);
        const status = this.calculateStatus(applicant);

        modalBody.innerHTML = `
            <div class="applicant-details">
                <div class="detail-section">
                    <h3>Personal Information</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Full Name</div>
                            <div class="detail-value">${window.sanitizeHtml(applicant.full_name)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Date of Birth</div>
                            <div class="detail-value">${applicant.dob ? new Date(applicant.dob).toLocaleDateString() : 'Not provided'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Email</div>
                            <div class="detail-value">${window.sanitizeHtml(applicant.email)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">US Name</div>
                            <div class="detail-value">${window.sanitizeHtml(applicant.us_name || 'Not provided')}</div>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Current Status</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Current Stage</div>
                            <div class="detail-value">
                                <span class="stage-badge ${applicant.current_stage}">
                                    ${this.formatStage(applicant.current_stage)}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Status</div>
                            <div class="detail-value">
                                <span class="status-badge ${status}">
                                    ${status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Next Scheduled</div>
                            <div class="detail-value">${nextScheduled ? this.formatDateTime(nextScheduled) : 'Not scheduled'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Last Updated</div>
                            <div class="detail-value">${this.formatDateTime(applicant.updated_at)}</div>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Scheduled Dates</h3>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Interview Date</div>
                            <div class="detail-value">${applicant.interview_date ? this.formatDateTime(applicant.interview_date) : 'Not scheduled'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Sales Mock Date</div>
                            <div class="detail-value">${applicant.sales_mock_date ? this.formatDateTime(applicant.sales_mock_date) : 'Not scheduled'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Slack Mock Date</div>
                            <div class="detail-value">${applicant.slack_mock_date ? this.formatDateTime(applicant.slack_mock_date) : 'Not scheduled'}</div>
                        </div>
                    </div>
                </div>

                ${applicant.notes ? `
                    <div class="detail-section">
                        <h3>Notes</h3>
                        <div class="detail-value">${window.sanitizeHtml(applicant.notes)}</div>
                    </div>
                ` : ''}

                ${applicant.history && applicant.history.length > 0 ? `
                    <div class="detail-section">
                        <h3>Stage History</h3>
                        <div class="timeline">
                            ${applicant.history.map(entry => `
                                <div class="timeline-item">
                                    <div class="timeline-header">
                                        <span class="timeline-stage">${this.formatStage(entry.stage)}</span>
                                        <span class="timeline-result ${entry.result}">${entry.result || 'pending'}</span>
                                    </div>
                                    ${entry.comment ? `<div class="timeline-comment">${window.sanitizeHtml(entry.comment)}</div>` : ''}
                                    <div class="timeline-date">${this.formatDateTime(entry.created_at)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderEditModal() {
        const form = document.getElementById('applicant-form');
        const modalTitle = document.getElementById('edit-modal-title');
        
        if (!form || !this.currentApplicant) return;

        modalTitle.textContent = this.isEditing ? 'Edit Applicant' : 'Add New Applicant';

        // Populate form fields
        document.getElementById('full-name').value = this.currentApplicant.full_name || '';
        document.getElementById('applicant-email').value = this.currentApplicant.email || '';
        document.getElementById('us-name').value = this.currentApplicant.us_name || '';
        document.getElementById('dob').value = this.currentApplicant.dob || '';
        document.getElementById('current-stage').value = this.currentApplicant.current_stage || 'challenge_email';
        document.getElementById('notes').value = this.currentApplicant.notes || '';

        // Handle scheduled dates with proper datetime-local format
        const interviewDate = this.currentApplicant.interview_date;
        const salesMockDate = this.currentApplicant.sales_mock_date;
        const slackMockDate = this.currentApplicant.slack_mock_date;

        document.getElementById('interview-date').value = interviewDate ? this.formatDateTimeLocal(interviewDate) : '';
        document.getElementById('sales-mock-date').value = salesMockDate ? this.formatDateTimeLocal(salesMockDate) : '';
        document.getElementById('slack-mock-date').value = slackMockDate ? this.formatDateTimeLocal(slackMockDate) : '';

        // Handle stage-based scheduling visibility
        this.handleStageChange(this.currentApplicant.current_stage);

        // Clear history form
        document.getElementById('history-stage').value = '';
        document.getElementById('history-result').value = '';
        document.getElementById('history-comment').value = '';
        this.updateCharCounter(document.getElementById('history-comment'));
    }

    handleStageChange(stage) {
        const interviewSchedule = document.getElementById('interview-schedule');
        const salesMockSchedule = document.getElementById('sales-mock-schedule');
        const slackMockSchedule = document.getElementById('slack-mock-schedule');

        // Show/hide scheduling fields based on stage progression rules
        if (interviewSchedule) {
            interviewSchedule.style.display = ['first_interview', 'sales_mock', 'slack_mock', 'hired'].includes(stage) ? 'block' : 'none';
        }
        
        if (salesMockSchedule) {
            salesMockSchedule.style.display = ['sales_mock', 'slack_mock', 'hired'].includes(stage) ? 'block' : 'none';
        }
        
        if (slackMockSchedule) {
            slackMockSchedule.style.display = ['slack_mock', 'hired'].includes(stage) ? 'block' : 'none';
        }
    }

    async saveApplicant() {
        try {
            const form = document.getElementById('applicant-form');
            const formData = new FormData(form);

            const applicantData = {
                full_name: formData.get('full_name'),
                email: formData.get('email'),
                us_name: formData.get('us_name') || null,
                dob: formData.get('dob') || null,
                current_stage: formData.get('current_stage'),
                interview_date: formData.get('interview_date') || null,
                sales_mock_date: formData.get('sales_mock_date') || null,
                slack_mock_date: formData.get('slack_mock_date') || null,
                notes: formData.get('notes') || null
            };

            // Validate required fields
            if (!applicantData.full_name || !applicantData.email) {
                window.hrDashboard.showToast('Please fill in all required fields', 'error');
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(applicantData.email)) {
                window.hrDashboard.showToast('Please enter a valid email address', 'error');
                return;
            }

            let result;
            if (this.isEditing) {
                // Update existing applicant
                const { data, error } = await this.supabase
                    .from('applicants')
                    .update(applicantData)
                    .eq('id', this.currentApplicant.id)
                    .select();

                if (error) throw error;
                result = data[0];
            } else {
                // Create new applicant
                const { data, error } = await this.supabase
                    .from('applicants')
                    .insert([applicantData])
                    .select();

                if (error) throw error;
                result = data[0];
            }

            // Reload data and close modal
            await this.loadData();
            window.hrDashboard.closeModal('edit-modal');
            window.hrDashboard.showToast(
                this.isEditing ? 'Applicant updated successfully' : 'Applicant added successfully',
                'success'
            );

        } catch (error) {
            console.error('Save applicant error:', error);
            if (error.message.includes('duplicate key')) {
                window.hrDashboard.showToast('An applicant with this email already exists', 'error');
            } else {
                window.hrDashboard.showToast('Failed to save applicant', 'error');
            }
        }
    }

    async addHistoryEntry() {
        try {
            const stage = document.getElementById('history-stage').value;
            const result = document.getElementById('history-result').value;
            const comment = document.getElementById('history-comment').value;

            if (!stage || !result) {
                window.hrDashboard.showToast('Please select both stage and result', 'error');
                return;
            }

            const historyData = {
                applicant_id: this.currentApplicant.id,
                stage,
                result,
                comment: comment.trim() || null
            };

            const { error } = await this.supabase
                .from('stage_history')
                .insert([historyData]);

            if (error) throw error;

            // Clear form
            document.getElementById('history-stage').value = '';
            document.getElementById('history-result').value = '';
            document.getElementById('history-comment').value = '';
            this.updateCharCounter(document.getElementById('history-comment'));

            window.hrDashboard.showToast('Stage history entry added successfully', 'success');

        } catch (error) {
            console.error('Add history entry error:', error);
            window.hrDashboard.showToast('Failed to add history entry', 'error');
        }
    }

    confirmDeleteApplicant() {
        if (!this.currentApplicant) return;

        const confirmModal = document.getElementById('confirm-modal');
        const confirmTitle = document.getElementById('confirm-title');
        const confirmMessage = document.getElementById('confirm-message');
        const confirmProceed = document.getElementById('confirm-proceed');

        confirmTitle.textContent = 'Delete Applicant';
        confirmMessage.textContent = `Are you sure you want to delete ${this.currentApplicant.full_name}? This action cannot be undone.`;

        // Remove any existing listeners
        const newProceedBtn = confirmProceed.cloneNode(true);
        confirmProceed.parentNode.replaceChild(newProceedBtn, confirmProceed);

        newProceedBtn.addEventListener('click', () => {
            this.deleteApplicant();
            window.hrDashboard.closeModal('confirm-modal');
        });

        window.hrDashboard.closeModal('view-modal');
        window.hrDashboard.showModal('confirm-modal');
    }

    async deleteApplicant() {
        try {
            const { error } = await this.supabase
                .from('applicants')
                .delete()
                .eq('id', this.currentApplicant.id);

            if (error) throw error;

            await this.loadData();
            window.hrDashboard.showToast('Applicant deleted successfully', 'success');

        } catch (error) {
            console.error('Delete applicant error:', error);
            window.hrDashboard.showToast('Failed to delete applicant', 'error');
        }
    }

    switchToEditMode() {
        window.hrDashboard.closeModal('view-modal');
        this.editApplicant(this.currentApplicant.id);
    }

    updateCharCounter(textarea) {
        const counter = textarea.nextElementSibling;
        if (counter && counter.classList.contains('char-count')) {
            counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
        }
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

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    formatDateTimeLocal(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    }
}

// Initialize applicants manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    // This will be initialized by the main app once Supabase is ready
    window.applicantsManager = null;
});

// Export for use in other modules
window.ApplicantsManager = ApplicantsManager;
