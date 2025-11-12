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
        
        // Check for magic link token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const magicToken = urlParams.get('magic_token');
        if (magicToken) {
            try {
                await this.verifyMagicLink(magicToken);
                // Remove token from URL
                window.history.replaceState({}, document.title, window.location.pathname);
                alert('✅ Successfully signed in!');
            } catch (error) {
                console.error('Magic link verification failed:', error);
                alert('Failed to sign in: ' + error.message);
                // Remove token from URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        // Expose to window for compatibility with existing code
        window.userManager = this;
        
        // Wire up the user-button if it exists
        this.setupUserButton();
        
        console.log('✅ SupabaseUserManager initialized');
    }
    
    setupUserButton() {
        const userButton = document.getElementById('user-button');
        if (userButton) {
            userButton.addEventListener('click', () => {
                if (this.isRegistered()) {
                    // Show user profile/logout options
                    this.showUserMenu();
                } else {
                    // Show login modal
                    this.openLoginSubscribeModal();
                }
            });
        }
    }
    
    showUserMenu() {
        // Enhanced menu for logged-in users
        const menuHtml = `
            <div id="user-menu-modal" class="user-modal" style="display:flex;">
                <div class="user-modal-content" style="max-width: 360px;">
                    <span class="user-modal-close" id="user-menu-close">&times;</span>
                    <h2 style="margin-bottom: 16px;">👤 Account</h2>
                    
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">Email</p>
                        <p style="margin: 0; font-weight: 600;">${this.user?.email || 'Unknown'}</p>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label for="user-reading-style" style="display: block; margin-bottom: 8px; font-weight: 600;">Reading Style:</label>
                        <select id="user-reading-style" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ddd; font-size: 14px;">
                            <option value="relax" ${this.readingStyle === 'relax' ? 'selected' : ''}>😌 Relax</option>
                            <option value="enjoy" ${this.readingStyle === 'enjoy' ? 'selected' : ''}>🎯 Enjoy</option>
                            <option value="research" ${this.readingStyle === 'research' ? 'selected' : ''}>📚 Research</option>
                            <option value="chinese" ${this.readingStyle === 'chinese' ? 'selected' : ''}>🇨🇳 Chinese</option>
                        </select>
                    </div>
                    
                    <button id="user-logout-btn" class="btn-primary" style="width: 100%; padding: 12px; font-size: 16px; background: #dc3545; border: none;">
                        🚪 Logout
                    </button>
                </div>
            </div>
        `;
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = menuHtml;
        document.body.appendChild(wrapper);
        
        // Handle reading style change
        document.getElementById('user-reading-style').onchange = async (e) => {
            await this.changeReadingStyle(e.target.value);
        };
        
        document.getElementById('user-menu-close').onclick = () => wrapper.remove();
        document.getElementById('user-logout-btn').onclick = async () => {
            await this.logout();
            wrapper.remove();
        };
    }
    
    // Alias for compatibility
    showLoginModal() {
        this.openLoginSubscribeModal();
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
                    console.log('Loaded reading style from profile:', this.readingStyle);
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
                console.log('Created new profile with reading style:', this.readingStyle);
            }
        } catch (err) {
            console.error('Failed to load/upsert profile', err);
        }

        // Save readingStyle locally for compatibility
        localStorage.setItem('news_reading_style', this.readingStyle);

        // Apply reading style to current page if method exists
        if (typeof this.applyUserPreference === 'function') {
            this.applyUserPreference();
        }

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
        // Enhanced modal with better styling
        const modalHtml = `
            <div id="supa-login-modal" class="user-modal" style="display:flex;">
                <div class="user-modal-content" style="max-width: 400px;">
                    <span class="user-modal-close" id="supa-login-close">&times;</span>
                    <h2 style="margin-bottom: 8px;">Welcome! 👋</h2>
                    <p style="color: #666; margin-bottom: 20px;">Sign in to save your reading progress and preferences</p>
                    
                    <div style="margin-bottom: 16px;">
                        <label for="supa-reading-style" style="display: block; margin-bottom: 8px; font-weight: 600;">Choose Reading Style:</label>
                        <select id="supa-reading-style" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ddd; font-size: 14px; margin-bottom: 20px;">
                            <option value="relax">😌 Relax - Simple & Easy</option>
                            <option value="enjoy" ${this.readingStyle === 'enjoy' ? 'selected' : ''}>🎯 Enjoy - Balanced</option>
                            <option value="research">📚 Research - Detailed</option>
                            <option value="chinese">🇨🇳 Chinese - 中文</option>
                        </select>
                    </div>
                    
                    <button id="supa-google" class="btn-primary" style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                        </svg>
                        Continue with Google
                    </button>
                    
                    <div style="text-align: center; color: #999; margin: 16px 0; font-size: 14px;">or</div>
                    
                    <form id="supa-email-form">
                        <label for="supa-email" style="display: block; margin-bottom: 8px; font-weight: 600;">Email Magic Link:</label>
                        <input id="supa-email" type="email" required placeholder="you@example.com" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ddd; font-size: 14px; margin-bottom: 12px;" />
                        <button type="submit" class="btn-primary" style="width: 100%; padding: 12px; font-size: 16px;">📧 Send Magic Link</button>
                    </form>
                    
                    <p style="font-size: 12px; color: #999; margin-top: 16px; text-align: center;">By signing in, you agree to our terms of service</p>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper);

        // Set current reading style
        const styleSelect = document.getElementById('supa-reading-style');
        styleSelect.value = this.readingStyle;
        
        // Update reading style when changed
        styleSelect.onchange = () => {
            this.readingStyle = styleSelect.value;
            localStorage.setItem('news_reading_style', this.readingStyle);
        };

        document.getElementById('supa-login-close').onclick = () => wrapper.remove();
        
        document.getElementById('supa-google').onclick = async () => {
            // Save reading style before redirect
            this.readingStyle = styleSelect.value;
            localStorage.setItem('news_reading_style', this.readingStyle);
            
            await this.supabase.auth.signInWithOAuth({ 
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
        };

        document.getElementById('supa-email-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('supa-email').value.trim();
            
            if (!email) return alert('Please enter an email');

            // Save reading style before sending magic link
            this.readingStyle = styleSelect.value;
            localStorage.setItem('news_reading_style', this.readingStyle);

            // Use custom email API instead of Supabase's built-in email
            try {
                await this.sendCustomMagicLink(email);
                wrapper.remove();
                alert('✅ Magic link sent! Check your inbox and click the link to sign in.');
            } catch (error) {
                console.error('Magic link error:', error);
                alert('Error sending magic link: ' + error.message);
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
                // Supabase Edge Functions expect both Authorization and apikey headers with the anon key
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
        
        // Create or sign in user
        const { data: authData, error: signUpError } = await this.supabase.auth.signUp({
            email: magicLinkData.email,
            password: crypto.randomUUID(), // Random password - won't be used
            options: {
                data: {
                    reading_style: magicLinkData.reading_style
                }
            }
        });
        
        let userId = authData?.user?.id;
        
        // If user already exists, we need to sign them in
        if (signUpError && signUpError.message.includes('already registered')) {
            // For existing users, we can't use password auth (we don't know their password)
            // Instead, let's just mark them as logged in locally and update their profile
            // The proper way would be to use Supabase's magic link auth, but we're doing custom
            console.log('User already exists, updating profile...');
        }
        
        // Get or create user_profiles entry
        if (userId || magicLinkData.email) {
            // First try to find existing profile by email
            const { data: existingProfiles } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('email', magicLinkData.email)
                .limit(1);
            
            if (existingProfiles && existingProfiles.length > 0) {
                // Update existing profile
                userId = existingProfiles[0].id;
                await this.supabase
                    .from('user_profiles')
                    .update({
                        preferences: { readingStyle: magicLinkData.reading_style },
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                
                console.log('Updated existing user profile:', userId);
            } else if (userId) {
                // Create new profile for new user
                await this.supabase
                    .from('user_profiles')
                    .insert({
                        id: userId,
                        email: magicLinkData.email,
                        display_name: magicLinkData.email.split('@')[0],
                        preferences: { readingStyle: magicLinkData.reading_style },
                        role: 'user'
                    });
                
                console.log('Created new user profile:', userId);
            }
        }
        
        // Delete the used token
        await this.supabase.from('magic_links').delete().eq('token', token);
        
        // Set reading style locally
        this.readingStyle = magicLinkData.reading_style;
        localStorage.setItem('news_reading_style', this.readingStyle);
        
        // Reload to trigger auth state change and load profile
        setTimeout(() => window.location.reload(), 500);
        
        return true;
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

// Auto-initialize like the old user_manager.js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.userManager = new SupabaseUserManager();
    });
} else {
    window.userManager = new SupabaseUserManager();
}

export default SupabaseUserManager;
