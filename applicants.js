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



        // Filter event listeners
        document.getElementById('sort-filter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('stage-filter')?.addEventListener('change', () => {
            this.applyFilters();
        });



        document.getElementById('referred-by-filter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('status-filter')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('date-filter-start')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('date-filter-end')?.addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('search-filter')?.addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Stage transition modal handlers
        document.getElementById('save-stage-transition-btn')?.addEventListener('click', () => {
            this.saveStageTransition();
        });

        document.getElementById('cancel-stage-transition-btn')?.addEventListener('click', () => {
            window.hrDashboard.closeModal('stage-transition-modal');
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
            this.allApplicants = [...this.applicants]; // Keep a copy of all applicants
            this.populateCountryFilter();
            this.populateReferredByFilter();
            this.applyFilters();
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
                    <td>${window.sanitizeHtml(applicant.country || 'N/A')}</td>
                    <td>${window.sanitizeHtml(applicant.referred_by || 'Direct')}</td>
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
                            <button class="action-btn view" onclick="window.applicantsManager.viewApplicant(${applicant.id})" title="View Details">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.applicantsManager.editApplicant(${applicant.id})" title="Edit Applicant">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="action-btn stage-move" onclick="window.applicantsManager.showStageTransitionModal(${applicant.id})" title="Move Stage">
                                <i class="bi bi-arrow-right-circle"></i>
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
            country: '',
            referred_by: '',
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
                        <div class="detail-item">
                            <div class="detail-label">Country</div>
                            <div class="detail-value">${window.sanitizeHtml(applicant.country || 'Not provided')}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Referred By</div>
                            <div class="detail-value">${window.sanitizeHtml(applicant.referred_by || 'Direct application')}</div>
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

                <div class="detail-section">
                    <h3>Stage History</h3>
                    ${applicant.history && applicant.history.length > 0 ? `
                        <div class="timeline">
                            ${applicant.history.map(entry => `
                                <div class="timeline-item">
                                    <div class="timeline-header">
                                        <span class="timeline-stage">${this.formatStage(entry.stage)}</span>
                                        <span class="timeline-date">${this.formatDateTime(entry.created_at)}</span>
                                    </div>
                                    ${entry.result ? `<div class="timeline-result">Result: <span class="result-${entry.result}">${entry.result.toUpperCase()}</span></div>` : ''}
                                    ${entry.comment ? `<div class="timeline-comment">${window.sanitizeHtml(entry.comment)}</div>` : ''}
                                    ${entry.user_email ? `<div class="timeline-user">by ${window.sanitizeHtml(entry.user_email)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <p>No stage history available</p>
                        </div>
                    `}
                </div>
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
        document.getElementById('country').value = this.currentApplicant.country || '';
        document.getElementById('referred-by').value = this.currentApplicant.referred_by || '';
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

            // Collect data from form
            const applicantData = {
                full_name: formData.get('full_name'),
                email: formData.get('email'),
                us_name: formData.get('us_name') || null,
                dob: formData.get('dob') || null,
                country: formData.get('country') || null,
                referred_by: formData.get('referred_by') || null,
                current_stage: formData.get('current_stage'),
                notes: formData.get('notes') || null
            };

            // Convert datetime-local values from Central Time to UTC for storage
            if (formData.get('interview_date')) {
                applicantData.interview_date = this.convertLocalToUTC(formData.get('interview_date'));
            } else {
                applicantData.interview_date = null;
            }
            if (formData.get('sales_mock_date')) {
                applicantData.sales_mock_date = this.convertLocalToUTC(formData.get('sales_mock_date'));
            } else {
                applicantData.sales_mock_date = null;
            }
            if (formData.get('slack_mock_date')) {
                applicantData.slack_mock_date = this.convertLocalToUTC(formData.get('slack_mock_date'));
            } else {
                applicantData.slack_mock_date = null;
            }


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

            // Check for stage change in editing mode
            const stageChanged = this.isEditing && this.currentApplicant.current_stage !== applicantData.current_stage;
            const oldStage = this.isEditing ? this.currentApplicant.current_stage : null;

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

                // Automatically create stage history entry if stage changed
                if (stageChanged) {
                    await this.createAutomaticHistoryEntry(this.currentApplicant.id, oldStage, applicantData.current_stage);
                }
            } else {
                // Create new applicant
                const { data, error } = await this.supabase
                    .from('applicants')
                    .insert([applicantData])
                    .select();

                if (error) throw error;
                result = data[0];

                // Create initial stage history entry for new applicants
                await this.createAutomaticHistoryEntry(result.id, null, applicantData.current_stage, true);
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



    async createAutomaticHistoryEntry(applicantId, oldStage, newStage, isNewApplicant = false) {
        try {
            // Get current user information
            const currentUser = window.hrDashboard.currentUser;
            const userName = currentUser?.email || 'System';

            let comment;
            if (isNewApplicant) {
                comment = `Applicant created with initial stage by ${userName}`;
            } else {
                // Determine if moving forward or backward
                const stageOrder = ['challenge_email', 'equipment_email', 'first_interview', 'sales_mock', 'slack_mock', 'hired'];
                const oldIndex = stageOrder.indexOf(oldStage);
                const newIndex = stageOrder.indexOf(newStage);

                if (newStage === 'rejected') {
                    comment = `Moved to ${this.formatStage(newStage)} by ${userName}`;
                } else if (newIndex > oldIndex) {
                    comment = `Moved to ${this.formatStage(newStage)} by ${userName}`;
                } else if (newIndex < oldIndex) {
                    comment = `Back to ${this.formatStage(newStage)} by ${userName}`;
                } else {
                    comment = `Stage changed to ${this.formatStage(newStage)} by ${userName}`;
                }
            }

            const historyData = {
                applicant_id: applicantId,
                stage: newStage,
                result: null,
                comment: comment,
                user_email: userName
            };

            const { error } = await this.supabase
                .from('stage_history')
                .insert([historyData]);

            if (error) throw error;

            console.log('Automatic stage history entry created successfully');

        } catch (error) {
            console.error('Create automatic history entry error:', error);
            // Don't show toast error for automatic entries to avoid user confusion
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

    // Stage transition functionality
    async showStageTransitionModal(id) {
        try {
            const applicant = this.applicants.find(a => a.id === id);
            if (!applicant) throw new Error('Applicant not found');

            this.currentApplicant = applicant;
            this.renderStageTransitionModal();
            window.hrDashboard.showModal('stage-transition-modal');
        } catch (error) {
            console.error('Show stage transition modal error:', error);
            window.hrDashboard.showToast('Failed to open stage transition', 'error');
        }
    }

    renderStageTransitionModal() {
        const modalBody = document.getElementById('stage-transition-modal-body');
        if (!modalBody || !this.currentApplicant) return;

        const applicant = this.currentApplicant;
        const stages = [
            'challenge_email',
            'equipment_email',
            'first_interview',
            'sales_mock',
            'slack_mock',
            'hired',
            'rejected'
        ];

        const currentStageIndex = stages.indexOf(applicant.current_stage);
        const nextStage = stages[currentStageIndex + 1];
        const prevStage = stages[currentStageIndex - 1];

        modalBody.innerHTML = `
            <div class="stage-transition-content">
                <div class="current-stage-section">
                    <div class="current-stage-header">
                        <h3><i class="bi bi-person-badge"></i> ${window.sanitizeHtml(applicant.full_name)}</h3>
                        <div class="current-stage-info">
                            <span class="stage-badge ${applicant.current_stage}">
                                ${this.formatStage(applicant.current_stage)}
                            </span>
                            <span class="status-badge ${this.calculateStatus(applicant)}">
                                ${this.calculateStatus(applicant).toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="stage-actions-grid">
                    <div class="action-category quick-actions">
                        <h4><i class="bi bi-lightning"></i> Quick Actions</h4>
                        <div class="action-buttons-grid">
                            ${nextStage && nextStage !== 'rejected' ? `
                                <button class="action-btn advance" data-stage="${nextStage}" data-result="passed">
                                    <i class="bi bi-arrow-right-circle"></i>
                                    <div class="btn-content">
                                        <span class="btn-title">Advance</span>
                                        <span class="btn-subtitle">to ${this.formatStage(nextStage)}</span>
                                    </div>
                                </button>
                            ` : ''}

                            ${prevStage ? `
                                <button class="action-btn retreat" data-stage="${prevStage}" data-result="pending">
                                    <i class="bi bi-arrow-left-circle"></i>
                                    <div class="btn-content">
                                        <span class="btn-title">Return</span>
                                        <span class="btn-subtitle">to ${this.formatStage(prevStage)}</span>
                                    </div>
                                </button>
                            ` : ''}

                            <button class="action-btn reject" data-stage="rejected" data-result="failed">
                                <i class="bi bi-x-circle"></i>
                                <div class="btn-content">
                                    <span class="btn-title">Reject</span>
                                    <span class="btn-subtitle">Mark as Failed</span>
                                </div>
                            </button>

                            ${applicant.current_stage !== 'hired' ? `
                                <button class="action-btn hire" data-stage="hired" data-result="passed">
                                    <i class="bi bi-check-circle"></i>
                                    <div class="btn-content">
                                        <span class="btn-title">Hire</span>
                                        <span class="btn-subtitle">Fast-track Hire</span>
                                    </div>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="action-category custom-selection">
                        <h4><i class="bi bi-gear"></i> Custom Selection</h4>
                        <div class="custom-stage-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="custom-target-stage">Target Stage:</label>
                                    <select id="custom-target-stage" class="form-control">
                                        <option value="">Select Stage...</option>
                                        ${stages.filter(s => s !== applicant.current_stage).map(stage => `
                                            <option value="${stage}">${this.formatStage(stage)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="custom-result">Result:</label>
                                    <select id="custom-result" class="form-control">
                                        <option value="passed">Passed</option>
                                        <option value="failed">Failed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                            </div>
                            <button class="action-btn custom" id="apply-custom-selection">
                                <i class="bi bi-arrow-right"></i>
                                Apply Custom Selection
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Date Input Section (Initially Hidden) -->
                <div class="date-input-section" id="date-input-section" style="display: none;">
                    <h4><i class="bi bi-calendar3"></i> Schedule Date</h4>
                    <p class="date-help-text">This stage requires a scheduled date:</p>
                    <div class="form-group">
                        <label for="stage-date-input">Date & Time:</label>
                        <input type="datetime-local" id="stage-date-input" class="form-control">
                        <small class="text-muted">All times are in Central Time (CT)</small>
                    </div>
                </div>

                <!-- Comment Section -->
                <div class="comment-section">
                    <div class="form-group">
                        <label for="transition-comment"><i class="bi bi-chat-text"></i> Comment (optional):</label>
                        <textarea id="transition-comment" class="form-control" rows="3" maxlength="200" placeholder="Add a comment about this stage transition..."></textarea>
                        <div class="char-counter">0/200</div>
                    </div>
                </div>

                <!-- Hidden inputs for form state -->
                <input type="hidden" id="selected-stage" value="" />
                <input type="hidden" id="selected-result" value="" />
                <input type="hidden" id="selected-date-field" value="" />
            </div>
        `;

        // Add event listeners after rendering
        this.setupStageTransitionEventListeners();
    }

    setupStageTransitionEventListeners() {
        // Quick action buttons
        document.querySelectorAll('.action-btn:not(.custom)').forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const stage = button.getAttribute('data-stage');
                const result = button.getAttribute('data-result');
                if (stage && result) {
                    this.selectStageTransition(stage, result, button);
                }
            });
        });

        // Custom selection button
        const customBtn = document.getElementById('apply-custom-selection');
        if (customBtn) {
            customBtn.addEventListener('click', (event) => {
                event.preventDefault();
                const stage = document.getElementById('custom-target-stage').value;
                const result = document.getElementById('custom-result').value;
                if (stage && result) {
                    this.selectStageTransition(stage, result, customBtn);
                }
            });
        }

        // Character counter for comment
        const commentTextarea = document.getElementById('transition-comment');
        if (commentTextarea) {
            commentTextarea.addEventListener('input', (event) => {
                const counter = document.querySelector('.char-counter');
                if (counter) {
                    counter.textContent = `${event.target.value.length}/200`;
                }
            });
        }
    }

    selectStageTransition(targetStage, result, buttonElement) {
        // Set selected values
        document.getElementById('selected-stage').value = targetStage;
        document.getElementById('selected-result').value = result;

        // Check if target stage requires a date
        const stagesRequiringDates = {
            'first_interview': 'interview_date',
            'sales_mock': 'sales_mock_date',
            'slack_mock': 'slack_mock_date'
        };

        const dateInputSection = document.getElementById('date-input-section');
        const dateInput = document.getElementById('stage-date-input');
        const selectedDateField = document.getElementById('selected-date-field');

        if (stagesRequiringDates[targetStage]) {
            // Show date input section
            dateInputSection.style.display = 'block';
            selectedDateField.value = stagesRequiringDates[targetStage];

            // Set current date value if exists
            const currentDate = this.currentApplicant[stagesRequiringDates[targetStage]];
            if (currentDate) {
                dateInput.value = this.formatDateTimeLocal(currentDate);
            }

            // Update help text
            const helpText = dateInputSection.querySelector('.date-help-text');
            helpText.textContent = `${this.formatStage(targetStage)} requires a scheduled date:`;
        } else {
            // Hide date input section
            dateInputSection.style.display = 'none';
            selectedDateField.value = '';
        }

        // Update UI to show selection
        document.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('selected'));
        if (buttonElement) {
            buttonElement.classList.add('selected');
        }
    }

    // This method is now handled by setupStageTransitionEventListeners

    async saveStageTransition() {
        try {
            const targetStage = document.getElementById('selected-stage').value;
            const result = document.getElementById('selected-result').value;
            const comment = document.getElementById('transition-comment').value.trim();
            const selectedDateField = document.getElementById('selected-date-field').value;
            const stageDate = document.getElementById('stage-date-input').value;

            if (!targetStage) {
                window.hrDashboard.showToast('Please select a target stage', 'error');
                return;
            }

            // Check if date is required for this stage
            if (selectedDateField && !stageDate) {
                window.hrDashboard.showToast('Please enter a date for this stage', 'error');
                return;
            }

            const applicant = this.currentApplicant;
            const previousStage = applicant.current_stage;
            const userFingerprint = await this.getUserFingerprint();
            const currentUser = window.hrDashboard.currentUser;

            // Prepare update data
            const updateData = {
                current_stage: targetStage,
                fingerprint: userFingerprint
            };

            // Add date field if specified
            if (selectedDateField && stageDate) {
                // Convert local datetime from Central Time to UTC for database storage
                updateData[selectedDateField] = this.convertLocalToUTC(stageDate);
            }

            // Update applicant stage
            const { error: updateError } = await this.supabase
                .from('applicants')
                .update(updateData)
                .eq('id', applicant.id);

            if (updateError) throw updateError;

            // Create stage history entry (only include columns that exist)
            const frontendTimestamp = new Date().toISOString();
            const historyData = {
                applicant_id: applicant.id,
                stage: targetStage,
                result: result,
                comment: comment || `Stage transition: ${this.formatStage(previousStage)} → ${this.formatStage(targetStage)}`,
                created_at: frontendTimestamp
            };

            // Add optional columns if they exist in the database
            try {
                // Check if user_email column exists
                const { error: testError } = await this.supabase
                    .from('stage_history')
                    .select('user_email')
                    .limit(1);

                if (!testError) {
                    historyData.user_email = currentUser?.email || 'Unknown User';
                }
            } catch (e) {
                // Column doesn't exist, continue without it
            }

            try {
                // Check if user_fingerprint column exists
                const { error: testError2 } = await this.supabase
                    .from('stage_history')
                    .select('user_fingerprint')
                    .limit(1);

                if (!testError2) {
                    historyData.user_fingerprint = userFingerprint;
                }
            } catch (e) {
                // Column doesn't exist, continue without it
            }

            try {
                // Check if previous_stage column exists
                const { error: testError3 } = await this.supabase
                    .from('stage_history')
                    .select('previous_stage')
                    .limit(1);

                if (!testError3) {
                    historyData.previous_stage = previousStage;
                }
            } catch (e) {
                // Column doesn't exist, continue without it
            }

            const { error: historyError } = await this.supabase
                .from('stage_history')
                .insert([historyData]);

            if (historyError) throw historyError;

            // Try to add to recent activity using the database function (if it exists)
            try {
                await this.supabase.rpc('add_stage_change_activity', {
                    p_applicant_id: applicant.id,
                    p_applicant_name: applicant.full_name,
                    p_applicant_email: applicant.email,
                    p_new_stage: targetStage,
                    p_previous_stage: previousStage,
                    p_result: result,
                    p_comment: comment,
                    p_user_email: currentUser?.email || 'Unknown User',
                    p_user_fingerprint: userFingerprint
                });
            } catch (rpcError) {
                // Function doesn't exist, continue without recent activity update
                console.log('Recent activity function not available, continuing...');
            }

            // Reload data and close modal
            await this.loadData();

            // Refresh dashboard if available
            if (window.hrDashboard && window.hrDashboard.dashboardManager) {
                await window.hrDashboard.dashboardManager.loadData();
            } else if (window.dashboardManager) {
                await window.dashboardManager.loadData();
            }

            window.hrDashboard.closeModal('stage-transition-modal');
            window.hrDashboard.showToast(`Successfully moved ${applicant.full_name} to ${this.formatStage(targetStage)}`, 'success');

        } catch (error) {
            console.error('Save stage transition error:', error);
            console.error('Error details:', {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                name: error?.name,
                stack: error?.stack
            });

            let errorMessage = 'Failed to save stage transition';
            if (error?.message) {
                errorMessage += ': ' + error.message;
            } else if (error?.code) {
                errorMessage += ' (Code: ' + error.code + ')';
            }

            window.hrDashboard.showToast(errorMessage, 'error');
        }
    }

    // User fingerprinting for tracking changes
    async getUserFingerprint() {
        let fingerprint = localStorage.getItem('user_fingerprint');

        if (!fingerprint) {
            try {
                // Generate a unique fingerprint based on browser characteristics
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('HR Dashboard Fingerprint', 2, 2);

                const browserInfo = {
                    userAgent: navigator.userAgent || 'unknown',
                    language: navigator.language || 'unknown',
                    platform: navigator.platform || 'unknown',
                    screen: `${screen.width || 0}x${screen.height || 0}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
                    canvas: canvas.toDataURL() || 'unknown',
                    timestamp: Date.now()
                };

                // Create a hash from browser info
                const infoString = JSON.stringify(browserInfo);
                let hash = 0;
                for (let i = 0; i < infoString.length; i++) {
                    const char = infoString.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32-bit integer
                }

                fingerprint = `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
            } catch (fpError) {
                // Fallback fingerprint if generation fails
                console.warn('Fingerprint generation failed, using fallback:', fpError);
                fingerprint = `fp_fallback_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
            }

            localStorage.setItem('user_fingerprint', fingerprint);
        }

        return fingerprint;
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
            'sales_mock': 'Sales Mockup Calls',
            'slack_mock': 'Slack Mockup Calls',
            'hired': 'Hired',
            'rejected': 'Rejected'
        };

        return stages[stage] || stage;
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
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

    formatDateTimeLocal(dateString) {
        if (!dateString) return '';
        
        // Parse the UTC timestamp from database
        const utcDate = new Date(dateString);
        
        // Get the Central Time equivalent
        const centralTimeString = utcDate.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // Parse the Central Time string to get components
        const [datePart, timePart] = centralTimeString.split(', ');
        const [month, day, year] = datePart.split('/');
        const [hour, minute] = timePart.split(':');
        
        // Format for datetime-local input (YYYY-MM-DDTHH:MM)
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }

    // Helper to convert local datetime (assumed Central Time) to UTC ISO string
    convertLocalToUTC(localDateTimeString) {
        if (!localDateTimeString) return null;
        
        // Parse the datetime-local value
        const [datePart, timePart] = localDateTimeString.split('T');
        const [year, month, day] = datePart.split('-');
        const [hour, minute] = timePart.split(':');
        
        // Create a temporary date with the Central Time value
        // Using a known Central Time city to handle DST automatically
        const centralTimeString = `${year}-${month}-${day}T${hour}:${minute}:00`;
        
        // Create a date in Central Time using toLocaleString for proper timezone handling
        const tempDate = new Date(centralTimeString);
        
        // Get the current Central Time offset for this specific date
        const centralTestDate = new Date(tempDate.getTime());
        
        // Create a date object that represents this time in Central Time
        // by using the America/Chicago timezone
        const centralTimeISO = new Date(centralTestDate.toLocaleString('sv-SE', { timeZone: 'America/Chicago' }));
        
        // Calculate the offset between the local interpretation and Central Time
        const offset = centralTestDate.getTime() - centralTimeISO.getTime();
        
        // Apply the offset to get the correct UTC time
        const utcDate = new Date(centralTestDate.getTime() + offset);
        
        return utcDate.toISOString();
    }

    // Helper to get Central Time offset in minutes (kept for compatibility)
    getCentralTimeOffset(date) {
        // Simplified - just use the standard DST calculation
        const january = new Date(date.getFullYear(), 0, 1);
        const july = new Date(date.getFullYear(), 6, 1);
        const stdOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
        const isDST = date.getTimezoneOffset() < stdOffset;
        
        // Central Time offset: -360 minutes (CST) or -300 minutes (CDT)
        return isDST ? -300 : -360;
    }


    populateCountryFilter() {
        // Country is now an input field, so we don't need to populate options
        // This method is kept for compatibility but does nothing
    }

    populateReferredByFilter() {
        const referredByFilter = document.getElementById('referred-by-filter');
        if (!referredByFilter || !this.allApplicants) return;

        // Get unique referral sources from applicants
        const referrals = [...new Set(this.allApplicants
            .map(a => a.referred_by)
            .filter(referral => referral && referral.trim() !== '')
        )].sort();

        // Clear existing options except the first one
        const firstOption = referredByFilter.querySelector('option[value=""]');
        referredByFilter.innerHTML = '';
        referredByFilter.appendChild(firstOption);

        // Add referral options
        referrals.forEach(referral => {
            const option = document.createElement('option');
            option.value = referral;
            option.textContent = referral;
            referredByFilter.appendChild(option);
        });
    }

    applyFilters() {
        if (!this.allApplicants) return;

        const sortFilter = document.getElementById('sort-filter')?.value || 'updated-desc';
        const stageFilter = document.getElementById('stage-filter')?.value || '';
        const referredByFilter = document.getElementById('referred-by-filter')?.value || '';
        const searchFilter = document.getElementById('search-filter')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const dateFilterStart = document.getElementById('date-filter-start')?.value || '';
        const dateFilterEnd = document.getElementById('date-filter-end')?.value || '';

        // Start with all applicants
        let filtered = [...this.allApplicants];

        // Apply stage filter
        if (stageFilter) {
            filtered = filtered.filter(applicant => applicant.current_stage === stageFilter);
        }

        // Apply referred-by filter
        if (referredByFilter) {
            filtered = filtered.filter(applicant => applicant.referred_by === referredByFilter);
        }

        // Apply search filter (includes name, email, US name, and country)
        if (searchFilter) {
            filtered = filtered.filter(applicant =>
                applicant.full_name.toLowerCase().includes(searchFilter) ||
                applicant.email.toLowerCase().includes(searchFilter) ||
                (applicant.us_name && applicant.us_name.toLowerCase().includes(searchFilter)) ||
                (applicant.country && applicant.country.toLowerCase().includes(searchFilter))
            );
        }

        // Apply status filter (due/overdue warnings)
        if (statusFilter) {
            filtered = filtered.filter(applicant => {
                const status = window.hrDashboard.calculateStatus(applicant);
                return status === statusFilter;
            });
        }

        // Apply date filter
        if (dateFilterStart || dateFilterEnd) {
            const startDate = dateFilterStart ? new Date(dateFilterStart) : null;
            const endDate = dateFilterEnd ? new Date(dateFilterEnd + 'T23:59:59') : null;

            filtered = filtered.filter(applicant => {
                const createdDate = new Date(applicant.created_at);

                if (startDate && createdDate < startDate) return false;
                if (endDate && createdDate > endDate) return false;
                return true;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortFilter) {
                case 'name-asc':
                    return a.full_name.localeCompare(b.full_name);
                case 'name-desc':
                    return b.full_name.localeCompare(a.full_name);
                case 'age-asc':
                    return this.getAge(a.dob) - this.getAge(b.dob);
                case 'age-desc':
                    return this.getAge(b.dob) - this.getAge(a.dob);
                case 'created-asc':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'created-desc':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'updated-desc':
                    return new Date(b.updated_at) - new Date(a.updated_at);
                default:
                    return 0;
            }
        });

        // Update the displayed applicants
        this.applicants = filtered;
        this.renderApplicantsTable();
    }

    clearFilters() {
        document.getElementById('sort-filter').value = 'updated-desc';
        document.getElementById('stage-filter').value = '';
        document.getElementById('referred-by-filter').value = '';
        document.getElementById('search-filter').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('date-filter-start').value = '';
        document.getElementById('date-filter-end').value = '';
        this.applyFilters();
    }

    async markStageResult(historyId, result) {
        try {
            // Get current user information
            const currentUser = window.hrDashboard.currentUser;
            const userName = currentUser?.email || 'System';

            // Update the stage history entry
            const { error } = await this.supabase
                .from('stage_history')
                .update({
                    result: result,
                    comment: `Marked as ${result} by ${userName}`
                })
                .eq('id', historyId);

            if (error) throw error;

            // Reload the current applicant view
            if (this.currentApplicant) {
                await this.viewApplicant(this.currentApplicant.id);
            }

            window.hrDashboard.showToast(`Stage marked as ${result}`, 'success');

        } catch (error) {
            console.error('Mark stage result error:', error);
            window.hrDashboard.showToast('Failed to update stage result', 'error');
        }
    }



    getAge(dobString) {
        if (!dobString) return 0;
        const dob = new Date(dobString);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            return age - 1;
        }
        return age;
    }
}

// Initialize applicants manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    // This will be initialized by the main app once Supabase is ready
    window.applicantsManager = null;
});

// Export for use in other modules
window.ApplicantsManager = ApplicantsManager;