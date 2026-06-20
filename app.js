// ===== Dongeng Ceria - Spotify-like App with IndexedDB =====

// ===== IndexedDB Setup =====
const DB_NAME = 'DongengCeriaDB';
const STORE_NAME = 'stories';

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const idb = {
    async set(id, val) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).put({ id, ...val });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async del(id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async getAll() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }
};

// ===== Default Story Data =====
const DEFAULT_STORIES = [
    {
        id: 'kelinci',
        name: 'Kelinci dan Kura-kura',
        desc: 'Tentang kerja keras dan pantang menyerah.',
        image: 'images/story-kelinci.png',
        duration: '6:45',
        durationSec: 405,
        level: 'Mudah',
        category: ['populer', 'mudah', 'pengantar-tidur'],
        isNew: false,
        isDefault: true,
        audioUrl: null,
    },
    {
        id: 'bintang',
        name: 'Bintang Kecil yang Hilang',
        desc: 'Petualangan mencari cahaya di malam hari.',
        image: 'images/story-bintang.png',
        duration: '7:10',
        durationSec: 430,
        level: 'Mudah',
        category: ['baru', 'mudah', 'petualangan'],
        isNew: true,
        isDefault: true,
        audioUrl: null,
    },
    {
        id: 'itik',
        name: 'Si Itik Buruk Rupa',
        desc: 'Kisah tentang menerima diri sendiri.',
        image: 'images/story-itik.png',
        duration: '8:20',
        durationSec: 500,
        level: 'Sedang',
        category: ['populer', 'sedang'],
        isNew: false,
        isDefault: true,
        audioUrl: null,
    },
    {
        id: 'rusa',
        name: 'Rusa dan Sahabatnya',
        desc: 'Persahabatan yang tulus selamanya.',
        image: 'images/story-rusa.png',
        duration: '6:30',
        durationSec: 390,
        level: 'Mudah',
        category: ['mudah', 'pengantar-tidur'],
        isNew: false,
        isDefault: true,
        audioUrl: null,
    },
];

// ===== App State =====
let STORIES = [...DEFAULT_STORIES];

const state = {
    currentPage: 'beranda',
    currentStory: null,
    currentStoryIndex: -1,
    isPlaying: false,
    progress: 0,
    favorites: JSON.parse(localStorage.getItem('dongeng_favorites') || '[]'),
    recentlyPlayed: JSON.parse(localStorage.getItem('dongeng_recent') || '[]'),
    playCount: parseInt(localStorage.getItem('dongeng_playcount') || '0'),
    totalTime: parseInt(localStorage.getItem('dongeng_totaltime') || '0'),
    profilName: localStorage.getItem('dongeng_profil_name') || 'Si Kecil',
    profilAvatarUrl: localStorage.getItem('dongeng_profil_avatar') || null,
    theme: localStorage.getItem('dongeng_theme') || 'default',
    shuffle: false,
    progressInterval: null,
    deletedDefaults: JSON.parse(localStorage.getItem('dongeng_deleted_defaults') || '[]'),
    // Sleep timer state
    sleepTimerInterval: null,
    sleepTimerEnd: null,
    // Upload/Edit state
    editingStoryId: null,
    pendingImage: null,
    pendingImageDataUrl: null,
    pendingAudio: null,
    pendingAudioName: null,
};

// HTML5 Audio element
let audioEl = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    audioEl = document.getElementById('audio-player');

    // Load custom stories from IndexedDB
    await loadCustomStories();

    initStars();
    initNavigation();
    initPlayerControls();
    renderStoryList();
    renderStoryGrid();
    renderRecentlyPlayed();
    renderFavoritePage();
    initProfilUI();
    updateProfilStats();
    initSearch();
    initCategoryChips();
    initMiniPlayer();
    initFullPlayer();
    initAddStoryModal();
    initProfilUI();
    initAudioEvents();
    initSleepTimer();
    initSettingsMenu();
    registerServiceWorker();

    // Apply saved theme
    if (state.theme !== 'default') {
        document.body.classList.add(state.theme);
    }
});

// ===== Settings Menu & Theme =====
function initSettingsMenu() {
    // Menu buttons
    const btnTimer = document.getElementById('menu-timer-settings');
    const btnTheme = document.getElementById('menu-theme');
    
    // Timer Overlay
    const timerOverlay = document.getElementById('timer-modal-overlay');
    if (btnTimer && timerOverlay) {
        btnTimer.addEventListener('click', () => {
            timerOverlay.classList.remove('hidden');
        });
    }

    // Theme Overlay
    const themeOverlay = document.getElementById('theme-modal-overlay');
    const themeCloseBtn = document.getElementById('theme-close-btn');
    const themeOptions = document.querySelectorAll('.theme-option-btn');

    if (!btnTheme || !themeOverlay) return;

    btnTheme.addEventListener('click', () => {
        // Set active state correctly
        themeOptions.forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'transparent';
            if (b.dataset.theme === state.theme) {
                b.classList.add('active');
                b.style.borderColor = b.querySelector('div').style.backgroundColor;
            }
        });
        themeOverlay.classList.remove('hidden');
    });

    themeCloseBtn.addEventListener('click', () => {
        themeOverlay.classList.add('hidden');
    });

    themeOverlay.addEventListener('click', (e) => {
        if (e.target === themeOverlay) themeOverlay.classList.add('hidden');
    });

    themeOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedTheme = btn.dataset.theme;
            
            // Remove old theme class
            document.body.className = '';
            if (selectedTheme !== 'default') {
                document.body.classList.add(selectedTheme);
            }
            
            state.theme = selectedTheme;
            localStorage.setItem('dongeng_theme', state.theme);

            // Update UI
            themeOptions.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = 'transparent';
            });
            btn.classList.add('active');
            btn.style.borderColor = btn.querySelector('div').style.backgroundColor;

            showToast('🎨 Tema tampilan diubah');
            setTimeout(() => {
                themeOverlay.classList.add('hidden');
            }, 300);
        });
    });
}

