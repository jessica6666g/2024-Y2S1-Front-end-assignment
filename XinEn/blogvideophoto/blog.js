// Unsplash API Integration for Blog Manager
class UnsplashImageManager {
    constructor() {
        // Your Unsplash API credentials - Replace with your actual keys from the dashboard
        this.accessKey = 'YOUR_ACCESS_KEY_HERE'; // Replace with your Access Key from Unsplash dashboard
        this.baseURL = 'https://api.unsplash.com';
        this.cache = new Map(); // Cache images to avoid repeated API calls
    }

    /**
     * Search for images on Unsplash based on query
     * @param {string} query - Search query
     * @param {number} count - Number of images to fetch (default: 1)
     * @returns {Promise<Array>} Array of image objects
     */
    async searchImages(query, count = 1) {
        // Check cache first
        const cacheKey = `${query}_${count}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `${this.baseURL}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
                {
                    headers: {
                        'Authorization': `Client-ID ${this.accessKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const images = data.results.map(photo => ({
                id: photo.id,
                url: photo.urls.regular,
                thumb: photo.urls.thumb,
                alt: photo.alt_description || query,
                photographer: photo.user.name,
                photographerUrl: photo.user.links.html,
                downloadUrl: photo.links.download_location,
                unsplashUrl: photo.links.html
            }));

            // Cache the results
            this.cache.set(cacheKey, images);
            return images;
        } catch (error) {
            console.error('Error fetching images from Unsplash:', error);
            return [];
        }
    }

    /**
     * Trigger download event (required by Unsplash API)
     * @param {string} downloadUrl - Download URL from image object
     */
    async triggerDownload(downloadUrl) {
        try {
            await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Client-ID ${this.accessKey}`
                }
            });
        } catch (error) {
            console.error('Error triggering download:', error);
        }
    }

    /**
     * Generate proper attribution HTML
     * @param {Object} image - Image object from Unsplash
     * @returns {string} HTML string for attribution
     */
    generateAttribution(image) {
        return `Photo by <a href="${image.photographerUrl}" target="_blank" rel="noopener">${image.photographer}</a> on <a href="${image.unsplashUrl}" target="_blank" rel="noopener">Unsplash</a>`;
    }

    /**
     * Extract relevant keywords from blog post title for better search
     * @param {string} title - Blog post title
     * @returns {string} Optimized search query
     */
    optimizeSearchQuery(title) {
        // Remove common words and focus on travel-related keywords
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'my', 'your'];
        const words = title.toLowerCase().split(' ');
        const filteredWords = words.filter(word => !stopWords.includes(word));
        
        // Add "malaysia" if it's not already in the title for better results
        if (!title.toLowerCase().includes('malaysia') && !title.toLowerCase().includes('malaysian')) {
            filteredWords.push('malaysia');
        }
        
        // Add "travel" for better travel-related results
        filteredWords.push('travel');
        
        return filteredWords.join(' ');
    }
}

// Enhanced Blog Manager Class with In-Memory Storage ONLY
class BlogManager {
    constructor() {
        // ALL DATA STORED IN MEMORY ONLY - NO localStorage
        this.posts = [];
        this.viewCounts = {};
        this.formDraft = null;
        
        this.currentEditIndex = null;
        this.currentPostType = '';
        this.currentPostId = '';
        this.unsplashManager = new UnsplashImageManager();
        this.loadingImages = new Set();
        this.selectedImageAttribution = null;
        this.autoSaveInterval = null;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing BlogManager...');
        await this.loadFloatingImages();
        this.renderPosts();
        this.setupEventListeners();
        this.updateStats();
        this.setupMobileMenu();
        this.loadStoredData();
        
        // Load dynamic images for existing posts
        await this.loadDynamicImagesForPosts();
        
        // Setup image suggestion for new posts
        this.setupImageSuggestion();
        
        // Setup enhanced auto-save
        this.setupEnhancedAutoSave();
        console.log('✅ BlogManager initialized successfully');
    }

