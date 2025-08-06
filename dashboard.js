// Dashboard manager
class DashboardManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.summaryData = null;
        this.recentActivity = [];
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadSummaryData(),
                this.loadRecentActivity()
            ]);

            this.renderSummaryCards();
            this.renderRecentActivity();
        } catch (error) {
            console.error('Dashboard load error:', error);
            window.hrDashboard.showToast('Failed to load dashboard data', 'error');
        }
    }

    async loadSummaryData() {
        try {
            // Get all applicants with their current stages
            const { data: applicants, error } = await this.supabase
                .from('applicants')
                .select('*');

            if (error) throw error;

            // Calculate summary statistics
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            // Filter for interview stages
            const interviewApplicants = applicants.filter(a => 
                a.current_stage === 'first_interview' || 
                a.current_stage === 'sales_mock' || 
                a.current_stage === 'slack_mock'
            );

            let dueInterviews = 0;
            let overdueInterviews = 0;

            interviewApplicants.forEach(applicant => {
                let nextDate = null;
                
                // Get the appropriate scheduled date based on stage
                if (applicant.current_stage === 'first_interview' && applicant.interview_date) {
                    nextDate = new Date(applicant.interview_date);
                } else if (applicant.current_stage === 'sales_mock' && applicant.sales_mock_date) {
                    nextDate = new Date(applicant.sales_mock_date);
                } else if (applicant.current_stage === 'slack_mock' && applicant.slack_mock_date) {
                    nextDate = new Date(applicant.slack_mock_date);
                }

                if (nextDate) {
                    const minutesDiff = (nextDate - now) / (1000 * 60);
                    
                    if (minutesDiff < -10) {
                        overdueInterviews++;
                    } else if (minutesDiff <= 360) { // 6 hours = 360 minutes
                        dueInterviews++;
                    }
                }
            });

            this.summaryData = {
                total: applicants.length,
                hired: applicants.filter(a => a.current_stage === 'hired').length,
                rejected: applicants.filter(a => a.current_stage === 'rejected').length,
                challenge_email: applicants.filter(a => a.current_stage === 'challenge_email').length,
                equipment_email: applicants.filter(a => a.current_stage === 'equipment_email').length,
                first_interview: applicants.filter(a => a.current_stage === 'first_interview').length,
                sales_mock: applicants.filter(a => a.current_stage === 'sales_mock').length,
                slack_mock: applicants.filter(a => a.current_stage === 'slack_mock').length,
                due_interviews: dueInterviews,
                overdue_interviews: overdueInterviews
            };

        } catch (error) {
            console.error('Summary data load error:', error);
            throw error;
        }
    }

    async loadRecentActivity() {
        try {
            // Try to load from the recent_activity table first (if it exists)
            let activities = [];
            let fallbackToStageHistory = false;

            try {
                const { data: recentData, error: recentError } = await this.supabase
                    .from('recent_activity')
                    .select('*')
                    .order('priority', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (recentError) {
                    if (recentError.code === 'PGRST205') {
                        // Table doesn't exist, fall back to stage_history
                        fallbackToStageHistory = true;
                    } else {
                        throw recentError;
                    }
                } else {
                    activities = recentData || [];
                }
            } catch (tableError) {
                fallbackToStageHistory = true;
            }

            if (fallbackToStageHistory) {
                // Load from stage_history table instead
                const { data: historyData, error: historyError } = await this.supabase
                    .from('stage_history')
                    .select(`
                        *,
                        applicant:applicants(full_name, email)
                    `)
                    .order('created_at', { ascending: false })
                    .limit(30); // Get 30 to clean up to 20

                if (historyError) throw historyError;

                // Transform stage_history data to activity format
                activities = (historyData || []).map(history => ({
                    id: history.id,
                    activity_type: 'stage_change',
                    applicant_id: history.applicant_id,
                    applicant_name: history.applicant?.full_name || 'Unknown',
                    applicant_email: history.applicant?.email || '',
                    stage: history.stage,
                    previous_stage: history.previous_stage,
                    result: history.result,
                    comment: history.comment,
                    user_email: history.user_email,
                    user_fingerprint: history.user_fingerprint,
                    priority: 10,
                    created_at: history.created_at
                }));

                // Clean up excess records - keep only 20 most recent
                if (activities.length > 20) {
                    const oldActivities = activities.slice(20);
                    await this.cleanupOldActivities(oldActivities);
                    activities = activities.slice(0, 20);
                }
            }

            // Get all applicants to check for due/overdue items
            const { data: applicants, error: applicantsError } = await this.supabase
                .from('applicants')
                .select('*')
                .order('created_at', { ascending: false });

            if (applicantsError) throw applicantsError;

            // Removed due/overdue alerts from Recent Activity to reduce clutter
            // Status badges in the applicants table already show this information

            // Sort by priority first, then by date (newest to oldest - most recent at top)
            activities.sort((a, b) => {
                // High priority items (alerts) first
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                // Within same priority, newest first (larger date first)
                const dateA = new Date(a.created_at);
                const dateB = new Date(b.created_at);
                return dateB.getTime() - dateA.getTime();
            });

            this.recentActivity = activities.slice(0, 20);

        } catch (error) {
            console.error('Recent activity load error:', error);
            this.recentActivity = [];
        }
    }

    renderSummaryCards() {
        const container = document.getElementById('summary-cards');
        if (!container || !this.summaryData) return;

        const cards = [
            {
                title: 'Total Applicants',
                count: this.summaryData.total,
                icon: 'bi-people-fill',
                class: 'total'
            },
            {
                title: 'Hired',
                count: this.summaryData.hired,
                icon: 'bi-check-circle-fill',
                class: 'hired'
            },
            {
                title: 'Rejected',
                count: this.summaryData.rejected,
                icon: 'bi-x-circle-fill',
                class: 'rejected'
            },
            {
                title: 'Due Interviews',
                count: this.summaryData.due_interviews,
                icon: 'bi-clock-fill',
                class: 'due'
            },
            {
                title: 'Overdue Interviews',
                count: this.summaryData.overdue_interviews,
                icon: 'bi-exclamation-triangle-fill',
                class: 'overdue'
            },
            {
                title: 'Challenge Email Stage',
                count: this.summaryData.challenge_email,
                icon: 'bi-envelope-fill',
                class: 'challenge'
            },
            {
                title: 'Equipment Email Stage',
                count: this.summaryData.equipment_email,
                icon: 'bi-laptop-fill',
                class: 'equipment'
            },
            {
                title: 'In First Interviews',
                count: this.summaryData.first_interview,
                icon: 'bi-camera-video-fill',
                class: 'interview'
            },
            {
                title: 'In Sales Mockup Calls',
                count: this.summaryData.sales_mock,
                icon: 'bi-graph-up-arrow',
                class: 'sales'
            },
            {
                title: 'In Slack Mockup Calls',
                count: this.summaryData.slack_mock,
                icon: 'bi-chat-dots-fill',
                class: 'slack'
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="summary-card">
                <div class="summary-card-header">
                    <div class="summary-card-icon ${card.class}">
                        <i class="${card.icon}"></i>
                    </div>
                    <div class="summary-card-count">${card.count}</div>
                </div>
                <div class="summary-card-title">${card.title}</div>
                <div class="summary-card-change">
                    ${this.calculateChange(card.title, card.count)}
                </div>
            </div>
        `).join('');
    }

    renderRecentActivity() {
        const container = document.getElementById('recent-activity');
        if (!container) return;

        if (this.recentActivity.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-clock-history"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.recentActivity.map(activity => {
            const applicantName = window.sanitizeHtml(activity.applicant_name || 'Unknown');
            const activityType = activity.activity_type;
            const isHighPriority = activity.priority >= 70; // High priority for warnings/alerts

            switch (activityType) {
                case 'stage_change':
                    return `
                        <div class="activity-item ${isHighPriority ? 'high-priority' : ''}">
                            <div class="activity-icon stage-change">
                                <i class="bi bi-arrow-right-circle"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">
                                    ${applicantName} moved to ${this.formatStage(activity.stage)}
                                </div>
                                ${activity.comment ? `<div class="activity-comment">${window.sanitizeHtml(activity.comment)}</div>` : ''}
                                <div class="activity-meta">
                                    ${activity.user_email ? `<span class="activity-user">by ${window.sanitizeHtml(activity.user_email)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;

                case 'applicant_created':
                    return `
                        <div class="activity-item ${isHighPriority ? 'high-priority' : ''}">
                            <div class="activity-icon applicant-created">
                                <i class="bi bi-person-plus-fill"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">
                                    New applicant ${applicantName} was added to the system
                                </div>
                                <div class="activity-meta">
                                    ${activity.user_email ? `<span class="activity-user">by ${window.sanitizeHtml(activity.user_email)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;

                // Removed due_alert and overdue_alert cases to reduce clutter in Recent Activity

                case 'summary_card_change':
                    return `
                        <div class="activity-item ${isHighPriority ? 'high-priority' : ''}">
                            <div class="activity-icon summary-change">
                                <i class="bi bi-graph-up"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">
                                    Summary statistics updated
                                </div>
                                ${activity.comment ? `<div class="activity-comment">${window.sanitizeHtml(activity.comment)}</div>` : ''}
                                <div class="activity-meta">
                                </div>
                            </div>
                        </div>
                    `;

                default:
                    return '';
            }
        }).join('');
    }

    async cleanupOldActivities(oldActivities) {
        try {
            // Delete old activity records from stage_history to maintain the 15-item limit
            const idsToDelete = oldActivities.map(activity => activity.id);
            if (idsToDelete.length > 0) {
                const { error } = await this.supabase
                    .from('stage_history')
                    .delete()
                    .in('id', idsToDelete);

                if (error) {
                    console.warn('Failed to cleanup old activities:', error);
                }
            }
        } catch (error) {
            console.warn('Cleanup old activities error:', error);
        }
    }

    calculateChange(cardTitle, currentValue) {
        // This is a placeholder for showing percentage changes
        // In a real application, you would compare with previous period data
        const changes = {
            'Total Applicants': '+12%',
            'Hired': '+5%',
            'Rejected': '+2%',
            'Due Interviews': '+10%',
            'Overdue Interviews': '+6%',
            'Challenge Email Stage': '+8%',
            'Equipment Email Stage': '+3%',
            'In First Interviews': '+15%',
            'In Sales Mockup Calls': '+7%',
            'In Slack Mockup Calls': '+4%'
        };

        return changes[cardTitle] || 'No change';
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

    formatCentralTime(dateString) {
        if (!dateString) return 'Never';

        // Parse the UTC timestamp from Supabase
        let utcDate;

        // Handle different timestamp formats from Supabase
        if (dateString.endsWith('Z')) {
            // Already in proper UTC format
            utcDate = new Date(dateString);
        } else if (dateString.includes('+')) {
            // Has timezone info
            utcDate = new Date(dateString);
        } else {
            // Assume UTC and add Z
            utcDate = new Date(dateString + 'Z');
        }

        const now = new Date();

        // Calculate the actual time difference
        const diffMs = now.getTime() - utcDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now (CT)';
        } else if (diffMins < 60) {
            return `${diffMins} minutes ago (CT)`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago (CT)`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago (CT)`;
        } else {
            // For older dates, show the actual Central Time
            return utcDate.toLocaleDateString('en-US', {
                timeZone: 'America/Chicago',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) + ' ' + utcDate.toLocaleTimeString('en-US', {
                timeZone: 'America/Chicago',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' (CT)';
        }
    }

    formatRelativeTime(dateString) {
        // Alias for backward compatibility
        return this.formatCentralTime(dateString);
    }

    // Method to refresh dashboard data
    async refreshData() {
        await this.loadData();
    }
}

// Initialize dashboard manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    // This will be initialized by the main app once Supabase is ready
    window.dashboardManager = null;
});

// Export for use in other modules
window.DashboardManager = DashboardManager;