// ===== Sleep Timer =====
function initSleepTimer() {
    const fpTimerBtn = document.getElementById('fp-timer-btn');
    const timerOverlay = document.getElementById('timer-modal-overlay');
    const timerCloseBtn = document.getElementById('timer-close-btn');
    const timerOptions = document.querySelectorAll('.timer-option-btn');
    const countdownEl = document.getElementById('timer-countdown');

    if (!fpTimerBtn || !timerOverlay) return;

    fpTimerBtn.addEventListener('click', () => {
        timerOverlay.classList.remove('hidden');
    });

    timerCloseBtn.addEventListener('click', () => {
        timerOverlay.classList.add('hidden');
    });

    timerOverlay.addEventListener('click', (e) => {
        if (e.target === timerOverlay) {
            timerOverlay.classList.add('hidden');
        }
    });

    timerOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            timerOptions.forEach(b => b.classList.remove('active', 'selected-timer'));
            timerOptions.forEach(b => b.style.borderColor = 'transparent');
            timerOptions.forEach(b => b.style.background = '#f3f4f6');
            timerOptions.forEach(b => b.style.color = 'var(--text-dark)');

            // Add active to clicked
            btn.classList.add('active', 'selected-timer');
            btn.style.borderColor = 'var(--primary-purple)';
            btn.style.background = 'rgba(139, 92, 246, 0.1)';
            btn.style.color = 'var(--primary-purple)';

            const minutes = parseInt(btn.dataset.minutes);

            if (state.sleepTimerInterval) {
                clearInterval(state.sleepTimerInterval);
                state.sleepTimerInterval = null;
            }

            if (minutes === 0) {
                state.sleepTimerEnd = null;
                countdownEl.style.display = 'none';
                showToast('🌙 Timer tidur dimatikan');
                timerOverlay.classList.add('hidden');
                fpTimerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            } else {
                state.sleepTimerEnd = Date.now() + minutes * 60000;
                countdownEl.style.display = 'block';
                fpTimerBtn.style.background = 'rgba(139, 92, 246, 0.8)';
                
                updateTimerDisplay();
                state.sleepTimerInterval = setInterval(updateTimerDisplay, 1000);
                
                showToast(`🌙 Timer diatur untuk ${minutes} menit`);
                setTimeout(() => {
                    timerOverlay.classList.add('hidden');
                }, 1000);
            }
        });
    });

    function updateTimerDisplay() {
        if (!state.sleepTimerEnd) return;
        
        const remaining = state.sleepTimerEnd - Date.now();
        if (remaining <= 0) {
            // Stop audio
            if (audioEl) audioEl.pause();
            state.isPlaying = false;
            updatePlayButtons();
            
            clearInterval(state.sleepTimerInterval);
            state.sleepTimerInterval = null;
            state.sleepTimerEnd = null;
            
            countdownEl.style.display = 'none';
            fpTimerBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            
            // Reset active button to "Mati"
            timerOptions.forEach(b => {
                if(b.dataset.minutes === '0') {
                    b.click();
                }
            });
            
            showToast('💤 Waktu tidur tiba, audio dihentikan');
            return;
        }

        const totalSeconds = Math.floor(remaining / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        countdownEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// ===== Load Custom Stories from IndexedDB =====
async function loadCustomStories() {
    try {
        const customStories = await idb.getAll();

        // Sort by createdAt desc
        customStories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Convert for display
        const processed = customStories.map(s => {
            const isOriginalDefault = DEFAULT_STORIES.some(d => d.id === s.id);
            return {
                ...s,
                image: s.imageUrl || s.image,
                audioUrl: s.audioUrl || null,
                isDefault: isOriginalDefault,
                isNew: !isOriginalDefault,
                category: s.category || ['baru', s.level === 'Mudah' ? 'mudah' : 'sedang'],
            };
        });

        // Filter out default stories that have been edited OR deleted
        const customIds = new Set(processed.map(s => s.id));
        const activeDefaults = DEFAULT_STORIES.filter(d => 
            !customIds.has(d.id) && !state.deletedDefaults.includes(d.id)
        );

        STORIES = [...activeDefaults, ...processed].filter(s => !state.deletedDefaults.includes(s.id));
    } catch (err) {
        console.error('Failed to load local stories:', err);
    }
}

// ===== Audio Events (Real Playback) =====
function initAudioEvents() {
    if (!audioEl) return;

    audioEl.addEventListener('timeupdate', () => {
        if (!audioEl.duration || !state.isPlaying) return;

        state.progress = (audioEl.currentTime / audioEl.duration) * 100;
        updateProgressUI();
    });

    audioEl.addEventListener('ended', () => {
        state.isPlaying = false;
        state.progress = 100;
        updatePlayPauseIcons();
        updateProgressUI();
        // Auto-play next
        setTimeout(() => playNext(), 1500);
    });

    audioEl.addEventListener('loadedmetadata', () => {
        if (state.currentStory && audioEl.duration && isFinite(audioEl.duration)) {
            // Update duration display in full player
            const totalSec = Math.floor(audioEl.duration);
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            const totalTimeEl = document.getElementById('total-time');
            if (totalTimeEl) totalTimeEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

            // Update story duration
            state.currentStory.durationSec = totalSec;
            state.currentStory.duration = `${min}:${sec.toString().padStart(2, '0')}`;
        }
    });
}

// ===== Star Generation =====
function initStars() {
    const container = document.getElementById('stars-container');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.setProperty('--duration', `${2 + Math.random() * 3}s`);
        star.style.setProperty('--delay', `${Math.random() * 3}s`);
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 70}%`;
        const size = 1.5 + Math.random() * 2.5;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        container.appendChild(star);
    }

    const starPositions = [
        { x: 75, y: 8, size: 16 }, { x: 88, y: 20, size: 12 },
        { x: 15, y: 55, size: 10 }, { x: 60, y: 15, size: 14 },
        { x: 92, y: 45, size: 11 }, { x: 5, y: 30, size: 9 },
    ];
    starPositions.forEach(pos => {
        const starSvg = document.createElement('div');
        starSvg.className = 'star-svg';
        starSvg.style.setProperty('--duration', `${3 + Math.random() * 3}s`);
        starSvg.style.setProperty('--delay', `${Math.random() * 2}s`);
        starSvg.style.left = `${pos.x}%`;
        starSvg.style.top = `${pos.y}%`;
        starSvg.innerHTML = `<svg viewBox="0 0 24 24" width="${pos.size}" height="${pos.size}" fill="#FFE066"><path d="M12 2l2.4 7.2H22l-6 4.5 2.3 7.3L12 16.5 5.7 21l2.3-7.3-6-4.5h7.6z"/></svg>`;
        container.appendChild(starSvg);
    });
}

// ===== Navigation (Spotify-style) =====
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
            if (navigator.vibrate) navigator.vibrate(10);
        });
    });

    const seeAllBtn = document.getElementById('see-all-btn');
    if (seeAllBtn) {
        seeAllBtn.addEventListener('click', () => navigateTo('dongeng'));
    }
}

function navigateTo(page) {
    if (state.currentPage === page) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active', 'fade-in');
    });

    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active', 'fade-in');
        targetPage.scrollTop = 0;
    }

    state.currentPage = page;

    if (page === 'favorit') renderFavoritePage();
    if (page === 'profil') updateProfilStats();
    if (page === 'dongeng') renderStoryGrid();
}

// ===== Render Story List (Home) =====
function renderStoryList() {
    const container = document.getElementById('story-list');
    if (!container) return;

    // Acak urutan dongeng untuk ditampilkan di beranda
    const shuffledStories = [...STORIES].sort(() => 0.5 - Math.random());
    const randomStories = shuffledStories.slice(0, 4);

    container.innerHTML = randomStories.map((story, i) => `
        <article class="story-card" data-story-id="${story.id}" style="animation-delay: ${i * 0.1}s">
            <div class="story-thumb">
                <img src="${story.image}" alt="${story.name}" loading="lazy">
            </div>
            <div class="story-info">
                <h3 class="story-name">${story.name}</h3>
                <p class="story-desc">${story.desc}</p>
                <div class="story-meta">
                    <span class="story-duration">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#9ca3af">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                        ${story.duration}
                    </span>
                    <span class="story-level level-${story.level === 'Mudah' ? 'easy' : 'medium'}">
                        <span class="level-dot"></span>
                        ${story.level}
                    </span>
                </div>
            </div>
            <button class="story-play-btn" aria-label="Putar ${story.name}" data-play-id="${story.id}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </button>
        </article>
    `).join('');

    container.querySelectorAll('.story-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playStory(btn.dataset.playId);
        });
    });

    container.querySelectorAll('.story-card').forEach(card => {
        card.addEventListener('click', () => {
            playStory(card.dataset.storyId);
        });
    });
}

// ===== Render Story Grid (Dongeng Page) =====
function renderStoryGrid(filter = 'semua', searchQuery = '') {
    const container = document.getElementById('story-grid');
    if (!container) return;

    let filtered = [...STORIES];

    if (filter === 'populer') filtered = filtered.filter(s => s.category?.includes('populer'));
    else if (filter === 'baru') filtered = filtered.filter(s => s.isNew || s.category?.includes('baru'));
    else if (filter === 'mudah') filtered = filtered.filter(s => s.level === 'Mudah');
    else if (filter === 'sedang') filtered = filtered.filter(s => s.level === 'Sedang');
    else if (filter === 'pengantar-tidur') filtered = filtered.filter(s => s.category?.includes('pengantar-tidur'));
    else if (filter === 'petualangan') filtered = filtered.filter(s => s.category?.includes('petualangan'));

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
        );
    }

    container.innerHTML = filtered.map(story => `
        <div class="grid-card ${state.currentStory?.id === story.id ? 'now-playing' : ''}" data-story-id="${story.id}">
            <img class="grid-card-img" src="${story.image}" alt="${story.name}" loading="lazy">
            <button class="story-delete-btn" data-delete-id="${story.id}" aria-label="Hapus">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
            <button class="grid-card-fav ${state.favorites.includes(story.id) ? 'is-fav' : ''}" data-fav-id="${story.id}" aria-label="Favorit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                    <path class="icon-plus" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                    <path class="icon-check" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
            </button>
            <button class="story-edit-btn" data-edit-id="${story.id}" aria-label="Edit Dongeng" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.5); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; z-index: 10; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="grid-card-play" data-play-id="${story.id}" aria-label="Putar ${story.name}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div class="grid-card-info">
                <div class="grid-card-name">${story.name}</div>
                <div class="grid-card-meta">
                    <span>${story.duration}</span>
                    <span>• ${story.level}</span>
                    ${story.audioUrl ? '<span style="color: #22c55e;">• 🎵 Audio</span>' : ''}
                    ${!story.isDefault ? '<span style="color: var(--pink-accent)">• Custom</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">Tidak ditemukan</div>
                <div class="empty-state-desc">Coba cari dengan kata kunci lain</div>
            </div>
        `;
    }

    // Event listeners
    container.querySelectorAll('.grid-card-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playStory(btn.dataset.playId);
        });
    });

    container.querySelectorAll('.grid-card-fav').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.favId);
            btn.classList.toggle('is-fav');
        });
    });

    container.querySelectorAll('.grid-card').forEach(card => {
        card.addEventListener('click', () => {
            playStory(card.dataset.storyId);
        });
    });

    // Delete buttons for custom stories
    container.querySelectorAll('.story-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.deleteId;
            const confirmed = await showCustomConfirm('Hapus dongeng ini?');
            if (confirmed) {
                await deleteCustomStory(id);
            }
        });
    });

    // Edit buttons
    container.querySelectorAll('.story-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.editId;
            openEditStoryModal(id);
        });
    });
}

// ===== Delete Custom Story =====
async function deleteCustomStory(storyId) {
    try {
        // If it's an original default story (whether edited or not), mark as deleted
        if (DEFAULT_STORIES.some(d => d.id === storyId)) {
            if (!state.deletedDefaults.includes(storyId)) {
                state.deletedDefaults.push(storyId);
                localStorage.setItem('dongeng_deleted_defaults', JSON.stringify(state.deletedDefaults));
            }
        }
        
        // If it's a custom story, delete it from IndexedDB
        if (!DEFAULT_STORIES.some(d => d.id === storyId)) {
            await idb.del(storyId);
        }
        await loadCustomStories();
        // Remove from favorites
        state.favorites = state.favorites.filter(id => id !== storyId);
        localStorage.setItem('dongeng_favorites', JSON.stringify(state.favorites));
        // Remove from recently played
        state.recentlyPlayed = state.recentlyPlayed.filter(id => id !== storyId);
        localStorage.setItem('dongeng_recent', JSON.stringify(state.recentlyPlayed));

        // If currently playing this story, stop
        if (state.currentStory?.id === storyId) {
            stopAudio();
            state.currentStory = null;
            state.isPlaying = false;
            document.getElementById('mini-player')?.classList.add('hidden');
            document.getElementById('app')?.classList.remove('has-mini-player');
        }

        // Re-render
        renderStoryList();
        renderStoryGrid();
        renderRecentlyPlayed();
        showToast('🗑️ Dongeng dihapus');
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('❌ Gagal menghapus');
    }
}

// ===== Render Recently Played =====
function renderRecentlyPlayed() {
    const container = document.getElementById('recent-scroll');
    if (!container) return;

    const recent = state.recentlyPlayed
        .map(id => STORIES.find(s => s.id === id))
        .filter(Boolean)
        .slice(0, 6);

    if (recent.length === 0) {
        const defaults = STORIES.slice(0, 4);
        container.innerHTML = defaults.map(story => `
            <div class="recent-card" data-story-id="${story.id}">
                <img class="recent-card-img" src="${story.image}" alt="${story.name}" loading="lazy">
                <div class="recent-card-name">${story.name}</div>
            </div>
        `).join('');
    } else {
        container.innerHTML = recent.map(story => `
            <div class="recent-card" data-story-id="${story.id}">
                <img class="recent-card-img" src="${story.image}" alt="${story.name}" loading="lazy">
                <div class="recent-card-name">${story.name}</div>
            </div>
        `).join('');
    }

    container.querySelectorAll('.recent-card').forEach(card => {
        card.addEventListener('click', () => playStory(card.dataset.storyId));
    });
}

// ===== Render Favorit Page =====
function renderFavoritePage() {
    const container = document.getElementById('favorit-content');
    if (!container) return;

    const favStories = state.favorites
        .map(id => STORIES.find(s => s.id === id))
        .filter(Boolean);

    if (favStories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">➕</div>
                <div class="empty-state-title">Belum ada favorit</div>
                <div class="empty-state-desc">Tekan tombol + pada dongeng yang kamu suka untuk menyimpannya di sini</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div class="story-list">${favStories.map((story, i) => `
        <article class="story-card" data-story-id="${story.id}" style="animation-delay: ${i * 0.1}s">
            <div class="story-thumb">
                <img src="${story.image}" alt="${story.name}" loading="lazy">
            </div>
            <div class="story-info">
                <h3 class="story-name">${story.name}</h3>
                <p class="story-desc">${story.desc}</p>
                <div class="story-meta">
                    <span class="story-duration">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="#9ca3af">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                        </svg>
                        ${story.duration}
                    </span>
                    <span class="story-level level-${story.level === 'Mudah' ? 'easy' : 'medium'}">
                        <span class="level-dot"></span>
                        ${story.level}
                    </span>
                </div>
            </div>
            <button class="story-play-btn" aria-label="Putar ${story.name}" data-play-id="${story.id}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </button>
        </article>
    `).join('')}</div>`;

    container.querySelectorAll('.story-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playStory(btn.dataset.playId);
        });
    });

    container.querySelectorAll('.story-card').forEach(card => {
        card.addEventListener('click', () => playStory(card.dataset.storyId));
    });
}