    setupMobileMenu() {
        const bar = document.querySelector('.bar');
        const menu = document.querySelector('.menu');
        const closeBtn = document.querySelector('.close');
        const menuLinks = document.querySelectorAll('.menu ul li a');
        
        if (bar && menu) {
            bar.onclick = () => {
                menu.classList.add('active');
                document.body.classList.add('menu-open');
            };
        }
        
        if (closeBtn && menu) {
            closeBtn.onclick = () => {
                menu.classList.remove('active');
                document.body.classList.remove('menu-open');
            };
        }
        
        // Close menu when clicking on menu links
        menuLinks.forEach(link => {
            link.onclick = () => {
                if (menu) {
                    menu.classList.remove('active');
                    document.body.classList.remove('menu-open');
                }
            };
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (menu && menu.classList.contains('active') && 
                !menu.contains(e.target) && 
                bar && !bar.contains(e.target)) {
                menu.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu && menu.classList.contains('active')) {
                menu.classList.remove('active');
                document.body.classList.remove('menu-open');
            }
        });
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // CRITICAL: Check if all required elements exist
        const openModalBtn = document.getElementById('openModal');
        const blogForm = document.getElementById('blogForm');
        const closeButtons = document.querySelectorAll('.close');
        const cancelButton = document.querySelector('.btn-cancel');
        
        if (!openModalBtn) {
            console.error('❌ ERROR: openModal button not found!');
            return;
        }
        
        if (!blogForm) {
            console.error('❌ ERROR: blogForm not found!');
            return;
        }
        
        console.log('✅ All required elements found');
        
        // Setup event listeners with error handling
        openModalBtn.onclick = () => {
            console.log('📝 Opening create modal...');
            this.openCreateModal();
        };
        
        closeButtons.forEach(btn => {
            btn.onclick = () => {
                console.log('❌ Closing modal...');
                this.closeModals();
            };
        });
        
        if (cancelButton) {
            cancelButton.onclick = () => {
                console.log('🚫 Cancel button clicked');
                this.closeModals();
            };
        }
        
        // FIXED: Form submit handler with detailed logging
        blogForm.addEventListener('submit', (e) => {
            console.log('🚀 FORM SUBMIT EVENT TRIGGERED!');
            console.log('Event object:', e);
            this.handleSubmit(e);
        });
        
        // Setup other event listeners with null checks
        const postImage = document.getElementById('postImage');
        const removeImage = document.getElementById('removeImage');
        const postExcerpt = document.getElementById('postExcerpt');
        const searchInput = document.getElementById('searchInput');
        const sortSelect = document.getElementById('sortSelect');
        
        if (postImage) {
            postImage.onchange = (e) => this.handleImageUpload(e);
        }
        
        if (removeImage) {
            removeImage.onclick = () => this.removeImage();
        }
        
        if (postExcerpt) {
            postExcerpt.oninput = (e) => this.updateWordCount(e);
        }
        
        if (searchInput) {
            searchInput.oninput = (e) => this.handleSearch(e);
        }
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = (e) => this.handleFilter(e);
        });
        
        if (sortSelect) {
            sortSelect.onchange = (e) => this.handleSort(e);
        }
        
        // Window click handler for modal close
        window.onclick = (e) => { 
            if (e.target.classList.contains('modal')) {
                this.closeModals(); 
            }
        };
        
        // Setup enhanced auto-save for form inputs
        this.setupFormAutoSave();
        
        console.log('✅ Event listeners setup complete');
    }

    /**
     * Enhanced auto-save functionality with real-time saving
     */
    setupEnhancedAutoSave() {
        // Save every 2 seconds while user is typing
        this.autoSaveInterval = setInterval(() => {
            if (this.currentEditIndex === null) { // Only for new posts
                this.saveFormDraft();
            }
        }, 2000);
        
        // Warning before page unload/refresh to prevent data loss
        window.addEventListener('beforeunload', (e) => {
            if (this.currentEditIndex === null && this.hasUnsavedChanges()) {
                // Show browser warning about unsaved changes
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        // Save on page visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.currentEditIndex === null) {
                this.saveFormDraft();
            }
        });
    }

    setupFormAutoSave() {
        const formFields = ['authorName', 'postCategory', 'postTitle', 'postExcerpt', 'postTags'];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Save data when user types (with debouncing)
                let saveTimeout;
                field.oninput = (e) => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        if (this.currentEditIndex === null) {
                            this.saveFormDraft();
                        }
                    }, 500);
                    
                    if (fieldId === 'postExcerpt') this.updateWordCount(e);
                };
                
                field.onchange = () => {
                    if (this.currentEditIndex === null) {
                        this.saveFormDraft();
                    }
                };
                
                // Save on focus out
                field.onblur = () => {
                    if (this.currentEditIndex === null) {
                        this.saveFormDraft();
                    }
                };
            }
        });
    }

    saveFormDraft() {
        // Only save draft for new posts, not edits
        if (this.currentEditIndex !== null) return;
        
        const formData = {
            authorName: document.getElementById('authorName')?.value || '',
            postCategory: document.getElementById('postCategory')?.value || '',
            postTitle: document.getElementById('postTitle')?.value || '',
            postExcerpt: document.getElementById('postExcerpt')?.value || '',
            postTags: document.getElementById('postTags')?.value || '',
            savedAt: new Date().toISOString(),
            selectedImageAttribution: this.selectedImageAttribution
        };
        
        // Also save image if it exists
        const imagePreview = document.getElementById('previewImg');
        if (imagePreview && imagePreview.src && !imagePreview.src.includes('data:')) {
            formData.previewImageSrc = imagePreview.src;
        }
        
        // Store in memory ONLY - NO localStorage (not supported in Claude.ai)
        this.formDraft = formData;
        
        // Try to use sessionStorage if available (for local development)
        if (typeof Storage !== 'undefined' && window.sessionStorage) {
            try {
                sessionStorage.setItem('blogFormDraft', JSON.stringify(formData));
                console.log('📁 Draft saved to sessionStorage');
            } catch (e) {
                console.log('⚠️ SessionStorage not available, using memory only');
            }
        }
        
        // Show subtle save indicator
        this.showSaveIndicator();
    }

    showSaveIndicator() {
        let indicator = document.getElementById('autoSaveIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autoSaveIndicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: #10b981;
                color: white;
                padding: 5px 15px;
                border-radius: 15px;
                font-size: 12px;
                z-index: 10001;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            indicator.innerHTML = '<i class="fas fa-check"></i> Draft saved';
            document.body.appendChild(indicator);
        }
        
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 1500);
    }

    loadFormDraft() {
        // First try to load from sessionStorage if available
        if (typeof Storage !== 'undefined' && window.sessionStorage) {
            try {
                const savedData = sessionStorage.getItem('blogFormDraft');
                if (savedData) {
                    const formData = JSON.parse(savedData);
                    this.formDraft = formData; // Update memory version too
                }
            } catch (e) {
                console.log('⚠️ Could not load from sessionStorage');
            }
        }
        
        if (this.formDraft) {
            try {
                const formData = this.formDraft;
                
                // Check if draft is not too old (7 days)
                const savedDate = new Date(formData.savedAt);
                const now = new Date();
                const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);
                
                if (daysDiff > 7) {
                    this.clearFormDraft();
                    return false;
                }
                
                // Load saved values into form fields
                Object.keys(formData).forEach(key => {
                    if (key !== 'savedAt' && key !== 'selectedImageAttribution' && key !== 'previewImageSrc') {
                        const field = document.getElementById(key);
                        if (field && formData[key]) {
                            field.value = formData[key];
                        }
                    }
                });
                
                // Restore image attribution
                if (formData.selectedImageAttribution) {
                    this.selectedImageAttribution = formData.selectedImageAttribution;
                }
                
                // Restore image preview if exists
                if (formData.previewImageSrc) {
                    this.showImagePreview(formData.previewImageSrc);
                }
                
                // Update word count for excerpt
                if (formData.postExcerpt) {
                    this.updateWordCount({ target: { value: formData.postExcerpt } });
                }
                
                // Show notification that draft was restored
                const savedTime = new Date(formData.savedAt).toLocaleString();
                this.showNotification(`Draft restored from ${savedTime}`, 'success');
                
                return true;
            } catch (error) {
                console.error('Error loading form draft:', error);
                this.clearFormDraft();
            }
        }
        return false;
    }

    clearFormDraft() {
        this.formDraft = null;
        this.selectedImageAttribution = null;
        
        // Also clear from sessionStorage if available
        if (typeof Storage !== 'undefined' && window.sessionStorage) {
            try {
                sessionStorage.removeItem('blogFormDraft');
                console.log('📁 Draft cleared from sessionStorage');
            } catch (e) {
                console.log('⚠️ Could not clear sessionStorage');
            }
        }
    }

    openCreateModal() {
        console.log('📝 Opening create modal...');
        this.currentEditIndex = null;
        
        const modalTitle = document.getElementById('modalTitle');
        const submitText = document.getElementById('submitText');
        const blogForm = document.getElementById('blogForm');
        
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Create New Post';
        if (submitText) submitText.textContent = 'Publish';
        if (blogForm) blogForm.reset();
        
        this.hideImagePreview();
        
        // Try to load saved draft
        const draftLoaded = this.loadFormDraft();
        
        // If no draft loaded, update word count for empty form
        if (!draftLoaded) {
            this.updateWordCount({ target: { value: '' } });
        }
        
        // Hide image suggestions when opening modal
        const suggestionContainer = document.getElementById('imageSuggestions');
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
        }
        
        const postModal = document.getElementById('postModal');
        if (postModal) {
            postModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        // Focus on first field
        setTimeout(() => {
            const authorField = document.getElementById('authorName');
            if (authorField) {
                authorField.focus();
            }
        }, 100);
        
        console.log('✅ Create modal opened');
    }

    openEditModal(index) {
        this.currentEditIndex = index;
        const post = this.posts[index];
        
        if (!post) return;
        
        // Clear any draft when editing existing post
        this.clearFormDraft();
        
        const modalTitle = document.getElementById('modalTitle');
        const submitText = document.getElementById('submitText');
        const authorName = document.getElementById('authorName');
        const postCategory = document.getElementById('postCategory');
        const postTitle = document.getElementById('postTitle');
        const postExcerpt = document.getElementById('postExcerpt');
        const postTags = document.getElementById('postTags');
        const postImage = document.getElementById('postImage');
        
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Post';
        if (submitText) submitText.textContent = 'Update';
        if (authorName) authorName.value = post.author || '';
        if (postCategory) postCategory.value = post.category || '';
        if (postTitle) postTitle.value = post.title || '';
        if (postExcerpt) postExcerpt.value = post.excerpt || '';
        if (postTags) postTags.value = (post.tags || []).join(', ');
        
        if (post.image) {
            this.showImagePreview(post.image);
            if (postImage) postImage.required = false;
        } else {
            this.hideImagePreview();
            if (postImage) postImage.required = true;
        }
        
        // Hide image suggestions when editing
        const suggestionContainer = document.getElementById('imageSuggestions');
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
        }
        
        this.updateWordCount({ target: { value: post.excerpt || '' } });
        
        const postModal = document.getElementById('postModal');
        if (postModal) {
            postModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    closeModals() {
        console.log('❌ Closing modals...');
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        document.body.style.overflow = 'auto';
        
        const postImageInput = document.getElementById('postImage');
        if (postImageInput) {
            postImageInput.required = true;
        }
        
        this.currentEditIndex = null;
        
        // Hide image suggestions when closing modal
        const suggestionContainer = document.getElementById('imageSuggestions');
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
        }
        
        // Clear auto-save interval if modal is closed
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // CRITICAL FIX: Enhanced form submit handler with detailed debugging
    handleSubmit(e) {
        console.log('🚀 HANDLE SUBMIT CALLED!');
        console.log('Event preventDefault called');
        e.preventDefault();
        
        console.log('📋 Starting form validation...');
        if (!this.validateForm()) {
            console.log('❌ Form validation failed');
            return;
        }
        
        console.log('✅ Form validation passed');
        
        const formData = new FormData(e.target);
        console.log('📄 FormData created:', formData);
        
        const imageFile = formData.get('postImage');
        console.log('🖼️ Image file:', imageFile);
        
        if (imageFile && imageFile.size > 0) {
            console.log('📸 Processing image file...');
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                console.log('📸 Image loaded, creating post data...');
                const postData = this.createPostData(formData, readerEvent.target.result);
                console.log('📄 Post data created:', postData);
                
                if (this.currentEditIndex !== null) {
                    console.log('✏️ Updating existing post...');
                    this.updatePost(this.currentEditIndex, postData);
                } else {
                    console.log('➕ Creating new post...');
                    this.createPost(postData);
                }
                this.closeModals();
            };
            
            reader.onerror = (error) => {
                console.error('❌ Error reading image file:', error);
                const formError = document.getElementById('formError');
                if (formError) formError.textContent = 'Error reading image file.';
            };
            
            reader.readAsDataURL(imageFile);
        } else if (this.currentEditIndex !== null) {
            console.log('✏️ Updating post without new image...');
            const postData = this.createPostData(formData);
            if (this.posts[this.currentEditIndex] && this.posts[this.currentEditIndex].image) {
                postData.image = this.posts[this.currentEditIndex].image;
            }
            this.updatePost(this.currentEditIndex, postData);
            this.closeModals();
        } else {
            console.log('❌ No image provided for new post');
            const formError = document.getElementById('formError');
            if (formError) formError.textContent = 'Please select an image file.';
        }
    }

    createPostData(formData, image = null) {
        console.log('📄 Creating post data from form...');
        const postData = {
            author: formData.get('authorName')?.trim() || '',
            category: formData.get('postCategory') || '',
            title: formData.get('postTitle')?.trim() || '',
            image: image,
            excerpt: formData.get('postExcerpt')?.trim() || '',
            content: formData.get('postContent')?.trim() || formData.get('postExcerpt')?.trim() || '',
            tags: (formData.get('postTags') || '').split(',').map(tag => tag.trim()).filter(tag => tag),
            date: new Date().toISOString(),
            views: 0
        };
        
        console.log('📄 Post data created:', postData);
        return postData;
    }

    validateForm() {
        console.log('🔍 Validating form...');
        const errorDiv = document.getElementById('formError');
        if (errorDiv) {
            errorDiv.textContent = '';
        }
        
        const requiredFields = ['authorName', 'postCategory', 'postTitle', 'postExcerpt'];
        
        for (let fieldId of requiredFields) {
            const input = document.getElementById(fieldId);
            if (!input) {
                console.error(`❌ Field ${fieldId} not found!`);
                if (errorDiv) errorDiv.textContent = `Field ${fieldId} not found.`;
                return false;
            }
            
            if (!input.value.trim()) {
                const label = input.labels?.[0]?.textContent || fieldId;
                console.log(`❌ Field ${fieldId} is empty`);
                if (errorDiv) errorDiv.textContent = `${label} is required.`;
                return false;
            }
        }
        
        // NO WORD COUNT LIMIT - just check that excerpt exists
        const excerptField = document.getElementById('postExcerpt');
        if (excerptField && !excerptField.value.trim()) {
            console.log('❌ Excerpt is empty');
            if (errorDiv) errorDiv.textContent = 'Post excerpt is required.';
            return false;
        }
        
        // Image validation for new posts
        if (this.currentEditIndex === null) {
            const imageFile = document.getElementById('postImage')?.files[0];
            if (!imageFile) {
                console.log('❌ No image file selected');
                if (errorDiv) errorDiv.textContent = 'Featured image is required.';
                return false;
            }
            if (!this.validateImageFile(imageFile)) {
                console.log('❌ Image file validation failed');
                return false;
            }
        } else {
            const imageFile = document.getElementById('postImage')?.files[0];
            if (imageFile && !this.validateImageFile(imageFile)) {
                console.log('❌ Image file validation failed');
                return false;
            }
        }
        
        console.log('✅ Form validation successful');
        return true;
    }

    validateImageFile(file) {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            const formError = document.getElementById('formError');
            if (formError) formError.textContent = 'Please upload PNG or JPG only.';
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            const formError = document.getElementById('formError');
            if (formError) formError.textContent = 'Image must be less than 5MB.';
            return false;
        }
        return true;
    }

    createPost(postData) {
        console.log('➕ Creating new post:', postData);
        
        // Add attribution if image was selected from Unsplash
        if (this.selectedImageAttribution) {
            postData.imageAttribution = this.selectedImageAttribution;
            this.selectedImageAttribution = null; // Clear after use
        }
        
        this.posts.unshift(postData);
        this.renderPosts();
        this.updateStats();
        this.showNotification('Post published successfully!', 'success');
        
        // Clear form draft after successful publish
        this.clearFormDraft();
        
        console.log('✅ Post created successfully');
        
        // RESTful API Demo - Create post via API
        if (window.apiManager) {
            apiManager.createPost({
                title: postData.title,
                body: postData.excerpt,
                userId: 1
            });
        }
    }

    updatePost(index, postData) {
        if (!this.posts[index]) return;
        
        const existingPost = this.posts[index];
        this.posts[index] = { 
            ...existingPost, 
            ...postData,
            views: existingPost.views || 0,
            dateEdited: new Date().toISOString()
        };
        this.renderPosts();
        this.showNotification('Post updated successfully!', 'success');
    }

    deletePost(index) {
        if (!this.posts[index]) return;
        
        const post = this.posts[index];
        if (confirm(`Are you sure you want to delete "${post.title}"?`)) {
            this.posts.splice(index, 1);
            this.renderPosts();
            this.updateStats();
            this.showNotification('Post deleted successfully!', 'error');
        }
    }

    renderPosts() {
        const container = document.getElementById('userPostsContainer');
        if (!container) {
            console.error('❌ userPostsContainer not found!');
            return;
        }
        
        if (this.posts.length === 0) { 
            container.innerHTML = ''; 
            return; 
        }
        
        container.innerHTML = this.posts.map((post, index) => {
            const editedText = post.dateEdited ? ' (edited)' : '';
            const displayDate = post.dateEdited ? this.formatDate(post.dateEdited) : this.formatDate(post.date);
            
            return `
            <article class="blog-post user-post" data-category="${post.category || ''}" data-id="${index}" data-date="${post.date}">
                <div class="post-image">
                    <img src="${post.image || ''}" alt="${this.escapeHtml(post.title || '')}">
                    <div class="post-category">${this.capitalizeFirst(post.category || '')}</div>
                    <div class="post-date">${displayDate}${editedText}</div>
                </div>
                <div class="post-content">
                    <h3>${this.escapeHtml(post.title || '')}</h3>
                    <div class="post-meta">
                        <span><i class="fas fa-user"></i> ${this.escapeHtml(post.author || '')}</span>
                        <span><i class="fas fa-clock"></i> ${this.calculateReadTime(post.content || post.excerpt || '')} min</span>
                        <span><i class="fas fa-eye"></i> <span class="view-count">${post.views || 0}</span> views</span>
                    </div>
                    <p class="post-excerpt">${this.escapeHtml(post.excerpt || '')}</p>
                    <div class="post-tags">${(post.tags || []).map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}</div>
                    ${post.imageAttribution ? `<div class="unsplash-attribution">${this.unsplashManager.generateAttribution(post.imageAttribution)}</div>` : ''}
                    <div class="post-actions">
                        <button class="btn-read" onclick="blogManager.openPostDetail(this, 'user')">Read Full Post</button>
                    </div>
                    <div class="admin-actions">
                        <button class="btn-edit" onclick="blogManager.openEditModal(${index})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="blogManager.deletePost(${index})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </article>
            `;
        }).join('');
    }

    handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.blog-post').forEach(post => {
            const title = post.querySelector('h3')?.textContent.toLowerCase() || '';
            const content = post.querySelector('.post-excerpt')?.textContent.toLowerCase() || '';
            const author = post.querySelector('.post-meta span')?.textContent.toLowerCase() || '';
            post.style.display = (title.includes(searchTerm) || content.includes(searchTerm) || author.includes(searchTerm)) ? 'block' : 'none';
        });
    }

    handleFilter(e) {
        const filterValue = e.target.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.blog-post').forEach(post => {
            post.style.display = (filterValue === 'all' || post.dataset.category === filterValue) ? 'block' : 'none';
        });
    }

    handleSort(e) {
        const sortValue = e.target.value;
        const userContainer = document.getElementById('userPostsContainer');
        const defaultContainer = document.getElementById('defaultPostsContainer');
        
        if (!userContainer || !defaultContainer) return;
        
        // Get all posts from both containers
        const userPosts = [...userContainer.children];
        const defaultPosts = [...defaultContainer.children];
        const allPosts = [...userPosts, ...defaultPosts];
        
        if (allPosts.length === 0) return; // No posts to sort
        
        // Add date attributes to default posts if they don't have them
        defaultPosts.forEach(post => {
            if (!post.dataset.date) {
                const dateText = post.querySelector('.post-date')?.textContent;
                if (dateText) {
                    post.dataset.date = this.convertDateTextToISO(dateText);
                }
            }
        });
        
        allPosts.sort((a, b) => {
            switch (sortValue) {
                case 'newest': 
                    const dateA = new Date(a.dataset.date || 0);
                    const dateB = new Date(b.dataset.date || 0);
                    return dateB - dateA;
                case 'oldest': 
                    const dateA2 = new Date(a.dataset.date || 0);
                    const dateB2 = new Date(b.dataset.date || 0);
                    return dateA2 - dateB2;
                case 'title': 
                    const titleA = a.querySelector('h3')?.textContent || '';
                    const titleB = b.querySelector('h3')?.textContent || '';
                    return titleA.localeCompare(titleB);
                default: 
                    return 0;
            }
        });
        
        // Clear both containers
        userContainer.innerHTML = '';
        defaultContainer.innerHTML = '';
        
        // Add sorted posts back to the default container
        allPosts.forEach(post => defaultContainer.appendChild(post));
    }
    
    convertDateTextToISO(dateText) {
        // Convert "Aug 16, 2024" format to ISO date
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const parts = dateText.replace(',', '').split(' ');
        if (parts.length === 3) {
            const month = months[parts[0]];
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            if (month) {
                return `${year}-${month}-${day}T00:00:00.000Z`;
            }
        }
        
        return new Date().toISOString(); // fallback
    }

    updateStats() {
        const totalPostsElement = document.getElementById('totalPosts');
        if (totalPostsElement) {
            totalPostsElement.textContent = this.posts.length + 13;
        }
    }

    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            if (!this.validateImageFile(file)) { 
                e.target.value = ''; 
                return; 
            }
            const reader = new FileReader();
            reader.onload = (e) => this.showImagePreview(e.target.result);
            reader.onerror = (error) => {
                console.error('Error reading image:', error);
            };
            reader.readAsDataURL(file);
        }
    }

    showImagePreview(imageSrc) {
        const previewImg = document.getElementById('previewImg');
        const imagePreview = document.getElementById('imagePreview');
        
        if (previewImg && imagePreview) {
            previewImg.src = imageSrc;
            imagePreview.style.display = 'block';
        }
        
        // Hide image suggestions when showing preview
        const suggestionContainer = document.getElementById('imageSuggestions');
        if (suggestionContainer) {
            suggestionContainer.style.display = 'none';
        }
    }

    hideImagePreview() {
        const imagePreview = document.getElementById('imagePreview');
        const postImage = document.getElementById('postImage');
        
        if (imagePreview) {
            imagePreview.style.display = 'none';
        }
        if (postImage) {
            postImage.value = '';
        }
    }

    removeImage() { 
        this.hideImagePreview(); 
        this.selectedImageAttribution = null;
    }

    updateWordCount(e) {
        const text = e.target.value.trim();
        const words = text.length > 0 ? text.split(/\s+/).filter(word => word.length > 0) : [];
        const wordCount = words.length;
        const counter = document.getElementById('excerptCounter');
        
        if (counter) {
            counter.textContent = `${wordCount} words`;
            // Always green - no limits or restrictions
            counter.style.color = '#059669';
        }
    }

    openPostDetail(element, type) {
        const post = element.closest('.blog-post');
        if (!post) return;
        
        const postId = post.dataset.id;
        this.currentPostType = type; 
        this.currentPostId = postId;
        
        if (type === 'user') {
            if (this.posts[postId]) {
                this.posts[postId].views = (this.posts[postId].views || 0) + 1;
                const viewCountElement = post.querySelector('.view-count');
                if (viewCountElement) {
                    viewCountElement.textContent = this.posts[postId].views;
                }
                
                // Show full content for user posts
                const fullContent = this.posts[postId].content || this.posts[postId].excerpt || '';
                const detailContent = document.getElementById('detailContent');
                if (detailContent) {
                    detailContent.innerHTML = this.formatContentWithParagraphs(fullContent);
                }
            }
        } else {
            const viewKey = `${type}_${postId}_views`;
            const currentViews = parseInt(this.viewCounts[viewKey] || '0');
            const newViews = currentViews + 1;
            this.viewCounts[viewKey] = newViews;
            const viewCountElement = post.querySelector('.view-count');
            if (viewCountElement) {
                viewCountElement.textContent = newViews;
            }
            
            // Show excerpt for default posts
            const detailContent = document.getElementById('detailContent');
            const postExcerpt = post.querySelector('.post-excerpt');
            if (detailContent && postExcerpt) {
                detailContent.textContent = postExcerpt.textContent;
            }
        }
        
        // Update modal content
        const detailTitle = document.getElementById('detailTitle');
        const detailImage = document.getElementById('detailImage');
        const detailAuthor = document.getElementById('detailAuthor');
        const detailDate = document.getElementById('detailDate');
        const detailCategory = document.getElementById('detailCategory');
        const detailTags = document.getElementById('detailTags');
        
        const h3 = post.querySelector('h3');
        const img = post.querySelector('img');
        const metaSpan = post.querySelector('.post-meta span');
        const dateSpan = post.querySelector('.post-date');
        const categoryDiv = post.querySelector('.post-category');
        const tags = post.querySelectorAll('.post-tags .tag');
        
        if (detailTitle && h3) detailTitle.textContent = h3.textContent;
        if (detailImage && img) detailImage.src = img.src;
        if (detailAuthor && metaSpan) detailAuthor.innerHTML = metaSpan.innerHTML;
        if (detailDate && dateSpan) detailDate.innerHTML = `<i class="fas fa-calendar"></i> ${dateSpan.textContent}`;
        if (detailCategory && categoryDiv) detailCategory.innerHTML = `<i class="fas fa-tag"></i> ${categoryDiv.textContent}`;
        
        if (detailTags) {
            const tagsHtml = Array.from(tags).map(tag => tag.outerHTML).join('');
            detailTags.innerHTML = tagsHtml;
        }
        
        const postDetailModal = document.getElementById('postDetailModal');
        if (postDetailModal) {
            postDetailModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    formatContentWithParagraphs(content) {
        // Split content by line breaks and create paragraphs
        return content.split('\n\n').map(paragraph => 
            paragraph.trim() ? `<p>${this.escapeHtml(paragraph.trim())}</p>` : ''
        ).join('');
    }

    loadStoredData() {
        // Keep view counts in memory only - no localStorage
        document.querySelectorAll('#defaultPostsContainer .blog-post').forEach(post => {
            const postId = post.dataset.id;
            const viewKey = `default_${postId}_views`;
            const savedViews = this.viewCounts[viewKey] || 0;
            const viewCountElement = post.querySelector('.view-count');
            if (viewCountElement) {
                viewCountElement.textContent = savedViews;
            }
        });
    }

    async loadFloatingImages() {
        // Skip Unsplash loading for now to avoid API issues
        console.log('📸 Loading floating images skipped for stability...');
    }

    async loadDynamicImagesForPosts() {
        // Skip dynamic loading for now
        console.log('🖼️ Dynamic image loading skipped for debugging');
    }

    setupImageSuggestion() {
        // Skip for now
        console.log('💡 Image suggestion setup skipped for debugging');
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (error) {
            return 'Invalid Date';
        }
    }

    calculateReadTime(content) {
        if (!content) return 1;
        return Math.max(1, Math.ceil(content.split(' ').length / 200));
    }

    capitalizeFirst(str) { 
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type) {
        console.log(`📢 Notification: ${message} (${type})`);
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
        
        // Add CSS styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => { 
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    clearFormAndDraft() {
        if (confirm('Are you sure you want to clear all form data and saved draft? This cannot be undone.')) {
            const blogForm = document.getElementById('blogForm');
            if (blogForm) {
                blogForm.reset();
            }
            
            this.hideImagePreview();
            this.updateWordCount({ target: { value: '' } });
            this.clearFormDraft();
            this.selectedImageAttribution = null;
            
            const suggestionContainer = document.getElementById('imageSuggestions');
            if (suggestionContainer) {
                suggestionContainer.style.display = 'none';
            }
            
            this.showNotification('Form and draft cleared successfully', 'success');
        }
    }

    // Helper method to check if there are unsaved changes
    hasUnsavedChanges() {
        const authorName = document.getElementById('authorName')?.value || '';
        const postCategory = document.getElementById('postCategory')?.value || '';
        const postTitle = document.getElementById('postTitle')?.value || '';
        const postExcerpt = document.getElementById('postExcerpt')?.value || '';
        const postTags = document.getElementById('postTags')?.value || '';
        
        // Check if any field has content
        return authorName.trim() || postCategory || postTitle.trim() || postExcerpt.trim() || postTags.trim();
    }
}

// RESTful API Manager (Simplified)
class APIManager {
    constructor() {
        this.baseURL = 'https://jsonplaceholder.typicode.com';
    }

    // GET - Fetch posts
    async fetchPosts() {
        try {
            const response = await fetch(`${this.baseURL}/posts`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('API GET - Posts fetched:', data.length);
            return data.slice(0, 5); // Return first 5 posts
        } catch (error) {
            console.error('API GET Error:', error);
            return [];
        }
    }

    // POST - Create new post
    async createPost(postData) {
        try {
            const response = await fetch(`${this.baseURL}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('API POST - Post created:', data);
            return data;
        } catch (error) {
            console.error('API POST Error:', error);
            return null;
        }
    }

    // PUT - Update post
    async updatePost(id, postData) {
        try {
            const response = await fetch(`${this.baseURL}/posts/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('API PUT - Post updated:', data);
            return data;
        } catch (error) {
            console.error('API PUT Error:', error);
            return null;
        }
    }

    // DELETE - Delete post
    async deletePost(id) {
        try {
            const response = await fetch(`${this.baseURL}/posts/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('API DELETE - Post deleted:', id);
            return true;
        } catch (error) {
            console.error('API DELETE Error:', error);
            return false;
        }
    }
}

// Global Functions
function shareToSocialMedia(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Check out this Malaysia Travel Blog!');
    
    const shareUrls = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
        whatsapp: `https://wa.me/?text=${text}%20${url}`
    };
    
    if (shareUrls[platform]) {
        window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
}

function openPostDetail(element, type) {
    if (window.blogManager) {
        blogManager.openPostDetail(element, type);
    }
}

// Initialize Blog Manager and API with enhanced debugging
let blogManager, apiManager;
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Starting initialization...');
    
    // Initialize managers with error handling
    try {
        blogManager = new BlogManager();
        console.log('✅ BlogManager initialized');
        
        apiManager = new APIManager();
        console.log('✅ APIManager initialized');
        
        // Make blogManager globally available for debugging
        window.blogManager = blogManager;
        window.apiManager = apiManager;
        
        // Demo RESTful API calls
        setTimeout(() => {
            console.log('=== RESTful API DEMO ===');
            if (apiManager) {
                apiManager.fetchPosts();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
    
    // Enter key for form submission prevention in text inputs
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
            e.preventDefault();
        }
    });
    
    console.log('🎉 Initialization complete!');
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BlogManager, UnsplashImageManager, APIManager };
}
