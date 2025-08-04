/* === CONFIGURATION === */
const SUPABASE_URL = 'https://mcyppxpnkbonjvbojtaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jeXBweHBua2Jvbmp2Ym9qdGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzE5MTksImV4cCI6MjA2OTkwNzkxOX0.3_jrKVB3aFGa8QD5QvfGEK1l2Exe8qu6gYe7AzJ1tqE';

// Initialize Supabase client - will be set when library loads
let supabase = null;

/* === GLOBAL STATE === */
let currentApplicants = [];
let currentEditingId = null;
let currentHistoryEntries = [];

/* === STAGE LABELS === */
const STAGE_LABELS = {
  challenge_email: 'Challenge Email',
  equipment_email: 'Equipment Email',
  first_interview: 'First Interview',
  sales_mock: 'Sales Mock',
  slack_mock: 'Slack Mock',
  hired: 'Hired',
  rejected: 'Rejected'
};

/* === UTILITY FUNCTIONS === */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateInput(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Convert to local timezone for datetime-local input
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(title, message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconMap = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info'
  };

  toast.innerHTML = `
    <div class="toast-content">
      <i class="toast-icon" data-feather="${iconMap[type]}"></i>
      <div class="toast-message">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-description">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
        <i data-feather="x"></i>
      </button>
    </div>
  `;

  toastContainer.appendChild(toast);
  feather.replace();

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 5000);
}

function showConfirmDialog(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');

  titleEl.textContent = title;
  messageEl.textContent = message;

  const handleConfirm = () => {
    modal.classList.remove('active');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    onConfirm();
  };

  const handleCancel = () => {
    modal.classList.remove('active');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);

  modal.classList.add('active');
}

/* === STATUS COMPUTATION === */
function computeStatus(applicant) {
  const now = new Date();
  const upcomingDates = [
    applicant.interview_first_date,
    applicant.sales_mock_date,
    applicant.slack_mock_date
  ]
    .filter(Boolean)
    .map(d => new Date(d));

  let next = null;
  if (upcomingDates.length > 0) {
    next = upcomingDates.reduce((earliest, current) => 
      current < earliest ? current : earliest
    );
  }

  let meeting_status = 'ok';
  if (next) {
    const diffMs = now - next;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 1) {
      meeting_status = 'overdue';
    } else if (diffDays >= -1 && diffDays <= 1) {
      meeting_status = 'due';
    }
  }

  const updatedAt = new Date(applicant.updated_at);
  const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);
  const stalled = daysSinceUpdate >= 5 && 
    !['hired', 'rejected'].includes(applicant.current_stage);

  return { 
    meeting_status: stalled ? 'stalled' : meeting_status, 
    is_stalled: stalled, 
    next_scheduled: next 
  };
}

/* === AUTHENTICATION === */
async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    showToast('Login Failed', error.message, 'error');
    return false;
  }
  
  showToast('Success', 'Successfully signed in!', 'success');
  return true;
}



async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast('Sign Out Failed', error.message, 'error');
  } else {
    showToast('Signed Out', 'You have been signed out', 'success');
  }
}

