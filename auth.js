// Authentication manager
class AuthManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw new Error(error.message);
            }

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                throw new Error(error.message);
            }

            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }

    async getCurrentUser() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                throw new Error(error.message);
            }

            return { success: true, user };
        } catch (error) {
            console.error('Get current user error:', error);
            return { success: false, error: error.message };
        }
    }

    async getSession() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                throw new Error(error.message);
            }

            return { success: true, session };
        } catch (error) {
            console.error('Get session error:', error);
            return { success: false, error: error.message };
        }
    }

    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // Utility method to check if user is authenticated
    isAuthenticated() {
        return this.supabase.auth.getUser().then(({ data: { user } }) => !!user);
    }

    // Method to refresh the session
    async refreshSession() {
        try {
            const { data, error } = await this.supabase.auth.refreshSession();
            
            if (error) {
                throw new Error(error.message);
            }

            return { success: true, session: data.session };
        } catch (error) {
            console.error('Refresh session error:', error);
            return { success: false, error: error.message };
        }
    }

    // Method to handle password reset
    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) {
                throw new Error(error.message);
            }

            return { success: true };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    }

    // Method to update password
    async updatePassword(newPassword) {
        try {
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw new Error(error.message);
            }

            return { success: true };
        } catch (error) {
            console.error('Update password error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export for use in other modules
window.AuthManager = AuthManager;