// ===== Profil UI & Edit =====
function initProfilUI() {
    const avatarInput = document.getElementById('profil-avatar-input');
    const avatarBtn = document.getElementById('avatar-circle-btn');
    const editNameBtn = document.getElementById('edit-name-btn');
    const nameDisplay = document.getElementById('profil-name-display');

    // Display initial values
    if (state.profilName) {
        nameDisplay.textContent = state.profilName;
    }
    if (state.profilAvatarUrl) {
        setAvatarImage(state.profilAvatarUrl);
    }

    // Avatar edit
    if (avatarBtn && avatarInput) {
        avatarBtn.addEventListener('click', () => {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                state.profilAvatarUrl = dataUrl;
                localStorage.setItem('dongeng_profil_avatar', dataUrl);
                setAvatarImage(dataUrl);
                showToast('📷 Foto profil diperbarui');
            };
            reader.readAsDataURL(file);
        });
    }

    // Name edit
    if (editNameBtn) {
        editNameBtn.addEventListener('click', async () => {
            const newName = await showCustomPrompt('Masukkan nama baru:', state.profilName);
            if (newName && newName.trim() !== '') {
                state.profilName = newName.trim();
                localStorage.setItem('dongeng_profil_name', state.profilName);
                nameDisplay.textContent = state.profilName;
                showToast('✏️ Nama profil diperbarui');
            }
        });
    }
}

