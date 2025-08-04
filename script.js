// Global variables
let supabase;
let currentUser = null;
let applicants = [];
let currentApplicant = null;
let confirmCallback = null;

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Wait for Supabase library to load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check for valid configuration
        if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_PROJECT_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
            throw new Error('Please update config.js with your actual Supabase project credentials');
        }
        
        // Initialize Supabase client
        if (!window.supabase) {
            throw new Error('Supabase library not loaded');
        }
        
        console.log('Current origin for redirects:', window.location.origin);
        
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            showDashboard();
        } else {
            showLogin();
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                currentUser = session.user;
                showDashboard();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                showLogin();
            }
        });
        
        // Initialize event listeners
        initializeEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showMessage('Failed to initialize application', 'error');
    }
});

// Event listeners
function initializeEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('magicLinkBtn').addEventListener('click', handleMagicLink);
    
    // Header actions
    document.getElementById('addApplicantBtn').addEventListener('click', () => openApplicantModal());
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Modal actions
    document.getElementById('closeModal').addEventListener('click', closeApplicantModal);
    document.getElementById('cancelBtn').addEventListener('click', closeApplicantModal);
    document.getElementById('saveApplicantBtn').addEventListener('click', handleSaveApplicant);
    document.getElementById('deleteApplicantBtn').addEventListener('click', handleDeleteApplicant);
    
    // Stage history
    document.getElementById('addHistoryBtn').addEventListener('click', handleAddHistory);
    document.getElementById('historyComment').addEventListener('input', updateCharCount);
    
    // Filters
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('stageFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    
    // Confirmation modal
    document.getElementById('confirmCancel').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmOk').addEventListener('click', handleConfirmOk);
    
    // Click outside modal to close
    document.getElementById('applicantModal').addEventListener('click', function(e) {
        if (e.target === this) closeApplicantModal();
    });
    
    document.getElementById('confirmModal').addEventListener('click', function(e) {
        if (e.target === this) closeConfirmModal();
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        showLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        showMessage('Login successful!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showMessage(error.message || 'Login failed', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleMagicLink() {
    const email = document.getElementById('loginEmail').value;
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) throw error;
        
        showMessage('Magic link sent! Check your email.', 'success');
    } catch (error) {
        console.error('Magic link error:', error);
        showMessage(error.message || 'Failed to send magic link', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// UI navigation
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    loadApplicants();
}

// Data loading functions
async function loadApplicants() {
    try {
        showLoading(true);
        
        const { data, error } = await supabase
            .from('applicants')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        
        applicants = data || [];
        updateSummaryCards();
        renderApplicantsTable();
        
    } catch (error) {
        console.error('Load applicants error:', error);
        showMessage('Failed to load applicants', 'error');
    } finally {
        showLoading(false);
    }
}

// Summary cards
function updateSummaryCards() {
    const total = applicants.length;
    let due = 0;
    let overdue = 0;
    let stalled = 0;
    
    applicants.forEach(applicant => {
        const status = computeApplicantStatus(applicant);
        
        if (status.meeting_status === 'due') due++;
        if (status.meeting_status === 'overdue') overdue++;
        if (status.is_stalled) stalled++;
    });
    
    document.getElementById('totalApplicants').textContent = total;
    document.getElementById('dueMeetings').textContent = due;
    document.getElementById('overdueMeetings').textContent = overdue;
    document.getElementById('stalledApplicants').textContent = stalled;
}

// Table rendering
function renderApplicantsTable() {
    const tbody = document.getElementById('applicantsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (applicants.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    tbody.innerHTML = applicants.map(applicant => {
        const status = computeApplicantStatus(applicant);
        const nextMeeting = status.next_scheduled ? 
            formatDateTime(status.next_scheduled) : 'Not scheduled';
        
        let rowClass = '';
        if (status.meeting_status === 'overdue') rowClass = 'overdue';
        else if (status.meeting_status === 'due') rowClass = 'due';
        else if (status.is_stalled) rowClass = 'stalled';
        
        return `
            <tr class="${rowClass}">
                <td>${escapeHtml(applicant.full_name)}</td>
                <td>${escapeHtml(applicant.email)}</td>
                <td>${escapeHtml(applicant.us_name || '-')}</td>
                <td><span class="stage-badge">${STAGES[applicant.current_stage] || applicant.current_stage}</span></td>
                <td>${nextMeeting}</td>
                <td><span class="status-badge status-${status.meeting_status || 'ok'}">${getStatusLabel(status)}</span></td>
                <td>${formatDateTime(applicant.updated_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-small" onclick="openApplicantModal('${applicant.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Status computation
function computeApplicantStatus(applicant) {
    const now = new Date();
    const upcomingDates = [
        applicant.interview_first_date,
        applicant.sales_mock_date,
        applicant.slack_mock_date
    ]
        .filter(Boolean)
        .map(d => new Date(d));
    
    let next = null;
    if (upcomingDates.length) {
        next = upcomingDates.reduce((a, b) => a < b ? a : b);
    }
    
    let meeting_status = 'ok';
    if (next) {
        const diffMs = now - next;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > STATUS_CONFIG.DUE_THRESHOLD_DAYS) {
            meeting_status = 'overdue';
        } else if (diffDays >= 0) {
            meeting_status = 'due';
        }
    }
    
    const updatedAt = new Date(applicant.updated_at);
    const stalled = (now - updatedAt) / (1000 * 60 * 60 * 24) >= STATUS_CONFIG.STALLED_DAYS &&
        !['hired', 'rejected'].includes(applicant.current_stage);
    
    return {
        meeting_status,
        is_stalled: stalled,
        next_scheduled: next
    };
}

function getStatusLabel(status) {
    if (status.meeting_status === 'overdue') return 'Overdue';
    if (status.meeting_status === 'due') return 'Due';
    if (status.is_stalled) return 'Stalled';
    return 'OK';
}

// Modal functions
async function openApplicantModal(applicantId = null) {
    currentApplicant = null;
    
    if (applicantId) {
        currentApplicant = applicants.find(a => a.id === applicantId);
        if (!currentApplicant) {
            showMessage('Applicant not found', 'error');
            return;
        }
    }
    
    // Set modal title
    document.getElementById('modalTitle').textContent = 
        currentApplicant ? 'Edit Applicant' : 'Add New Applicant';
    
    // Show/hide delete button
    const deleteBtn = document.getElementById('deleteApplicantBtn');
    if (currentApplicant) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
    
    // Populate form
    populateApplicantForm();
    
    // Show/hide stage history
    const historySection = document.getElementById('stageHistorySection');
    if (currentApplicant) {
        historySection.classList.remove('hidden');
        await loadStageHistory();
    } else {
        historySection.classList.add('hidden');
    }
    
    // Show modal
    document.getElementById('applicantModal').classList.remove('hidden');
}

function populateApplicantForm() {
    const form = document.getElementById('applicantForm');
    
    if (currentApplicant) {
        document.getElementById('fullName').value = currentApplicant.full_name || '';
        document.getElementById('email').value = currentApplicant.email || '';
        document.getElementById('dob').value = currentApplicant.dob || '';
        document.getElementById('usName').value = currentApplicant.us_name || '';
        document.getElementById('currentStage').value = currentApplicant.current_stage || 'challenge_email';
        document.getElementById('interviewFirstDate').value = formatDateTimeInput(currentApplicant.interview_first_date);
        document.getElementById('salesMockDate').value = formatDateTimeInput(currentApplicant.sales_mock_date);
        document.getElementById('slackMockDate').value = formatDateTimeInput(currentApplicant.slack_mock_date);
        document.getElementById('notes').value = currentApplicant.notes || '';
    } else {
        form.reset();
        document.getElementById('currentStage').value = 'challenge_email';
    }
}

function closeApplicantModal() {
    document.getElementById('applicantModal').classList.add('hidden');
    currentApplicant = null;
}

// Stage history functions
async function loadStageHistory() {
    if (!currentApplicant) return;
    
    try {
        const { data, error } = await supabase
            .from('applicant_stage_history')
            .select('*')
            .eq('applicant_id', currentApplicant.id)
            .order('recorded_at', { ascending: false });
        
        if (error) throw error;
        
        renderStageHistory(data || []);
        
    } catch (error) {
        console.error('Load stage history error:', error);
        showMessage('Failed to load stage history', 'error');
    }
}

function renderStageHistory(history) {
    const container = document.getElementById('stageHistoryList');
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-history">No stage history entries yet.</p>';
        return;
    }
    
    container.innerHTML = history.map(entry => `
        <div class="history-entry">
            <div class="history-header">
                <div>
                    <span class="history-stage">${STAGES[entry.stage] || entry.stage}</span>
                    <span class="history-result">${entry.result}</span>
                </div>
                <span class="history-date">${formatDateTime(entry.recorded_at)}</span>
            </div>
            ${entry.comment ? `<div class="history-comment">${escapeHtml(entry.comment)}</div>` : ''}
        </div>
    `).join('');
}

async function handleAddHistory() {
    if (!currentApplicant) return;
    
    const stage = document.getElementById('historyStage').value;
    const result = document.getElementById('historyResult').value;
    const comment = document.getElementById('historyComment').value.trim();
    
    if (comment.length > 200) {
        showMessage('Comment must be 200 characters or less', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const { error } = await supabase
            .from('applicant_stage_history')
            .insert([{
                applicant_id: currentApplicant.id,
                stage,
                result,
                comment
            }]);
        
        if (error) throw error;
        
        // Update applicant's current stage and updated_at
        await supabase
            .from('applicants')
            .update({
                current_stage: stage,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentApplicant.id);
        
        // Clear form
        document.getElementById('historyComment').value = '';
        updateCharCount();
        
        // Reload history and applicants
        await loadStageHistory();
        await loadApplicants();
        
        showMessage('Stage history entry added successfully', 'success');
        
    } catch (error) {
        console.error('Add history error:', error);
        showMessage('Failed to add stage history entry', 'error');
    } finally {
        showLoading(false);
    }
}

function updateCharCount() {
    const textarea = document.getElementById('historyComment');
    const counter = document.getElementById('commentCharCount');
    counter.textContent = textarea.value.length;
}

// Save applicant
async function handleSaveApplicant() {
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const dob = document.getElementById('dob').value || null;
    const usName = document.getElementById('usName').value.trim() || null;
    const currentStage = document.getElementById('currentStage').value;
    const interviewFirstDate = document.getElementById('interviewFirstDate').value || null;
    const salesMockDate = document.getElementById('salesMockDate').value || null;
    const slackMockDate = document.getElementById('slackMockDate').value || null;
    const notes = document.getElementById('notes').value.trim() || null;
    
    // Validation
    if (!fullName || !email) {
        showMessage('Full name and email are required', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const applicantData = {
            full_name: fullName,
            email: email,
            dob: dob,
            us_name: usName,
            current_stage: currentStage,
            interview_first_date: interviewFirstDate,
            sales_mock_date: salesMockDate,
            slack_mock_date: slackMockDate,
            notes: notes,
            updated_at: new Date().toISOString()
        };
        
        let error;
        
        if (currentApplicant) {
            // Update existing applicant
            const result = await supabase
                .from('applicants')
                .update(applicantData)
                .eq('id', currentApplicant.id);
            error = result.error;
        } else {
            // Create new applicant
            const result = await supabase
                .from('applicants')
                .insert([applicantData]);
            error = result.error;
        }
        
        if (error) throw error;
        
        showMessage(`Applicant ${currentApplicant ? 'updated' : 'created'} successfully`, 'success');
        closeApplicantModal();
        await loadApplicants();
        
    } catch (error) {
        console.error('Save applicant error:', error);
        if (error.code === '23505') {
            showMessage('An applicant with this email already exists', 'error');
        } else {
            showMessage('Failed to save applicant', 'error');
        }
    } finally {
        showLoading(false);
    }
}

// Delete applicant
function handleDeleteApplicant() {
    if (!currentApplicant) return;
    
    showConfirmDialog(
        `Are you sure you want to delete ${currentApplicant.full_name}? This action cannot be undone and will also delete all stage history.`,
        async () => {
            try {
                showLoading(true);
                
                const { error } = await supabase
                    .from('applicants')
                    .delete()
                    .eq('id', currentApplicant.id);
                
                if (error) throw error;
                
                showMessage('Applicant deleted successfully', 'success');
                closeApplicantModal();
                await loadApplicants();
                
            } catch (error) {
                console.error('Delete applicant error:', error);
                showMessage('Failed to delete applicant', 'error');
            } finally {
                showLoading(false);
            }
        }
    );
}

// Export functionality
async function handleExport() {
    try {
        showLoading(true);
        
        // Fetch all applicants
        const { data: applicantsData, error: applicantsError } = await supabase
            .from('applicants')
            .select('*')
            .order('full_name');
        
        if (applicantsError) throw applicantsError;
        
        // Fetch all stage history
        const { data: historyData, error: historyError } = await supabase
            .from('applicant_stage_history')
            .select('*')
            .order('recorded_at');
        
        if (historyError) throw historyError;
        
        // Merge data
        const exportData = applicantsData.map(applicant => ({
            ...applicant,
            stage_history: historyData.filter(h => h.applicant_id === applicant.id)
        }));
        
        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hr_recruitment_export_${formatDateForFilename(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('Data exported successfully', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showMessage('Failed to export data', 'error');
    } finally {
        showLoading(false);
    }
}

// Filter functionality
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const stageFilter = document.getElementById('stageFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    let filteredApplicants = applicants;
    
    // Search filter
    if (searchTerm) {
        filteredApplicants = filteredApplicants.filter(applicant =>
            applicant.full_name.toLowerCase().includes(searchTerm) ||
            applicant.email.toLowerCase().includes(searchTerm) ||
            (applicant.us_name && applicant.us_name.toLowerCase().includes(searchTerm))
        );
    }
    
    // Stage filter
    if (stageFilter) {
        filteredApplicants = filteredApplicants.filter(applicant =>
            applicant.current_stage === stageFilter
        );
    }
    
    // Status filter
    if (statusFilter) {
        filteredApplicants = filteredApplicants.filter(applicant => {
            const status = computeApplicantStatus(applicant);
            if (statusFilter === 'due') return status.meeting_status === 'due';
            if (statusFilter === 'overdue') return status.meeting_status === 'overdue';
            if (statusFilter === 'stalled') return status.is_stalled;
            return false;
        });
    }
    
    // Update global applicants for rendering
    const originalApplicants = [...applicants];
    applicants = filteredApplicants;
    renderApplicantsTable();
    updateSummaryCards();
    applicants = originalApplicants;
}

// Confirmation dialog
function showConfirmDialog(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmCallback = callback;
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

function handleConfirmOk() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('loginMessage');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'message';
    }, 5000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatDateTimeInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
}

function formatDateForFilename(date) {
    return date.toISOString().split('T')[0];
}
