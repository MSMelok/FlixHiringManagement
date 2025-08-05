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
            this.summaryData = {
                total: applicants.length,
                hired: applicants.filter(a => a.current_stage === 'hired').length,
                rejected: applicants.filter(a => a.current_stage === 'rejected').length,
                challenge_email: applicants.filter(a => a.current_stage === 'challenge_email').length,
                equipment_email: applicants.filter(a => a.current_stage === 'equipment_email').length,
                first_interview: applicants.filter(a => a.current_stage === 'first_interview').length,
                sales_mock: applicants.filter(a => a.current_stage === 'sales_mock').length,
                slack_mock: applicants.filter(a => a.current_stage === 'slack_mock').length
            };

        } catch (error) {
            console.error('Summary data load error:', error);
            throw error;
        }
    }

    async loadRecentActivity() {
        try {
            // Get recent stage history entries
            const { data: history, error } = await this.supabase
                .from('stage_history')
                .select(`
                    *,
                    applicants (
                        full_name,
                        email
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.recentActivity = history || [];
        } catch (error) {
            console.error('Recent activity load error:', error);
            // Don't throw error for recent activity as it's not critical
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
                title: 'In Sales Mockups',
                count: this.summaryData.sales_mock,
                icon: 'bi-graph-up-arrow',
                class: 'sales'
            },
            {
                title: 'In Slack Mock Calls',
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

        container.innerHTML = this.recentActivity.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="bi bi-arrow-right-circle"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">
                        ${window.sanitizeHtml(activity.applicants?.full_name || 'Unknown')} 
                        moved to ${this.formatStage(activity.stage)} 
                        (${activity.result || 'pending'})
                    </div>
                    <div class="activity-time">
                        ${this.formatRelativeTime(activity.created_at)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    calculateChange(cardTitle, currentValue) {
        // This is a placeholder for showing percentage changes
        // In a real application, you would compare with previous period data
        const changes = {
            'Total Applicants': '+12%',
            'Hired': '+5%',
            'Rejected': '+2%',
            'Challenge Email Stage': '+8%',
            'Equipment Email Stage': '+3%',
            'In First Interviews': '+15%',
            'In Sales Mockups': '+7%',
            'In Slack Mock Calls': '+4%'
        };
        
        return changes[cardTitle] || 'No change';
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

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
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
