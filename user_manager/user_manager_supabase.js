// Supabase-backed User Manager (module)
// Loads @supabase/supabase-js via ESM CDN and provides a compatible UserManager API

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

class SupabaseUserManager {
    constructor() {
        this.SUPABASE_URL = window.SUPABASE_URL || '';
        this.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
        this.supabase = null;
        this.user = null;
        this.profile = null; // user_profiles row
        this.readingStyle = 'enjoy';
        this.stats = {};

        this.init();
    }

    async init() {
        if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
            console.warn('Supabase credentials not set. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading the script.');
            return;
        }

        this.supabase = createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
            auth: { persistSession: true }
        });

        // Load stats from localStorage to preserve existing behavior
        this.loadStats();

        // Listen to auth changes
        this.supabase.auth.onAuthStateChange((_event, session) => {
            if (session && session.user) {
                this.onLogin(session.user);
            } else {
                this.onLogout();
            }
        });

        // Check current session
        const { data } = await this.supabase.auth.getSession();
        if (data && data.session && data.session.user) {
            await this.onLogin(data.session.user);
        }

        // Check for magic link token in URL (Supabase OTP)
        const urlParams = new URLSearchParams(window.location.search);
        const token_hash = urlParams.get('token_hash');
        const type = urlParams.get('type');
        
        if (token_hash && type === 'magiclink') {
            // Supabase will automatically verify the token
            // Apply the pending reading style if available
            const pendingStyle = localStorage.getItem('pending_reading_style');
            if (pendingStyle) {
                this.readingStyle = pendingStyle;
                localStorage.setItem('news_reading_style', pendingStyle);
                localStorage.removeItem('pending_reading_style');
                
                // Redirect to the selected reading style page
                const stylePages = {
                    'relax': '/?lang=en&level=easy',
                    'enjoy': '/?lang=en&level=middle',
                    'research': '/?lang=en&level=high',
                    'chinese': '/?lang=cn'
                };
                const redirectUrl = stylePages[pendingStyle] || '/';
                
                // Clean up URL parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                
                setTimeout(() => {
                    alert('✅ Successfully signed in! Redirecting to your preferred reading page...');
                    window.location.href = redirectUrl;
                }, 500);
            }
        }

        // Expose to window for compatibility with existing code
        window.userManager = this;
        console.log('✅ SupabaseUserManager initialized');
    }

    loadStats() {
        try {
            const statsJson = localStorage.getItem('news_stats');
            this.stats = statsJson ? JSON.parse(statsJson) : {};
        } catch (e) {
            this.stats = {};
        }
    }

    saveStats() {
        localStorage.setItem('news_stats', JSON.stringify(this.stats || {}));
    }

    isRegistered() {
        return !!this.user;
    }

    async onLogin(user) {
        this.user = user;
        // fetch or create profile
        try {
            const { data: profiles } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .limit(1);

            if (profiles && profiles.length) {
                this.profile = profiles[0];
                if (this.profile.preferences && this.profile.preferences.readingStyle) {
                    this.readingStyle = this.profile.preferences.readingStyle;
                }
            } else {
                // Insert a new profile (upsert)
                const newProfile = {
                    id: user.id,
                    email: user.email,
                    display_name: user.user_metadata?.full_name || user.email || null,
                    preferences: { readingStyle: this.readingStyle },
                    role: 'user'
                };
                const { data: inserted } = await this.supabase
                    .from('user_profiles')
                    .upsert(newProfile, { returning: 'representation' });

                if (inserted && inserted.length) this.profile = inserted[0];
            }
        } catch (err) {
            console.error('Failed to load/upsert profile', err);
        }

        // Save readingStyle locally for compatibility
        localStorage.setItem('news_reading_style', this.readingStyle);

        // If old code expects redirectToPreferredPage or applyUserPreference, keep method names
        if (typeof window.userManager !== 'undefined' && window.userManager !== this) {
            // overwrite global to this manager
            window.userManager = this;
        }

        // Optionally call any callback
        if (typeof this.onReady === 'function') this.onReady();
    }

    async onLogout() {
        this.user = null;
        this.profile = null;
        // keep readingStyle in localStorage so guest preferences persist
        console.log('User logged out');
    }

    async openLoginSubscribeModal() {
        // Simple modal offering Google and Email magic link
        const modalHtml = `
            <div id="supa-login-modal" class="user-modal" style="display:flex;">
                <div class="user-modal-content">
                    <span class="user-modal-close" id="supa-login-close">&times;</span>
                    <h2>Sign in</h2>
                    <p>Use Google or email magic link.</p>
                    <div style="display:flex;gap:8px;margin-bottom:12px;">
                        <button id="supa-google" class="btn-primary">Continue with Google</button>
                    </div>
                    <form id="supa-email-form">
                        <label for="supa-email">Email</label>
                        <input id="supa-email" type="email" required placeholder="you@example.com" />
                        <button type="submit" class="btn-primary">Send Magic Link</button>
                    </form>
                    <div style="margin-top:12px;">
                        <label for="supa-reading-style">Reading style</label>
                        <select id="supa-reading-style">
                            <option value="relax">Relax</option>
                            <option value="enjoy" selected>Enjoy</option>
                            <option value="research">Research</option>
                            <option value="chinese">Chinese</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper);

        document.getElementById('supa-login-close').onclick = () => wrapper.remove();
        document.getElementById('supa-google').onclick = async () => {
            const styleEl = document.getElementById('supa-reading-style');
            this.readingStyle = styleEl?.value || this.readingStyle;
            await this.supabase.auth.signInWithOAuth({ provider: 'google' });
            // Supabase will redirect to callback -- session handled in onAuthStateChange
        };

        document.getElementById('supa-email-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('supa-email').value.trim();
            const styleEl = document.getElementById('supa-reading-style');
            this.readingStyle = styleEl?.value || this.readingStyle;

            if (!email) return alert('Please enter an email');

            try {
                // Use Supabase's built-in magic link (now using your SMTP settings)
                const { error } = await this.supabase.auth.signInWithOtp({
                    email: email,
                    options: {
                        emailRedirectTo: window.location.origin,
                        data: {
                            reading_style: this.readingStyle
                        }
                    }
                });
                
                if (error) {
                    console.error('Supabase OTP error:', error);
                    throw new Error(error.message || 'Failed to send magic link');
                }
                
                // Store reading style preference for when user returns
                localStorage.setItem('pending_reading_style', this.readingStyle);
                
                alert('✅ Magic link sent! Check your inbox and click the link to sign in.');
                wrapper.remove();
            } catch (error) {
                console.error('Magic link error:', error);
                alert('❌ Error sending magic link: ' + error.message + '\n\nPlease verify SMTP settings in Supabase dashboard.');
            }
        };
    }

    async sendCustomMagicLink(email) {
        // Generate a random token
        const token = this.generateRandomToken(32);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Store token in Supabase table (works across devices/browsers)
        const { error: insertError } = await this.supabase
            .from('magic_links')
            .insert({
                token: token,
                email: email,
                reading_style: this.readingStyle,
                expires_at: expiresAt.toISOString()
            });
        
        if (insertError) {
            console.error('Failed to store magic link:', insertError);
            throw new Error('Failed to create magic link: ' + insertError.message);
        }
        
        // Create magic link URL
        const magicLinkUrl = `${window.location.origin}?magic_token=${token}`;
        
        // Send email via your custom API
        const sanitizedAnonKey = (this.SUPABASE_ANON_KEY || '').trim();
        const response = await fetch(`${this.SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sanitizedAnonKey}`,
                'apikey': sanitizedAnonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to_email: email,
                subject: 'Welcome! Sign in to News from 6ray.com',
                message: `Hello!\n\nClick the link below to sign in:\n\n${magicLinkUrl}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nNews from 6ray.com`,
                from_name: 'admin@6ray.com'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to send email');
        }
        
        return await response.json();
    }
    
    generateRandomToken(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            token += chars[array[i] % chars.length];
        }
        return token;
    }
    
    async verifyMagicLink(token) {
        // Get stored magic link data from Supabase
        const { data: magicLinks, error: fetchError } = await this.supabase
            .from('magic_links')
            .select('*')
            .eq('token', token)
            .limit(1);
        
        if (fetchError || !magicLinks || magicLinks.length === 0) {
            throw new Error('Invalid or expired magic link');
        }
        
        const magicLinkData = magicLinks[0];
        
        // Check if expired
        if (new Date(magicLinkData.expires_at) < new Date()) {
            // Delete expired token
            await this.supabase.from('magic_links').delete().eq('token', token);
            throw new Error('Magic link has expired');
        }
        
        // Set reading style from magic link
        this.readingStyle = magicLinkData.reading_style || 'enjoy';
        localStorage.setItem('news_reading_style', this.readingStyle);
        
        // Sign in the user with a temporary password
        // Note: Supabase will send a confirmation email unless you disable it in dashboard
        // Go to Authentication > Settings > Email Auth and disable "Enable email confirmations"
        const randomPassword = crypto.randomUUID();
        
        // Try to sign in first (for existing users)
        let authSuccess = false;
        const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
            email: magicLinkData.email,
            password: randomPassword
        });
        
        if (!signInError) {
            authSuccess = true;
        } else {
            // User doesn't exist or password wrong, try to sign up
            const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
                email: magicLinkData.email,
                password: randomPassword,
                options: {
                    data: {
                        reading_style: this.readingStyle
                    }
                }
            });
            
            if (!signUpError) {
                authSuccess = true;
            } else if (signUpError.message.includes('already registered')) {
                // User exists, try admin sign in or use the magic link to force login
                throw new Error('User exists but password mismatch. Please contact support.');
            } else {
                throw new Error('Failed to authenticate: ' + signUpError.message);
            }
        }
        
        // Delete the used token
        await this.supabase.from('magic_links').delete().eq('token', token);
        
        // Wait for auth state to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Return the reading style so caller can redirect
        return this.readingStyle;
    }

    async changeReadingStyle(newStyle) {
        this.readingStyle = newStyle;
        localStorage.setItem('news_reading_style', newStyle);

        if (this.profile && this.profile.id) {
            try {
                const { error } = await this.supabase.from('user_profiles').update({ preferences: { readingStyle: newStyle } }).eq('id', this.profile.id);
                if (error) console.error('Failed to update profile preferences', error);
            } catch (err) { console.error(err); }
        }
        // apply preference if needed by site
        if (typeof this.applyUserPreference === 'function') this.applyUserPreference();
    }

    async isAdmin() {
        if (!this.profile) return false;
        return this.profile.role === 'admin';
    }

    async logout() {
        await this.supabase.auth.signOut();
        // supabase will trigger onAuthStateChange
    }

    // Keep compatible method names used by pages
    async syncStats() {
        // Optional: send stats to a server endpoint or Supabase table
        if (!this.user) return alert('Please sign in to sync stats');

        try {
            const { error } = await this.supabase.from('user_stats').insert({ user_id: this.user.id, stats: this.stats });
            if (error) throw error;
            alert('✅ Stats synced');
        } catch (err) {
            console.error(err);
            alert('Failed to sync stats: ' + (err.message || err));
        }
    }
}

// Initialize when loaded as module
window.SupabaseUserManager = SupabaseUserManager;
// Create instance if global flags set
if (window.AUTO_INIT_SUPABASE_USER_MANAGER) {
    window.userManager = new SupabaseUserManager();
}

export default SupabaseUserManager;
