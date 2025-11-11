/**
 * User Manager - Frontend Client V2
 * Enhanced version with login/subscribe, dropdown menu, and auto-login
 * API: https://news.6ray.com/api/
 */

class UserManager {
    constructor() {
        this.apiBase = 'https://news.6ray.com/api';
        this.userId = null;
        this.userToken = null;
        this.userName = null;
        this.readingStyle = null;
        this.deviceId = null;
        this.stats = {};
        
        this.init();
    }
    
    /**
     * Initialize user manager
     */
    async init() {
        // Load user data from localStorage
        this.loadUserData();
        this.loadStats();
        
        // Get or generate device_id
        await this.ensureDeviceId();
        
        // Check if user arrived from email verification
        await this.checkVerificationStatus();
        
        // Initialize UI
        this.initializeUI();
        
        // Apply user preference to page
        if (this.isRegistered()) {
            this.applyUserPreference();
        }
    }
    
    /**
     * Ensure device_id exists
     */
    async ensureDeviceId() {
        this.deviceId = localStorage.getItem('news_device_id');
        
        if (!this.deviceId) {
            try {
                const response = await fetch(`${this.apiBase}/device/generate`);
                const data = await response.json();
                
                if (data.success && data.device_id) {
                    this.deviceId = data.device_id;
                    localStorage.setItem('news_device_id', this.deviceId);
                }
            } catch (error) {
                this.deviceId = `news-local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem('news_device_id', this.deviceId);
            }
        }
    }
    
    /**
     * Load user data from localStorage
     */
    loadUserData() {
        this.userId = localStorage.getItem('news_user_id');
        this.userToken = localStorage.getItem('news_user_token');
        this.userName = localStorage.getItem('news_user_name');
        this.readingStyle = localStorage.getItem('news_reading_style') || 'enjoy';
        this.deviceId = localStorage.getItem('news_device_id');
    }
    
    /**
     * Save user data to localStorage
     */
    saveUserData() {
        if (this.userId) localStorage.setItem('news_user_id', this.userId);
        if (this.userToken) localStorage.setItem('news_user_token', this.userToken);
        if (this.userName) localStorage.setItem('news_user_name', this.userName);
        if (this.readingStyle) localStorage.setItem('news_reading_style', this.readingStyle);
    }
    
    /**
     * Load stats from localStorage
     */
    loadStats() {
        const statsJson = localStorage.getItem('news_stats');
        this.stats = statsJson ? JSON.parse(statsJson) : {};
    }
    
    /**
     * Save stats to localStorage
     */
    saveStats() {
        localStorage.setItem('news_stats', JSON.stringify(this.stats));
    }
    
    /**
     * Check if user arrived from email verification link
     */
    async checkVerificationStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const verified = urlParams.get('verified');
        const token = urlParams.get('token');
        
        if (verified === 'true' && token) {
            // Auto-login after verification
            try {
                const response = await fetch(`${this.apiBase}/user/info`, {
                    headers: {
                        'X-User-Token': token
                    }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Save user data
                    this.userId = data.user_id;
                    this.userToken = token;
                    this.userName = data.name;
                    this.readingStyle = data.reading_style;
                    this.saveUserData();
                    
                    alert(`✅ Email verified! Welcome ${this.userName}!\n\nRedirecting to your preferred reading page...`);
                    
                    // Clean URL and redirect to preferred page
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setTimeout(() => {
                        this.redirectToPreferredPage();
                    }, 1000);
                    return; // Don't clean URL again below
                }
            } catch (error) {
                console.error('Auto-login failed:', error);
            }
            
            // Clean URL if auto-login failed
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    /**
     * Check if user is registered
     */
    isRegistered() {
        return !!(this.userId && this.userToken);
    }
    
    /**
     * Initialize UI elements
     */
    initializeUI() {
        console.log('🔧 Initializing UI...');
        
        // Create modals
        this.createLoginSubscribeModal();
        this.createUserDropdown();
        
        // Update user button
        this.updateUserButton();
        
        console.log('✅ UI initialized. Registered:', this.isRegistered());
    }
    
    /**
     * Update user button based on login status
     */
    updateUserButton() {
        const userBtn = document.getElementById('user-button');
        console.log('👤 User button found:', !!userBtn);
        
        if (!userBtn) {
            console.error('❌ User button not found! Cannot attach handlers.');
            return;
        }
        
        if (this.isRegistered()) {
            // Logged in - show name
            console.log('✅ User is registered:', this.userName);
            userBtn.innerHTML = `<span class="truncate text-sm px-2">${this.userName}</span>`;
            userBtn.className = 'flex min-w-[40px] max-w-[150px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-2 bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark text-sm font-bold leading-normal tracking-wide hover:bg-border-light dark:hover:bg-border-dark transition-colors';
            userBtn.title = `${this.userName} - Click for options`;
            userBtn.onclick = () => {
                console.log('🖱️ User name clicked, toggling dropdown');
                this.toggleUserDropdown();
            };
        } else {
            // Not logged in - show icon
            console.log('ℹ️ User not registered, showing login button');
            userBtn.innerHTML = '<span class="truncate">👤</span>';
            userBtn.className = 'flex min-w-[40px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-2 bg-primary text-white text-lg font-bold leading-normal tracking-wide shadow-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-background-dark';
            userBtn.title = 'User Account';
            userBtn.onclick = () => {
                console.log('🖱️ User icon clicked, opening login modal');
                this.openLoginSubscribeModal();
            };
        }
    }
    
    /**
     * Create login/subscribe modal
     */
    createLoginSubscribeModal() {
        const modalHtml = `
            <div id="login-subscribe-modal" class="user-modal" style="display: none;">
                <div class="user-modal-content">
                    <span class="user-modal-close">&times;</span>
                    <h2>👤 User Account</h2>
                    <p>Please choose an option:</p>
                    
                    <div class="choice-buttons">
                        <button class="btn-primary" id="show-login-form">📧 Login with Email</button>
                        <button class="btn-secondary" id="show-subscribe-form">✨ New Subscription</button>
                    </div>
                    
                    <!-- Login Form -->
                    <form id="login-form" style="display: none;">
                        <h3>Login with Email</h3>
                        <div class="form-group">
                            <label for="login-email">Email:</label>
                            <input type="email" id="login-email" required placeholder="your@email.com">
                        </div>
                        <div id="login-message" class="message"></div>
                        <button type="submit" class="btn-primary">Send Login Link</button>
                        <button type="button" class="btn-text" id="back-to-choice-1">← Back</button>
                    </form>
                    
                    <!-- Subscribe Form -->
                    <form id="subscribe-form" style="display: none;">
                        <h3>New Subscription</h3>
                        <div class="form-group">
                            <label for="sub-name">Name:</label>
                            <input type="text" id="sub-name" required placeholder="Your name">
                        </div>
                        <div class="form-group">
                            <label for="sub-email">Email:</label>
                            <input type="email" id="sub-email" required placeholder="your@email.com">
                        </div>
                        <div class="form-group">
                            <label for="sub-reading-style">Reading Style:</label>
                            <select id="sub-reading-style" required>
                                <option value="relax">Relax - Easy reading</option>
                                <option value="enjoy" selected>Enjoy - Balanced</option>
                                <option value="research">Research - Deep dive</option>
                                <option value="chinese">Chinese - 中文翻译</option>
                            </select>
                        </div>
                        <div id="subscribe-message" class="message"></div>
                        <button type="submit" class="btn-primary">Subscribe</button>
                        <button type="button" class="btn-text" id="back-to-choice-2">← Back</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Event listeners
        document.querySelector('#login-subscribe-modal .user-modal-close').onclick = () => this.closeLoginSubscribeModal();
        document.getElementById('show-login-form').onclick = () => this.showLoginForm();
        document.getElementById('show-subscribe-form').onclick = () => this.showSubscribeForm();
        document.getElementById('back-to-choice-1').onclick = () => this.showChoiceButtons();
        document.getElementById('back-to-choice-2').onclick = () => this.showChoiceButtons();
        document.getElementById('login-form').onsubmit = (e) => this.handleLogin(e);
        document.getElementById('subscribe-form').onsubmit = (e) => this.handleSubscribe(e);
    }
    
    /**
     * Create user dropdown menu
     */
    createUserDropdown() {
        const dropdownHtml = `
            <div id="user-dropdown" class="user-dropdown" style="display: none;">
                <div class="dropdown-item" id="change-style">
                    <span>📚 Change Reading Style</span>
                </div>
                <div class="dropdown-item" id="sync-stats">
                    <span>🔄 Sync to Server</span>
                </div>
                <div class="dropdown-item" id="delete-subscription">
                    <span>🗑️ Delete Subscription</span>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" id="logout">
                    <span>🚪 Logout</span>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', dropdownHtml);
        
        // Event listeners
        const logoutBtn = document.getElementById('logout');
        console.log('🔍 Logout button found:', !!logoutBtn);
        
        document.getElementById('change-style').onclick = () => this.showChangeStyleModal();
        document.getElementById('sync-stats').onclick = () => this.syncStats();
        document.getElementById('delete-subscription').onclick = () => this.deleteSubscription();
        
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                console.log('🖱️ Logout button clicked!');
                this.logout();
            };
            console.log('✅ Logout onclick handler attached');
        } else {
            console.error('❌ Logout button not found!');
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('user-dropdown');
            const userBtn = document.getElementById('user-button');
            // Check if click is outside both dropdown AND user button (including its children)
            if (dropdown && !dropdown.contains(e.target) && !userBtn.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
    
    /**
     * Toggle user dropdown
     */
    toggleUserDropdown() {
        console.log('📋 Toggling user dropdown...');
        const dropdown = document.getElementById('user-dropdown');
        const userBtn = document.getElementById('user-button');
        
        if (!dropdown) {
            console.error('❌ Dropdown element not found!');
            return;
        }
        
        console.log('Current dropdown display:', dropdown.style.display);
        
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            // Position dropdown below button
            const rect = userBtn.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + 5}px`;
            dropdown.style.right = `${window.innerWidth - rect.right}px`;
            dropdown.style.display = 'block';
            console.log('✅ Dropdown shown at', dropdown.style.top, dropdown.style.right);
            
            // Debug: Check actual dimensions and visibility
            setTimeout(() => {
                const dropdownRect = dropdown.getBoundingClientRect();
                console.log('📏 Dropdown dimensions:', {
                    width: dropdownRect.width,
                    height: dropdownRect.height,
                    left: dropdownRect.left,
                    top: dropdownRect.top,
                    visible: dropdownRect.width > 0 && dropdownRect.height > 0
                });
                console.log('🎨 Computed style:', {
                    display: window.getComputedStyle(dropdown).display,
                    zIndex: window.getComputedStyle(dropdown).zIndex,
                    opacity: window.getComputedStyle(dropdown).opacity
                });
            }, 100);
        } else {
            dropdown.style.display = 'none';
            console.log('✅ Dropdown hidden');
        }
    }
    
    openLoginSubscribeModal() {
        console.log('📧 Opening login/subscribe modal...');
        document.getElementById('login-subscribe-modal').style.display = 'flex';
        this.showChoiceButtons();
    }
    
    closeLoginSubscribeModal() {
        document.getElementById('login-subscribe-modal').style.display = 'none';
    }
    
    showChoiceButtons() {
        document.querySelector('.choice-buttons').style.display = 'flex';
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('subscribe-form').style.display = 'none';
    }
    
    showLoginForm() {
        document.querySelector('.choice-buttons').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    }
    
    showSubscribeForm() {
        document.querySelector('.choice-buttons').style.display = 'none';
        document.getElementById('subscribe-form').style.display = 'block';
    }
    
    /**
     * Handle login (send token recovery email)
     */
    async handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        
        if (!email) {
            this.showLoginMessage('❌ Please enter your email', 'error');
            return;
        }
        
        this.showLoginMessage('⏳ Logging in...', 'info');
        
        try {
            const response = await fetch(`${this.apiBase}/user/token`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned ${contentType || 'non-JSON'} response`);
            }
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Save user data
                this.userId = data.user_id;
                this.userToken = data.bootstrap_token;
                this.userName = data.name;
                this.readingStyle = data.reading_style;
                this.saveUserData();
                
                this.showLoginMessage('✅ Login successful! Redirecting to your preferred page...', 'success');
                
                // Redirect to user's preferred reading style page after showing message
                setTimeout(() => {
                    this.closeLoginSubscribeModal();
                    this.redirectToPreferredPage();
                }, 1500);
            } else {
                this.showLoginMessage(`❌ ${data.error || 'User not found'}`, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showLoginMessage(`❌ ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle new subscription
     */
    async handleSubscribe(event) {
        event.preventDefault();
        
        const formData = {
            name: document.getElementById('sub-name').value.trim(),
            email: document.getElementById('sub-email').value.trim(),
            reading_style: document.getElementById('sub-reading-style').value
        };
        
        this.showSubscribeMessage('⏳ Registering...', 'info');
        
        try {
            const response = await fetch(`${this.apiBase}/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Save user data
                this.userId = data.user_id;
                this.userToken = data.bootstrap_token;
                this.userName = formData.name;
                this.readingStyle = formData.reading_style;
                this.saveUserData();
                
                let message = '✅ Registration successful!';
                if (!data.bootstrap_failed) {
                    message += ' Check email to verify.';
                    this.showSubscribeMessage(message, 'success');
                    setTimeout(() => location.reload(), 2000);
                } else {
                    message += ' Redirecting to your preferred page...';
                    this.showSubscribeMessage(message, 'success');
                    this.closeLoginSubscribeModal();
                    setTimeout(() => {
                        this.redirectToPreferredPage();
                    }, 1500);
                }
            } else {
                this.showSubscribeMessage(`❌ ${data.error || 'Registration failed'}`, 'error');
            }
        } catch (error) {
            this.showSubscribeMessage(`❌ Network error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Show change reading style modal
     */
    showChangeStyleModal() {
        document.getElementById('user-dropdown').style.display = 'none';
        
        // Create style selection modal
        const styleModal = document.createElement('div');
        styleModal.className = 'user-modal';
        styleModal.style.display = 'flex';
        styleModal.innerHTML = `
            <div class="user-modal-content" style="max-width: 400px;">
                <span class="user-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2 style="margin-bottom: 20px; font-size: 24px; font-weight: 600;">Change Reading Style</h2>
                <p style="margin-bottom: 20px; color: #666;">Current: <strong>${this.readingStyle}</strong></p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="style-option-btn" data-style="relax" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                        <div style="font-weight: 600; margin-bottom: 4px;">😌 Relax</div>
                        <div style="font-size: 14px; color: #666;">Easy reading for learners</div>
                    </button>
                    <button class="style-option-btn" data-style="enjoy" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                        <div style="font-weight: 600; margin-bottom: 4px;">📖 Enjoy</div>
                        <div style="font-size: 14px; color: #666;">Balanced content</div>
                    </button>
                    <button class="style-option-btn" data-style="research" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                        <div style="font-weight: 600; margin-bottom: 4px;">🔬 Research</div>
                        <div style="font-size: 14px; color: #666;">Deep dive analysis</div>
                    </button>
                    <button class="style-option-btn" data-style="chinese" style="padding: 15px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                        <div style="font-weight: 600; margin-bottom: 4px;">🇨🇳 Chinese</div>
                        <div style="font-size: 14px; color: #666;">中文翻译</div>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(styleModal);
        
        // Add hover effects
        const btns = styleModal.querySelectorAll('.style-option-btn');
        btns.forEach(btn => {
            btn.onmouseover = () => {
                btn.style.borderColor = '#007bff';
                btn.style.background = '#f0f8ff';
            };
            btn.onmouseout = () => {
                btn.style.borderColor = '#ddd';
                btn.style.background = 'white';
            };
            btn.onclick = () => {
                const newStyle = btn.dataset.style;
                this.readingStyle = newStyle;
                this.saveUserData();
                this.applyUserPreference();
                styleModal.remove();
                alert(`✅ Reading style changed to: ${this.readingStyle}\n\nPage will reload.`);
                setTimeout(() => location.reload(), 1000);
            };
        });
    }
    
    /**
     * Apply user's reading preference to page
     */
    applyUserPreference() {
        if (!this.readingStyle) return;
        
        // Map reading style to level/language
        const styleMap = {
            'relax': 'Relax',
            'enjoy': 'Enjoy',
            'research': 'Research',
            'chinese': 'CN'
        };
        
        const targetLevel = styleMap[this.readingStyle];
        if (!targetLevel) return;
        
        // Note: Preferences are now applied via redirectToPreferredPage() after login
        // This function is kept for backward compatibility but doesn't manipulate the DOM
        console.log(`✓ Reading style: ${this.readingStyle}`);
    }
    
    /**
     * Redirect user to their preferred reading style page after login
     */
    redirectToPreferredPage() {
        if (!this.readingStyle) {
            location.reload();
            return;
        }
        
        const currentUrl = new URL(window.location.href);
        const isIndexPage = currentUrl.pathname === '/' || currentUrl.pathname.includes('index.html');
        
        // Only redirect if on index/main page
        if (!isIndexPage) {
            location.reload();
            return;
        }
        
        // Map reading style to URL parameters
        if (this.readingStyle === 'chinese') {
            // Redirect with CN language parameter (will be processed by <head> script)
            currentUrl.searchParams.set('lang', 'cn');
            window.location.href = currentUrl.toString();
        } else {
            // Set level based on style (relax=easy, enjoy=middle, research=high)
            const levelMap = {
                'relax': 'easy',
                'enjoy': 'middle',
                'research': 'high'
            };
            const level = levelMap[this.readingStyle];
            if (level) {
                currentUrl.searchParams.set('level', level);
                window.location.href = currentUrl.toString();
            } else {
                location.reload();
            }
        }
    }
    
    /**
     * Sync stats to server
     */
    async syncStats() {
        document.getElementById('user-dropdown').style.display = 'none';
        
        if (!confirm('Sync your activity to the server?')) return;
        
        try {
            const response = await fetch(`${this.apiBase}/user/sync-stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Token': this.userToken
                },
                body: JSON.stringify({ stats: this.stats })
            });
            
            if (response.ok) {
                alert('✅ Stats synced successfully!');
            } else {
                const data = await response.json();
                alert(`❌ Sync failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert(`❌ Network error: ${error.message}`);
        }
    }
    
    /**
     * Delete subscription
     */
    async deleteSubscription() {
        document.getElementById('user-dropdown').style.display = 'none';
        
        const confirmed = confirm(
            `⚠️ DELETE YOUR SUBSCRIPTION?\n\n` +
            `This will:\n` +
            `• Remove your account permanently\n` +
            `• Delete all your activity data\n` +
            `• Unsubscribe from emails\n` +
            `• Clear all local data\n\n` +
            `⚠️ THIS CANNOT BE UNDONE!\n\n` +
            `Type "DELETE" in the next prompt to confirm.`
        );
        
        if (!confirmed) return;
        
        const confirmText = prompt('Type DELETE (in capital letters) to confirm:');
        
        if (confirmText !== 'DELETE') {
            alert('❌ Deletion cancelled. Text did not match.');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/user/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Token': this.userToken
                },
                body: JSON.stringify({ confirm: 'DELETE' })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                alert('✅ Subscription deleted successfully.\n\nYou will be logged out.');
                
                // Clear all local data
                localStorage.removeItem('user_id');
                localStorage.removeItem('bootstrap_token');
                localStorage.removeItem('user_name');
                localStorage.removeItem('reading_style');
                localStorage.removeItem('device_id');
                
                // Clear all stats
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('word_') || key.startsWith('quiz_') || key.startsWith('article_read_')) {
                        localStorage.removeItem(key);
                    }
                });
                
                // Reload page
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                alert(`❌ Deletion failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert(`❌ Network error: ${error.message}`);
        }
    }
    
    /**
     * Logout
     */
    logout() {
        console.log('🚪 Logout clicked');
        
        const confirmed = confirm('Logout and clear local data?');
        console.log('🔍 User response to confirm:', confirmed);
        
        if (confirmed) {
            console.log('✅ User confirmed logout, clearing data...');
            
            // Hide dropdown first
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
            
            // Clear ALL localStorage immediately
            console.log('�️ Clearing localStorage...');
            localStorage.clear();
            sessionStorage.clear();
            
            console.log('📊 localStorage after clear:', Object.keys(localStorage).length, 'items');
            
            // OLD METHOD (keeping as backup):
            // Clear user data (correct keys without 'news_' prefix)
            // localStorage.removeItem('user_id');
            // localStorage.removeItem('bootstrap_token');
            // localStorage.removeItem('user_name');
            // localStorage.removeItem('reading_style');
            // localStorage.removeItem('device_id');
            
            // Clear language and level settings to prevent cross-contamination
            localStorage.removeItem('language');
            sessionStorage.removeItem('pendingLevel');
            
            // Clear all activity stats
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('word_') || key.startsWith('quiz_') || key.startsWith('article_read_')) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log('✅ All data cleared, reloading page...');
            
            // Force full page reload (bypass cache)
            window.location.href = window.location.href.split('?')[0];
        } else {
            console.log('❌ User cancelled logout');
        }
    }
    
    showLoginMessage(msg, type) {
        const el = document.getElementById('login-message');
        el.innerHTML = msg;
        el.className = `message message-${type}`;
        el.style.display = 'block';
    }
    
    showSubscribeMessage(msg, type) {
        const el = document.getElementById('subscribe-message');
        el.innerHTML = msg;
        el.className = `message message-${type}`;
        el.style.display = 'block';
    }
    
    /**
     * Track word completion
     */
    trackWordCompletion(articleId, wordId) {
        const key = `word_${articleId}_${wordId}`;
        this.stats[key] = { completed: true, timestamp: Date.now() };
        this.saveStats();
    }
    
    /**
     * Track quiz completion
     */
    trackQuizCompletion(articleId, score, total) {
        const key = `quiz_${articleId}`;
        this.stats[key] = {
            score: score,
            total: total,
            percentage: Math.round((score / total) * 100),
            timestamp: Date.now()
        };
        this.saveStats();
    }
    
    /**
     * Track article read
     */
    trackArticleRead(articleId) {
        const key = `read_${articleId}`;
        this.stats[key] = { read: true, timestamp: Date.now() };
        this.saveStats();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.userManager = new UserManager();
    });
} else {
    window.userManager = new UserManager();
}
