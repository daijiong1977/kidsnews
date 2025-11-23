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
                // First, generate OTP with Supabase (but don't send their email)
                const { data, error } = await this.supabase.auth.signInWithOtp({ 
                    email,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: window.location.origin
                    }
                });
                
                if (error) throw error;
                
                // Now send our custom email via edge function
                const magicLink = `${window.location.origin}?token=${data.session?.access_token || 'check-email'}`;
                
                const emailResponse = await fetch(`${this.SUPABASE_URL}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'apikey': this.SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        to_email: email,
                        subject: '🔐 Your Magic Link - NewsReader',
                        message: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #3b82f6;">Welcome to NewsReader!</h2>
                                <p>Click the button below to sign in to your account:</p>
                                <p style="margin: 30px 0;">
                                    <a href="${magicLink}" 
                                       style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                        Sign In to NewsReader
                                    </a>
                                </p>
                                <p style="color: #666; font-size: 14px;">
                                    Or copy this link: <br/>
                                    <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${magicLink}</code>
                                </p>
                                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                                    This link expires in 1 hour. If you didn't request this, please ignore this email.
                                </p>
                            </div>
                        `,
                        from_name: 'NewsReader'
                    })
                });
                
                if (!emailResponse.ok) {
                    const errorData = await emailResponse.json();
                    throw new Error(errorData.error || 'Failed to send email');
                }
                
                alert('✅ Magic link sent! Check your inbox.');
            } catch (error) {
                console.error('Email send error:', error);
                alert('❌ Error sending magic link: ' + error.message);
            }
        };
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