function setAvatarImage(url) {
    const img = document.getElementById('profil-avatar-img');
    const icon = document.getElementById('profil-avatar-icon');
    if (img && icon) {
        img.src = url;
        img.classList.remove('hidden');
        icon.classList.add('hidden');
    }
}

// ===== Profil Stats =====
function updateProfilStats() {
    const statPlayed = document.getElementById('stat-played');
    const statFavorites = document.getElementById('stat-favorites');
    const statTime = document.getElementById('stat-time');

    if (statPlayed) statPlayed.textContent = state.playCount;
    if (statFavorites) statFavorites.textContent = state.favorites.length;
    if (statTime) {
        const minutes = Math.floor(state.totalTime / 60);
        statTime.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`;
    }
}

// ===== Search =====
function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;

    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            const activeChip = document.querySelector('.chip.active');
            const category = activeChip?.dataset.category || 'semua';
            renderStoryGrid(category, input.value);
        }, 250);
    });
}

// ===== Category Chips =====
function initCategoryChips() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const searchInput = document.getElementById('search-input');
            renderStoryGrid(chip.dataset.category, searchInput?.value || '');
            if (navigator.vibrate) navigator.vibrate(10);
        });
    });
}

// ===== Play Story (Core Logic) =====
function playStory(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story) return;

    const storyIndex = STORIES.findIndex(s => s.id === storyId);
    state.currentStory = story;
    state.currentStoryIndex = storyIndex;
    state.isPlaying = true;
    state.progress = 0;

    // Update play count
    state.playCount++;
    localStorage.setItem('dongeng_playcount', state.playCount);

    // Add to recently played
    state.recentlyPlayed = [storyId, ...state.recentlyPlayed.filter(id => id !== storyId)].slice(0, 10);
    localStorage.setItem('dongeng_recent', JSON.stringify(state.recentlyPlayed));

    // Show mini player
    showMiniPlayer(story);

    // Update full player
    updateFullPlayer(story);

    // Play audio
    playAudio(story);

    // Update UI
    renderRecentlyPlayed();
    renderStoryGrid(document.querySelector('.chip.active')?.dataset.category || 'semua');

    showToast(`▶ ${story.name}`);
    if (navigator.vibrate) navigator.vibrate(15);
}

// ===== Audio Playback =====
function playAudio(story) {
    if (!audioEl) return;

    stopProgressSimulation();

    if (story.audioUrl) {
        // Real audio file from IndexedDB
        audioEl.src = story.audioUrl;
        audioEl.load();
        audioEl.play().catch(e => console.log('Audio play error:', e));
    } else {
        // No audio file - simulate progress
        audioEl.src = '';
        audioEl.pause();
        startProgressSimulation();
    }

    updatePlayPauseIcons();
}

function stopAudio() {
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }
    stopProgressSimulation();
}

// ===== Mini Player =====
function initMiniPlayer() {
    const miniPlayer = document.getElementById('mini-player');
    const miniPlayBtn = document.getElementById('mini-play-btn');
    const miniPrevBtn = document.getElementById('mini-prev-btn');
    const miniNextBtn = document.getElementById('mini-next-btn');

    miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('.mini-player-btn')) return;
        openFullPlayer();
    });

    miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayPause();
    });

    miniPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playPrevious();
    });

    miniNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playNext();
    });
}

function showMiniPlayer(story) {
    const miniPlayer = document.getElementById('mini-player');
    document.getElementById('mini-player-thumb').src = story.image;
    document.getElementById('mini-player-thumb').alt = story.name;
    document.getElementById('mini-player-title').textContent = story.name;
    document.getElementById('mini-player-subtitle').textContent = story.desc;

    miniPlayer.classList.remove('hidden');
    document.getElementById('app').classList.add('has-mini-player');
    updatePlayPauseIcons();
}

// ===== Full Player =====
function initFullPlayer() {
    document.getElementById('full-player-close').addEventListener('click', closeFullPlayer);
    document.getElementById('fp-play').addEventListener('click', togglePlayPause);
    document.getElementById('fp-prev').addEventListener('click', playPrevious);
    document.getElementById('fp-next').addEventListener('click', playNext);

    document.getElementById('fp-favorite').addEventListener('click', () => {
        if (!state.currentStory) return;
        toggleFavorite(state.currentStory.id);
        document.getElementById('fp-favorite').classList.toggle('is-fav', state.favorites.includes(state.currentStory.id));
    });

    document.getElementById('fp-shuffle').addEventListener('click', () => {
        state.shuffle = !state.shuffle;
        document.getElementById('fp-shuffle').style.opacity = state.shuffle ? '1' : '0.5';
        showToast(state.shuffle ? '🔀 Acak aktif' : '🔀 Acak nonaktif');
    });

    // Seek on progress bar click
    document.getElementById('progress-track').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width);

        if (audioEl && audioEl.duration && state.currentStory?.audioUrl) {
            audioEl.currentTime = percent * audioEl.duration;
        } else {
            state.progress = percent * 100;
            updateProgressUI();
        }
    });
}

function openFullPlayer() {
    document.getElementById('full-player').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeFullPlayer() {
    document.getElementById('full-player').classList.add('hidden');
    document.body.style.overflow = '';
}

function updateFullPlayer(story) {
    document.getElementById('full-player-img').src = story.image;
    document.getElementById('full-player-title').textContent = story.name;
    document.getElementById('full-player-desc').textContent = story.desc;
    document.getElementById('total-time').textContent = story.duration;
    document.getElementById('current-time').textContent = '0:00';
    document.getElementById('fp-favorite').classList.toggle('is-fav', state.favorites.includes(story.id));
}

// ===== Playback Controls =====
function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    updatePlayPauseIcons();

    if (state.currentStory?.audioUrl && audioEl) {
        if (state.isPlaying) {
            audioEl.play().catch(e => console.log('Play error:', e));
        } else {
            audioEl.pause();
        }
    } else {
        // Simulated playback
        if (state.isPlaying) {
            startProgressSimulation();
        } else {
            stopProgressSimulation();
        }
    }

    if (navigator.vibrate) navigator.vibrate(10);
}

function playNext() {
    if (STORIES.length === 0) return;

    let nextIndex;
    if (state.shuffle) {
        do { nextIndex = Math.floor(Math.random() * STORIES.length); }
        while (nextIndex === state.currentStoryIndex && STORIES.length > 1);
    } else {
        nextIndex = (state.currentStoryIndex + 1) % STORIES.length;
    }
    playStory(STORIES[nextIndex].id);
}

function playPrevious() {
    if (STORIES.length === 0) return;

    if (state.progress > 15) {
        state.progress = 0;
        if (audioEl && state.currentStory?.audioUrl) audioEl.currentTime = 0;
        updateProgressUI();
        return;
    }

    let prevIndex;
    if (state.shuffle) {
        prevIndex = Math.floor(Math.random() * STORIES.length);
    } else {
        prevIndex = (state.currentStoryIndex - 1 + STORIES.length) % STORIES.length;
    }
    playStory(STORIES[prevIndex].id);
}

function updatePlayPauseIcons() {
    const playPath = 'M8 5v14l11-7z';
    const pausePath = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const path = state.isPlaying ? pausePath : playPath;

    const miniIcon = document.getElementById('mini-play-icon');
    const fpIcon = document.getElementById('fp-play-icon');
    if (miniIcon) miniIcon.innerHTML = `<path d="${path}"/>`;
    if (fpIcon) fpIcon.innerHTML = `<path d="${path}"/>`;

    const heroPlayBtn = document.getElementById('play-btn');
    if (heroPlayBtn) {
        const svg = heroPlayBtn.querySelector('.play-btn-inner svg');
        if (svg) svg.innerHTML = `<path d="${path}"/>`;
        const inner = heroPlayBtn.querySelector('.play-btn-inner');
        inner.style.background = state.isPlaying
            ? 'linear-gradient(135deg, #8b5cf6, #7c3aed, #6d28d9)'
            : '';
    }
}

// ===== Progress Simulation (for stories without audio) =====
function startProgressSimulation() {
    stopProgressSimulation();
    if (!state.currentStory) return;

    const totalSec = state.currentStory.durationSec || 300;
    const incrementPerSec = 100 / totalSec;

    state.progressInterval = setInterval(() => {
        if (!state.isPlaying) return;

        state.progress += incrementPerSec;
        state.totalTime++;

        if (state.progress >= 100) {
            state.progress = 100;
            stopProgressSimulation();
            localStorage.setItem('dongeng_totaltime', state.totalTime);
            setTimeout(() => playNext(), 1500);
            return;
        }

        updateProgressUI();

        if (Math.floor(state.progress) % 5 === 0) {
            localStorage.setItem('dongeng_totaltime', state.totalTime);
        }
    }, 1000);
}

function stopProgressSimulation() {
    if (state.progressInterval) {
        clearInterval(state.progressInterval);
        state.progressInterval = null;
    }
}

function updateProgressUI() {
    const miniProgress = document.getElementById('mini-player-progress');
    if (miniProgress) miniProgress.style.setProperty('--progress', `${state.progress}%`);

    const fill = document.getElementById('progress-fill');
    const thumb = document.getElementById('progress-thumb');
    const currentTimeEl = document.getElementById('current-time');

    if (fill) fill.style.width = `${state.progress}%`;
    if (thumb) thumb.style.left = `${state.progress}%`;

    if (currentTimeEl && state.currentStory) {
        const durationSec = state.currentStory.durationSec || 300;
        const currentSec = Math.floor((state.progress / 100) * durationSec);
        const min = Math.floor(currentSec / 60);
        const sec = currentSec % 60;
        currentTimeEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    }
}

// ===== Favorites =====
function toggleFavorite(storyId) {
    const idx = state.favorites.indexOf(storyId);
    if (idx > -1) {
        state.favorites.splice(idx, 1);
        showToast('💔 Dihapus dari favorit');
    } else {
        state.favorites.push(storyId);
        showToast('💜 Ditambah ke favorit');
    }
    localStorage.setItem('dongeng_favorites', JSON.stringify(state.favorites));
    updateProfilStats();
}

// ===== Hero Player Controls =====
function initPlayerControls() {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (state.currentStory) togglePlayPause();
            else playStory(STORIES[0].id);
        });
    }

    const timerAction = document.getElementById('timer-action');
    if (timerAction) {
        timerAction.addEventListener('click', () => {
            const sublabel = timerAction.querySelector('.player-sublabel');
            const times = ['15 menit', '30 menit', '45 menit', '60 menit'];
            const idx = times.indexOf(sublabel.textContent);
            sublabel.textContent = times[(idx + 1) % times.length];
            showToast(`⏱ Timer: ${times[(idx + 1) % times.length]}`);
            if (navigator.vibrate) navigator.vibrate(10);
        });
    }

    const putarAction = document.getElementById('putar-dongeng-action');
    if (putarAction) {
        putarAction.addEventListener('click', () => {
            if (state.currentStory) openFullPlayer();
            else playStory(STORIES[0].id);
        });
    }
}

// ===== Add Story Modal =====
function initAddStoryModal() {
    const addBtn = document.getElementById('add-story-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close-btn');
    const form = document.getElementById('add-story-form');
    const imageInput = document.getElementById('story-image-input');
    const audioInput = document.getElementById('story-audio-input');
    const imageArea = document.getElementById('upload-image-area');
    const audioArea = document.getElementById('upload-audio-area');
    const removeAudioBtn = document.getElementById('remove-audio-btn');

    // Open modal
    addBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });

    // Close modal
    closeBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Image upload
    imageArea.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        state.pendingImage = file;

        const reader = new FileReader();
        reader.onload = (ev) => {
            state.pendingImageDataUrl = ev.target.result;
            const preview = document.getElementById('upload-image-preview');
            // Replace content with image
            let img = preview.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                preview.appendChild(img);
            }
            img.src = ev.target.result;
            img.alt = 'Preview';
            preview.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    });

    // Audio upload
    audioArea.querySelector('.upload-preview').addEventListener('click', () => audioInput.click());
    audioInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        state.pendingAudio = file;
        state.pendingAudioName = file.name;

        const audioPreview = document.getElementById('upload-audio-preview');
        const audioInfo = document.getElementById('audio-file-info');
        const audioFileName = document.getElementById('audio-file-name');

        audioPreview.style.display = 'none';
        audioInfo.classList.remove('hidden');
        audioFileName.textContent = file.name;
    });

    // Remove audio
    removeAudioBtn.addEventListener('click', () => {
        state.pendingAudio = null;
        state.pendingAudioName = null;
        audioInput.value = '';

        document.getElementById('upload-audio-preview').style.display = '';
        document.getElementById('audio-file-info').classList.add('hidden');
    });

    // Submit form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveNewStory();
    });
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    resetForm();
}

function resetForm() {
    document.getElementById('add-story-form').reset();
    state.pendingImage = null;
    state.pendingImageDataUrl = null;
    state.pendingAudio = null;
    state.pendingAudioName = null;
    state.editingStoryId = null;

    document.querySelector('.modal-header h2').textContent = 'Tambah Dongeng Baru';
    document.getElementById('submit-story-btn').querySelector('span').textContent = 'Simpan Dongeng';

    // Reset image preview
    const preview = document.getElementById('upload-image-preview');
    const img = preview.querySelector('img');
    if (img) img.remove();
    preview.classList.remove('has-image');

    // Reset audio preview
    document.getElementById('upload-audio-preview').style.display = '';
    document.getElementById('audio-file-info').classList.add('hidden');
}

// ===== Edit Story Modal =====
function openEditStoryModal(storyId) {
    const story = STORIES.find(s => s.id === storyId);
    if (!story) return;

    state.editingStoryId = storyId;

    document.getElementById('story-title-input').value = story.name || '';
    document.getElementById('story-desc-input').value = story.desc || '';
    document.getElementById('story-level-input').value = story.level || 'Mudah';

    document.querySelector('.modal-header h2').textContent = 'Edit Dongeng';
    document.getElementById('submit-story-btn').querySelector('span').textContent = 'Simpan Perubahan';

    if (story.image) {
        state.pendingImageDataUrl = story.image;
        const preview = document.getElementById('upload-image-preview');
        let img = preview.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            preview.appendChild(img);
        }
        img.src = story.image;
        img.alt = 'Preview';
        preview.classList.add('has-image');
    }

    if (story.audioUrl) {
        document.getElementById('upload-audio-preview').style.display = 'none';
        document.getElementById('audio-file-info').classList.remove('hidden');
        document.getElementById('audio-file-name').textContent = 'Audio Tersimpan';
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ===== Save/Update Story to IndexedDB =====
async function saveNewStory() {
    const title = document.getElementById('story-title-input').value.trim();
    const desc = document.getElementById('story-desc-input').value.trim() || 'Dongeng buatan sendiri';
    const level = document.getElementById('story-level-input').value;

    if (!title) {
        showToast('❌ Judul harus diisi');
        return;
    }

    const submitBtn = document.getElementById('submit-story-btn');
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Menyimpan...';

    try {
        const isEditing = !!state.editingStoryId;
        const existingStory = isEditing ? STORIES.find(s => s.id === state.editingStoryId) : null;
        const storyId = isEditing ? state.editingStoryId : 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        // Gunakan Image data URL secara langsung (base64)
        let imageUrl = state.pendingImageDataUrl || (existingStory ? existingStory.image : generatePlaceholderImage(title));

        // Gunakan Audio data URL
        let audioUrl = existingStory ? (existingStory.audioUrl || null) : null;
        let durationSec = existingStory ? (existingStory.durationSec || 300) : 300;

        if (state.pendingAudio) {
            submitBtn.querySelector('span').textContent = 'Memproses Audio...';
            try {
                durationSec = await getAudioDuration(state.pendingAudio);
            } catch (e) {
                console.log('Could not get duration, using default');
            }
            
            // Konversi file audio menjadi Base64 string
            audioUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(state.pendingAudio);
            });
        }

        submitBtn.querySelector('span').textContent = 'Menyimpan Data...';
        const min = Math.floor(durationSec / 60);
        const sec = Math.floor(durationSec % 60);

        const storyRecord = {
            name: title,
            desc: desc,
            imageUrl: imageUrl,
            audioUrl: audioUrl,
            duration: `${min}:${sec.toString().padStart(2, '0')}`,
            durationSec: Math.floor(durationSec),
            level: level,
            createdAt: isEditing ? (existingStory?.createdAt || Date.now()) : Date.now(),
            category: ['baru', level === 'Mudah' ? 'mudah' : 'sedang']
        };

        // Simpan ke IndexedDB
        await idb.set(storyId, storyRecord);

        // Muat ulang data ke state dan render ulang UI
        await loadCustomStories();
        if (state.currentPage === 'dongeng') renderStoryGrid();
        if (state.currentPage === 'beranda') renderStoryList();
        renderRecentlyPlayed();
        if (state.currentPage === 'favorit') renderFavoritePage();

        // Close modal
        closeModal();
        showToast(isEditing ? '✅ Dongeng diperbarui' : '✨ Dongeng berhasil dibuat');

    } catch (err) {
        console.error('Save failed:', err);
        showToast('❌ Gagal menyimpan dongeng');
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Simpan Dongeng';
    }
}

// ===== Utility: Read file as ArrayBuffer =====
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// ===== Utility: Get audio duration =====
function getAudioDuration(file) {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        audio.src = url;

        audio.addEventListener('loadedmetadata', () => {
            URL.revokeObjectURL(url);
            if (isFinite(audio.duration)) {
                resolve(audio.duration);
            } else {
                resolve(300);
            }
        });

        audio.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            reject(new Error('Cannot load audio'));
        });

        // Timeout fallback
        setTimeout(() => resolve(300), 5000);
    });
}

// ===== Utility: Generate placeholder image =====
function generatePlaceholderImage(title) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 400, 400);
    const hue = (title.charCodeAt(0) * 37 + title.length * 53) % 360;
    gradient.addColorStop(0, `hsl(${hue}, 70%, 55%)`);
    gradient.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 45%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);

    // Book emoji
    ctx.font = '80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📖', 200, 160);

    // Title text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Nunito, sans-serif';
    ctx.textAlign = 'center';

    const words = title.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        const test = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(test).width > 340) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = test;
        }
    });
    if (currentLine) lines.push(currentLine);

    lines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, 200, 260 + i * 36);
    });

    return canvas.toDataURL('image/png');
}

// ===== Custom Dialogs =====
function showCustomConfirm(msg) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-confirm-overlay');
        const msgEl = document.getElementById('custom-confirm-msg');
        const btnOk = document.getElementById('custom-confirm-ok');
        const btnCancel = document.getElementById('custom-confirm-cancel');

        if (!overlay || !btnOk || !btnCancel) return resolve(false);

        msgEl.textContent = msg;
        overlay.classList.remove('hidden');

        const cleanup = () => {
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            overlay.classList.add('hidden');
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}

function showCustomPrompt(title, defaultValue) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-prompt-overlay');
        const titleEl = document.getElementById('custom-prompt-title');
        const inputEl = document.getElementById('custom-prompt-input');
        const btnOk = document.getElementById('custom-prompt-ok');
        const btnCancel = document.getElementById('custom-prompt-cancel');

        if (!overlay || !btnOk || !btnCancel || !inputEl) return resolve(null);

        titleEl.textContent = title;
        inputEl.value = defaultValue || '';
        overlay.classList.remove('hidden');
        inputEl.focus();

        const cleanup = () => {
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            overlay.classList.add('hidden');
        };

        const onOk = () => { cleanup(); resolve(inputEl.value); };
        const onCancel = () => { cleanup(); resolve(null); };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}

// ===== Toast =====
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: ${state.currentStory ? '150px' : '90px'};
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(30, 27, 75, 0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        padding: 10px 24px;
        border-radius: 30px;
        font-size: 0.8rem;
        font-weight: 700;
        font-family: 'Nunito', sans-serif;
        z-index: 300;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        text-align: center;
        pointer-events: none;
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ===== Service Worker & PWA Install =====
let deferredPrompt;

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(r => console.log('SW registered:', r.scope))
                .catch(e => console.log('SW failed:', e));
        });
    }

    // Handle PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Update UI to notify the user they can add to home screen
        const installBtn = document.getElementById('menu-install-app');
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.addEventListener('click', async () => {
                // Show the prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, throw it away
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            });
        }
    });

    window.addEventListener('appinstalled', () => {
        // Hide the app-provided install promotion
        const installBtn = document.getElementById('menu-install-app');
        if (installBtn) installBtn.classList.add('hidden');
        deferredPrompt = null;
        console.log('PWA was installed');
    });
}