async function getSession() {
  if (!supabase) {
    console.error('Supabase not initialized');
    return null;
  }
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/* === APPLICANT CRUD OPERATIONS === */
async function loadApplicants() {
  try {
    const { data: applicants, error } = await supabase
      .from('applicants')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    currentApplicants = applicants || [];
    renderDashboard();
    
  } catch (error) {
    console.error('Error loading applicants:', error);
    showToast('Error', 'Failed to load applicants: ' + error.message, 'error');
  }
}

async function createApplicant(applicantData) {
  try {
    const { error } = await supabase
      .from('applicants')
      .insert([applicantData]);

    if (error) throw error;

    showToast('Success', 'Applicant created successfully', 'success');
    await loadApplicants();
    
  } catch (error) {
    console.error('Error creating applicant:', error);
    showToast('Error', 'Failed to create applicant: ' + error.message, 'error');
    throw error;
  }
}

async function updateApplicant(id, changes) {
  try {
    const { error } = await supabase
      .from('applicants')
      .update({
        ...changes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    showToast('Success', 'Applicant updated successfully', 'success');
    await loadApplicants();
    
  } catch (error) {
    console.error('Error updating applicant:', error);
    showToast('Error', 'Failed to update applicant: ' + error.message, 'error');
    throw error;
  }
}

async function deleteApplicant(id) {
  try {
    const { error } = await supabase
      .from('applicants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Success', 'Applicant deleted successfully', 'success');
    await loadApplicants();
    
  } catch (error) {
    console.error('Error deleting applicant:', error);
    showToast('Error', 'Failed to delete applicant: ' + error.message, 'error');
    throw error;
  }
}

async function clearAllData() {
  try {
    const { error } = await supabase
      .from('applicants')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (error) throw error;

    showToast('Success', 'All data cleared successfully', 'success');
    await loadApplicants();
    
  } catch (error) {
    console.error('Error clearing data:', error);
    showToast('Error', 'Failed to clear data: ' + error.message, 'error');
  }
}

/* === STAGE HISTORY OPERATIONS === */
async function fetchStageHistory(applicant_id) {
  try {
    const { data, error } = await supabase
      .from('applicant_stage_history')
      .select('*')
      .eq('applicant_id', applicant_id)
      .order('recorded_at', { ascending: false });

    if (error) throw error;

    return data || [];
    
  } catch (error) {
    console.error('Error fetching stage history:', error);
    showToast('Error', 'Failed to load stage history: ' + error.message, 'error');
    return [];
  }
}

async function addStageHistory(applicant_id, stage, result, comment) {
  try {
    const trimmedComment = comment.slice(0, 200);
    
    const { error } = await supabase
      .from('applicant_stage_history')
      .insert([{
        applicant_id,
        stage,
        result,
        comment: trimmedComment
      }]);

    if (error) throw error;

    // Update the applicant's current stage and updated_at
    await updateApplicant(applicant_id, { current_stage: stage });
    
    showToast('Success', 'Stage history entry added', 'success');
    
  } catch (error) {
    console.error('Error adding stage history:', error);
    showToast('Error', 'Failed to add stage history: ' + error.message, 'error');
    throw error;
  }
}

/* === EXPORT FUNCTIONALITY === */
async function exportAllData() {
  try {
    // Fetch applicants
    const { data: applicants, error: aErr } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: true });

    if (aErr) throw aErr;

    // Fetch all stage histories
    const { data: histories, error: hErr } = await supabase
      .from('applicant_stage_history')
      .select('*')
      .order('recorded_at', { ascending: true });

    if (hErr) throw hErr;

    // Merge data
    const exportData = applicants.map(applicant => ({
      ...applicant,
      stage_history: histories.filter(h => h.applicant_id === applicant.id)
    }));

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr_recruitment_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Success', 'Data exported successfully', 'success');
    
  } catch (error) {
    console.error('Error exporting data:', error);
    showToast('Error', 'Failed to export data: ' + error.message, 'error');
  }
}

/* === UI RENDERING === */
function renderDashboard() {
  renderSummaryCards();
  renderApplicantsTable();
}

function renderSummaryCards() {
  const totalApplicants = currentApplicants.length;
  let dueMeetings = 0;
  let overdueMeetings = 0;
  let stalledApplicants = 0;

  currentApplicants.forEach(applicant => {
    const status = computeStatus(applicant);
    if (status.meeting_status === 'due') dueMeetings++;
    if (status.meeting_status === 'overdue') overdueMeetings++;
    if (status.is_stalled) stalledApplicants++;
  });

  document.getElementById('totalApplicants').textContent = totalApplicants;
  document.getElementById('dueMeetings').textContent = dueMeetings;
  document.getElementById('overdueMeetings').textContent = overdueMeetings;
  document.getElementById('stalledApplicants').textContent = stalledApplicants;
}

function renderApplicantsTable() {
  const tbody = document.getElementById('applicantsTableBody');
  const emptyState = document.getElementById('emptyState');
  
  // Apply filters
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const stageFilter = document.getElementById('stageFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;

  let filteredApplicants = currentApplicants.filter(applicant => {
    const matchesSearch = !searchTerm || 
      applicant.full_name.toLowerCase().includes(searchTerm) ||
      applicant.email.toLowerCase().includes(searchTerm) ||
      (applicant.us_name && applicant.us_name.toLowerCase().includes(searchTerm));
    
    const matchesStage = !stageFilter || applicant.current_stage === stageFilter;
    
    const status = computeStatus(applicant);
    const matchesStatus = !statusFilter || status.meeting_status === statusFilter;

    return matchesSearch && matchesStage && matchesStatus;
  });

  if (filteredApplicants.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  tbody.innerHTML = filteredApplicants.map(applicant => {
    const status = computeStatus(applicant);
    const nextMeeting = status.next_scheduled 
      ? formatDate(status.next_scheduled)
      : '-';

    const rowClass = status.meeting_status === 'overdue' ? 'row-overdue' :
                    status.meeting_status === 'due' ? 'row-due' :
                    status.is_stalled ? 'row-stalled' : '';

    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(applicant.full_name)}</td>
        <td>${escapeHtml(applicant.email)}</td>
        <td>${applicant.us_name ? escapeHtml(applicant.us_name) : '-'}</td>
        <td>
          <span class="stage-badge">
            ${STAGE_LABELS[applicant.current_stage] || applicant.current_stage}
          </span>
        </td>
        <td>${nextMeeting}</td>
        <td>
          <span class="status-indicator status-${status.meeting_status}">
            ${status.meeting_status.toUpperCase()}
          </span>
        </td>
        <td>${formatDate(applicant.updated_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn" onclick="editApplicant('${applicant.id}')">
              <i data-feather="edit-2"></i>
            </button>
            <button class="action-btn" onclick="deleteApplicantWithConfirm('${applicant.id}')">
              <i data-feather="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  feather.replace();
}

/* === MODAL FUNCTIONS === */
function openApplicantModal(applicantId = null) {
  const modal = document.getElementById('applicantModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('applicantForm');
  const deleteBtn = document.getElementById('deleteApplicantBtn');
  const historySection = document.getElementById('historySection');

  currentEditingId = applicantId;

  if (applicantId) {
    title.textContent = 'Edit Applicant';
    deleteBtn.style.display = 'block';
    historySection.style.display = 'block';
    
    const applicant = currentApplicants.find(a => a.id === applicantId);
    if (applicant) {
      fillApplicantForm(applicant);
      loadStageHistory(applicantId);
    }
  } else {
    title.textContent = 'Add New Applicant';
    deleteBtn.style.display = 'none';
    historySection.style.display = 'none';
    form.reset();
  }

  modal.classList.add('active');
}

function closeApplicantModal() {
  const modal = document.getElementById('applicantModal');
  modal.classList.remove('active');
  currentEditingId = null;
  currentHistoryEntries = [];
}

function fillApplicantForm(applicant) {
  document.getElementById('fullName').value = applicant.full_name || '';
  document.getElementById('email').value = applicant.email || '';
  document.getElementById('usName').value = applicant.us_name || '';
  document.getElementById('dob').value = applicant.dob || '';
  document.getElementById('currentStage').value = applicant.current_stage || 'challenge_email';
  document.getElementById('interviewFirstDate').value = formatDateInput(applicant.interview_first_date);
  document.getElementById('salesMockDate').value = formatDateInput(applicant.sales_mock_date);
  document.getElementById('slackMockDate').value = formatDateInput(applicant.slack_mock_date);
  document.getElementById('notes').value = applicant.notes || '';
}

async function loadStageHistory(applicantId) {
  const historyContainer = document.getElementById('stageHistory');
  historyContainer.innerHTML = '<div class="loading">Loading history...</div>';

  try {
    currentHistoryEntries = await fetchStageHistory(applicantId);
    renderStageHistory();
  } catch (error) {
    historyContainer.innerHTML = '<div class="error">Failed to load history</div>';
  }
}

function renderStageHistory() {
  const historyContainer = document.getElementById('stageHistory');
  
  if (currentHistoryEntries.length === 0) {
    historyContainer.innerHTML = '<p class="text-center">No stage history entries yet.</p>';
    return;
  }

  historyContainer.innerHTML = currentHistoryEntries.map(entry => `
    <div class="history-entry">
      <div class="history-header">
        <span class="history-stage">${STAGE_LABELS[entry.stage] || entry.stage}</span>
        <span class="history-result result-${entry.result.toLowerCase()}">${entry.result}</span>
        <span class="history-date">${formatDate(entry.recorded_at)}</span>
      </div>
      ${entry.comment ? `<div class="history-comment">"${escapeHtml(entry.comment)}"</div>` : ''}
    </div>
  `).join('');
}

async function saveApplicant() {
  const form = document.getElementById('applicantForm');
  const saveBtn = document.getElementById('saveApplicantBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const spinner = saveBtn.querySelector('.spinner');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Disable button and show loading
  saveBtn.disabled = true;
  btnText.style.display = 'none';
  spinner.style.display = 'block';

  try {
    const formData = new FormData(form);
    const applicantData = {
      full_name: document.getElementById('fullName').value.trim(),
      email: document.getElementById('email').value.trim(),
      us_name: document.getElementById('usName').value.trim() || null,
      dob: document.getElementById('dob').value || null,
      current_stage: document.getElementById('currentStage').value,
      interview_first_date: document.getElementById('interviewFirstDate').value || null,
      sales_mock_date: document.getElementById('salesMockDate').value || null,
      slack_mock_date: document.getElementById('slackMockDate').value || null,
      notes: document.getElementById('notes').value.trim() || null
    };

    if (currentEditingId) {
      await updateApplicant(currentEditingId, applicantData);
    } else {
      await createApplicant(applicantData);
    }

    closeApplicantModal();
    
  } catch (error) {
    // Error is already handled in the CRUD functions
  } finally {
    // Re-enable button
    saveBtn.disabled = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

async function addHistoryEntry() {
  const stage = document.getElementById('historyStage').value;
  const result = document.getElementById('historyResult').value;
  const comment = document.getElementById('historyComment').value.trim();

  if (!currentEditingId) {
    showToast('Error', 'No applicant selected', 'error');
    return;
  }

  try {
    await addStageHistory(currentEditingId, stage, result, comment);
    
    // Clear form
    document.getElementById('historyComment').value = '';
    document.getElementById('commentCharCount').textContent = '0';
    
    // Reload history
    await loadStageHistory(currentEditingId);
    
  } catch (error) {
    // Error is already handled in addStageHistory
  }
}

/* === GLOBAL EVENT HANDLERS === */
function editApplicant(id) {
  openApplicantModal(id);
}

function deleteApplicantWithConfirm(id) {
  const applicant = currentApplicants.find(a => a.id === id);
  const name = applicant ? applicant.full_name : 'this applicant';
  
  showConfirmDialog(
    'Delete Applicant',
    `Are you sure you want to delete ${name}? This action cannot be undone.`,
    () => deleteApplicant(id)
  );
}

function clearAllDataWithConfirm() {
  showConfirmDialog(
    'Clear All Data',
    'Are you sure you want to delete ALL applicants and their history? This action cannot be undone.',
    clearAllData
  );
}

/* === INITIALIZATION === */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Feather icons
  if (typeof feather !== 'undefined') {
    feather.replace();
  }

  // Wait for libraries to load
  let retryCount = 0;
  const maxRetries = 100;
  
  function initSupabase() {
    retryCount++;
    console.log(`Checking for Supabase library... Attempt ${retryCount}`);
    
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized successfully');
        initializeApp();
      } catch (error) {
        console.error('Error initializing Supabase:', error);
        // Fallback - show app without authentication
        showLoginScreenFallback();
      }
    } else if (retryCount < maxRetries) {
      setTimeout(initSupabase, 50);
    } else {
      console.error('Failed to load Supabase library after maximum retries');
      // Fallback - show app without authentication
      showLoginScreenFallback();
    }
  }
  
  function showLoginScreenFallback() {
    console.log('Starting without authentication service');
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      // Add a notice about the authentication issue
      const notice = document.createElement('div');
      notice.style.cssText = 'background: rgba(231, 76, 60, 0.1); border: 1px solid #e74c3c; color: #e74c3c; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; text-align: center;';
      notice.innerHTML = 'Authentication service unavailable. Please refresh the page or contact support.';
      const loginContainer = loginScreen.querySelector('.login-container');
      if (loginContainer) {
        loginContainer.insertBefore(notice, loginContainer.firstChild);
      }
    }
    
    if (dashboard) {
      dashboard.style.display = 'none';
    }
  }

  initSupabase();
});

async function initializeApp() {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    console.log('Initializing app...');
    
    // Auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
      const loginScreen = document.getElementById('loginScreen');
      const dashboard = document.getElementById('dashboard');

      if (session) {
        loginScreen.style.display = 'none';
        dashboard.style.display = 'block';
        loadApplicants();
      } else {
        loginScreen.style.display = 'flex';
        dashboard.style.display = 'none';
      }
    });

    // Check current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
    }
    
    // Trigger initial state
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    
    if (session) {
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
      loadApplicants();
    } else {
      loginScreen.style.display = 'flex';
      dashboard.style.display = 'none';
    }
    
  } catch (error) {
    console.error('App initialization error:', error);
    showToast('Error', 'Application failed to initialize properly', 'error');
  }

  // Login form handlers
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (email && password) {
      const loginBtn = document.getElementById('loginBtn');
      const btnText = loginBtn.querySelector('.btn-text');
      const spinner = loginBtn.querySelector('.spinner');
      
      loginBtn.disabled = true;
      btnText.style.display = 'none';
      spinner.style.display = 'block';
      
      try {
        await signInWithPassword(email, password);
      } finally {
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
      }
    }
  });



  // Dashboard event listeners
  document.getElementById('logoutBtn').addEventListener('click', signOut);
  document.getElementById('addApplicantBtn').addEventListener('click', () => openApplicantModal());
  document.getElementById('exportBtn').addEventListener('click', exportAllData);
  document.getElementById('refreshBtn').addEventListener('click', loadApplicants);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllDataWithConfirm);

  // Modal event listeners
  document.getElementById('modalClose').addEventListener('click', closeApplicantModal);
  document.getElementById('cancelBtn').addEventListener('click', closeApplicantModal);
  document.getElementById('saveApplicantBtn').addEventListener('click', saveApplicant);
  document.getElementById('deleteApplicantBtn').addEventListener('click', () => {
    if (currentEditingId) {
      deleteApplicantWithConfirm(currentEditingId);
      closeApplicantModal();
    }
  });
  document.getElementById('addHistoryBtn').addEventListener('click', addHistoryEntry);

  // Filter event listeners
  document.getElementById('searchInput').addEventListener('input', renderApplicantsTable);
  document.getElementById('stageFilter').addEventListener('change', renderApplicantsTable);
  document.getElementById('statusFilter').addEventListener('change', renderApplicantsTable);
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('stageFilter').value = '';
    document.getElementById('statusFilter').value = '';
    renderApplicantsTable();
  });

  // Comment character counter
  document.getElementById('historyComment').addEventListener('input', (e) => {
    const charCount = e.target.value.length;
    document.getElementById('commentCharCount').textContent = charCount;
  });

  // Close modal when clicking outside
  document.getElementById('applicantModal').addEventListener('click', (e) => {
    if (e.target.id === 'applicantModal') {
      closeApplicantModal();
    }
  });

  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') {
      document.getElementById('confirmModal').classList.remove('active');
    }
  });

  // Empty state button
  document.querySelector('#emptyState .btn').addEventListener('click', () => openApplicantModal());
}

// Handle page refresh with auth state
window.addEventListener('load', async () => {
  const session = await getSession();
  if (session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadApplicants();
  }
});
