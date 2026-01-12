// Drama Watch Lite - Bundled 2026-01-12T12:44:18.092Z


// js/api.js
const API_BASE = "https://melolo-api-azure.vercel.app/api/melolo";
const PROXY_LIST = [
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://api.allorigins.win/raw?url='
];

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

async function smartFetch(endpoint, params = {}) {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    const url = new URL(`${API_BASE}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
        }
    });
    
    const target = url.toString();
    let data = null;
    
    try {
        const response = await fetch(target, {
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'max-age=300'
            },
            signal: AbortSignal.timeout(8000)
        });
        
        if (response.ok) {
            data = await response.json();
        }
    } catch (error) {}
    
    if (!data) {
        for (const proxy of PROXY_LIST) {
            try {
                const proxyUrl = proxy + encodeURIComponent(target);
                const response = await fetch(proxyUrl, {
                    signal: AbortSignal.timeout(8000)
                });
                
                if (response.ok) {
                    data = await response.json();
                    if (data) break;
                }
            } catch (error) {
                continue;
            }
        }
    }
    
    if (!data) {
        throw new Error('Failed to fetch data');
    }
    
    cache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    
    return data;
}

async function loadLatestDramas() {
    try {
        const data = await smartFetch('latest');
        return data.books || [];
    } catch (error) {
        throw error;
    }
}

async function loadTrendingDramas() {
    try {
        const data = await smartFetch('trending');
        return data.books || [];
    } catch (error) {
        throw error;
    }
}

async function searchDramas(query, limit = 20, offset = 0) {
    try {
        const data = await smartFetch('search', {
            query,
            limit,
            offset
        });
        
        const groups = data?.data?.search_data || [];
        const results = groups.flatMap(group => group.books || []);
        
        return {
            results,
            hasMore: data?.data?.has_more || false,
            total: results.length
        };
    } catch (error) {
        throw error;
    }
}

async function loadDramaDetail(dramaId) {
    try {
        const data = await smartFetch(`detail/${dramaId}`);
        const videoData = data?.data?.video_data || {};
        
        return {
            id: dramaId,
            title: videoData.series_title || 'Unknown',
            description: videoData.series_intro || '',
            thumbnail: videoData.series_cover || videoData.thumb_url || '',
            episodes: videoData.video_list || [],
            totalEpisodes: videoData.video_list?.length || 0
        };
    } catch (error) {
        throw error;
    }
}

async function loadVideoSources(videoId) {
    try {
        const data = await smartFetch(`stream/${videoId}`);
        const videoData = data?.data;
        
        if (!videoData) {
            throw new Error('No video data found');
        }
        
        const sources = {
            mainUrl: videoData.main_url ? decodeUrl(videoData.main_url) : null,
            sources: [],
            autoDefinition: null
        };
        
        let videoModel = videoData.video_model;
        if (typeof videoModel === 'string') {
            try {
                videoModel = JSON.parse(videoModel);
            } catch (error) {
                videoModel = null;
            }
        }
        
        if (videoModel && videoModel.video_list) {
            Object.entries(videoModel.video_list).forEach(([key, video]) => {
                if (video?.main_url) {
                    const decodedUrl = decodeUrl(video.main_url);
                    if (decodedUrl) {
                        const resolution = video.definition || key.replace('video_', '') + 'p';
                        sources.sources.push({
                            resolution,
                            label: resolution,
                            url: decodedUrl
                        });
                    }
                }
            });
            
            sources.autoDefinition = videoModel.auto_definition;
        }
        
        sources.sources.sort((a, b) => {
            const aNum = parseInt(a.resolution) || 0;
            const bNum = parseInt(b.resolution) || 0;
            return bNum - aNum;
        });
        
        if (sources.sources.length === 0 && sources.mainUrl) {
            sources.sources.push({
                resolution: 'auto',
                label: 'Auto',
                url: sources.mainUrl
            });
        }

        return sources;
    } catch (error) {
        throw new Error('Failed to load video sources');
    }
}

function decodeUrl(encoded) {
    if (!encoded) return null;
    if (encoded.startsWith('http')) return encoded;
    
    try {
        return atob(encoded);
    } catch (error) {
        return encoded;
    }
}

function proxyThumbnail(url, options = {}) {
    if (!url) return '';
    
    const { width = 400, quality = 80, format = 'jpg' } = options;
    const encodedUrl = encodeURIComponent(url);
    
    return `https://images.weserv.nl/?url=${encodedUrl}&w=${width}&q=${quality}&output=${format}`;
}

function clearCache() {
    cache.clear();
}

window.apiUtils = {
    smartFetch,
    clearCache,
    cacheSize: () => cache.size
};

// js/components.js

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function highlightText(text, searchTerm) {
    if (!searchTerm || !text) return escapeHTML(text);
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return escapeHTML(text).replace(regex, '<em class="highlight">$1</em>');
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'rb';
    return num.toString();
}

function renderLoading(message = 'Memuat...') {
    const content = document.getElementById('content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}

function renderError(message) {
    const content = document.getElementById('content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon"><i class="fas fa-exclamation-circle"></i></div>
            <p>${escapeHTML(message)}</p>
            <button class="retry-btn" onclick="window.location.reload()">
                Coba Lagi
            </button>
        </div>
    `;
}

function renderGrid(dramas, category = 'latest') {
    const content = document.getElementById('content');
    if (!content) return;
    
    if (!dramas || dramas.length === 0) {
        renderError('Tidak ada drama ditemukan');
        return;
    }
    
    const isLiteMode = document.documentElement.classList.contains('lite');
    const gridClass = isLiteMode ? 'grid lite' : 'grid';
    
    let html = `<div class="${gridClass}">`;
    
    dramas.forEach(drama => {
        if (!drama.book_id) return;
        
        const badges = getBadgesHTML(drama);
        const title = drama.search_high_light?.title?.rich_text || drama.book_name;
        const highlightedTitle = highlightText(title, window.AppState?.searchQuery || '');
        const thumbnail = proxyThumbnail(drama.thumb_url, {
            width: isLiteMode ? 120 : 200,
            quality: isLiteMode ? 60 : 80
        });
        
        html += `
            <div class="card" data-book-id="${drama.book_id}">
                ${badges}
                <div class="card-img">
                    <img src="${thumbnail}" 
                         alt="${escapeHTML(drama.book_name)}"
                         loading="lazy"
                         decoding="async"
                         onerror="this.src='https://placehold.co/${isLiteMode ? '120x180' : '200x300'}/1e293b/94a3b8?text=${encodeURIComponent(drama.book_name || 'Drama')}'">
                </div>
                <div class="card-info">
                    <div class="card-title">
                        ${highlightedTitle}
                    </div>
                    <div class="card-meta">
                        ${escapeHTML(drama.show_creation_status || '')}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    content.innerHTML = html;
    
    setTimeout(() => {
        document.querySelectorAll('.card[data-book-id]').forEach(card => {
            const dramaId = card.getAttribute('data-book-id');
            if (dramaId) {
                card.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'drama-click', data: dramaId }
                    }));
                });
            }
        });
    }, 50);
}

function renderDetail(drama) {
    const content = document.getElementById('content');
    if (!content) return;
    
    const isLiteMode = document.documentElement.classList.contains('lite');
    const thumbnail = proxyThumbnail(drama.thumbnail, { width: 300, quality: 85 });
    
    const episodes = [...(drama.episodes || [])].sort((a, b) => {
        const aIndex = parseInt(a.vid_index) || 0;
        const bIndex = parseInt(b.vid_index) || 0;
        return aIndex - bIndex;
    });
    
    if (isLiteMode) {
        content.innerHTML = renderDetailLite(drama, thumbnail, episodes);
    } else {
        content.innerHTML = renderDetailNormal(drama, thumbnail, episodes);
    }
    
    setTimeout(() => {
        if (isLiteMode) {
            document.querySelectorAll('.episode-item-lite').forEach((item, index) => {
                item.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'episode-click', data: index }
                    }));
                });
            });
        } else {
            document.querySelectorAll('.episode-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'episode-click', data: index }
                    }));
                });
            });
        }

        setupExpandableDescription();
    }, 50);
}

function renderDetailNormal(drama, thumbnail, episodes) {
    return `
        <div class="detail-container">
            <div class="detail-thumbnail">
                <img src="${thumbnail}" 
                     alt="${escapeHTML(drama.title)}"
                     loading="lazy"
                     decoding="async">
            </div>
            <div class="detail-info">
                <h2 class="detail-title">${escapeHTML(drama.title)}</h2>
                <div class="detail-episode-count">${drama.totalEpisodes} Episode</div>
                <div class="description-container">
                    <div class="description-content">${escapeHTML(drama.description)}</div>
                    <button class="expand-btn">
                        <span>Selengkapnya</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="episodes-card">
            <div class="episode-list-container">
                ${episodes.map((episode, index) => renderEpisodeItem(episode, index, false)).join('')}
            </div>
        </div>
    `;
}

function renderDetailLite(drama, thumbnail, episodes) {
    return `
        <div class="detail-container-lite">
            <div class="detail-header-lite">
                <div class="detail-thumbnail-lite">
                    <img src="${thumbnail}" 
                         alt="${escapeHTML(drama.title)}"
                         loading="lazy"
                         decoding="async">
                </div>
                <div class="detail-info-lite">
                    <h2 class="detail-title">${escapeHTML(drama.title)}</h2>
                    <div class="detail-episode-count">${drama.totalEpisodes} Episode</div>
                </div>
            </div>
            <div class="description-lite">
                <div class="description-content-lite">
                    ${escapeHTML(drama.description)}
                </div>
            </div>
        </div>
        
        <div class="episodes-card-lite">
            <div class="episode-list-lite">
                ${episodes.map((episode, index) => renderEpisodeItem(episode, index, true)).join('')}
            </div>
        </div>
    `;
}

function renderEpisodeItem(episode, index, isLite) {
    const episodeNum = episode.vid_index || index + 1;
    const duration = episode.duration ? formatDuration(episode.duration) : '';
    const isNew = episode.is_new === "1";
    
    if (isLite) {
        return `
            <div class="episode-item-lite" data-episode-index="${index}">
                <div class="episode-info-lite">
                    <div class="episode-number-lite">
                        <span>Episode ${episodeNum}</span>
                        ${isNew ? '<span class="ep-badge-lite">BARU</span>' : ''}
                    </div>
                    ${episode.video_title ? `
                        <div class="episode-title-lite">
                            ${escapeHTML(episode.video_title)}
                        </div>
                    ` : ''}
                    <div class="episode-meta-lite">
                        ${duration ? `
                            <span class="episode-duration-lite">
                                <i class="far fa-clock"></i> ${duration}
                            </span>
                        ` : ''}
                        ${episode.views ? `
                            <span><i class="far fa-eye"></i> ${formatNumber(episode.views)}x</span>
                        ` : ''}
                    </div>
                </div>
                <div class="episode-play-lite">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="episode-item" data-episode-index="${index}">
            <div class="episode-info">
                <div class="episode-number">
                    <span>Episode ${episodeNum}</span>
                    ${isNew ? '<span class="ep-badge">BARU</span>' : ''}
                </div>
                <div class="episode-meta">
                    ${duration ? `
                        <span class="episode-duration">
                            <i class="far fa-clock"></i> ${duration}
                        </span>
                    ` : ''}
                    ${episode.upload_date ? `
                        <span><i class="far fa-calendar"></i> ${episode.upload_date}</span>
                    ` : ''}
                    ${episode.views ? `
                        <span><i class="far fa-eye"></i> ${formatNumber(episode.views)}x</span>
                    ` : ''}
                </div>
            </div>
            <div class="episode-play">
                <i class="fas fa-play"></i>
            </div>
        </div>
    `;
}

function renderSearchResults(results, query) {
    const content = document.getElementById('content');
    if (!content) return;
    
    if (!results.results || results.results.length === 0) {
        renderError(`Tidak ada hasil untuk "${query}"`);
        return;
    }
    
    const isLiteMode = document.documentElement.classList.contains('lite');
    const gridClass = isLiteMode ? 'grid lite' : 'grid';
    
    let html = `
        <div class="search-results-header">
            <h4 style="word-break: break-word;">Hasil pencarian untuk "${escapeHTML(query)}"</h4>
        </div>
        <div class="${gridClass}" id="searchGrid">
    `;
    
    results.results.forEach(drama => {
        if (!drama.book_id) return;
        
        const badges = getBadgesHTML(drama);
        const title = drama.search_high_light?.title?.rich_text || drama.book_name;
        const highlightedTitle = highlightText(title, query);
        const thumbnail = proxyThumbnail(drama.thumb_url, {
            width: isLiteMode ? 120 : 200,
            quality: isLiteMode ? 60 : 80
        });
        
        html += `
            <div class="card" data-book-id="${drama.book_id}">
                ${badges}
                <div class="card-img">
                    <img src="${thumbnail}" 
                         alt="${escapeHTML(drama.book_name)}"
                         loading="lazy"
                         decoding="async">
                </div>
                <div class="card-info">
                    <div class="card-title">
                        ${highlightedTitle}
                    </div>
                    <div class="card-meta">
                        ${escapeHTML(drama.show_creation_status || '')}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    if (results.hasMore) {
        html += `
            <div class="infinite-scroll-loading" id="infiniteScrollLoading" style="display: none;">
                <div class="loading-spinner"></div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    
    setTimeout(() => {
        document.querySelectorAll('.card[data-book-id]').forEach(card => {
            const dramaId = card.getAttribute('data-book-id');
            if (dramaId) {
                card.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'drama-click', data: dramaId }
                    }));
                });
            }
        });
        
        setupInfiniteScroll();
    }, 50);
}

function setupInfiniteScroll() {
    const loadingElement = document.getElementById('infiniteScrollLoading');
    if (!loadingElement) return;
    
    let isFetching = false;
    
    const checkScroll = () => {
        if (isFetching) return;
        
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        
        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
            loadMoreResults();
        }
    };
    
    const loadMoreResults = async () => {
        if (isFetching || !window.AppState?.searchResults?.hasMore) return;
        
        isFetching = true;
        const loadingElement = document.getElementById('infiniteScrollLoading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        
        try {
            const currentOffset = window.AppState.searchResults.results.length;
            const moreResults = await searchDramas(
                window.AppState.searchQuery,
                20,
                currentOffset
            );
            
            if (moreResults.results && moreResults.results.length > 0) {
                window.AppState.searchResults.results = [
                    ...window.AppState.searchResults.results,
                    ...moreResults.results
                ];
                window.AppState.searchResults.hasMore = moreResults.hasMore;
                
                appendNewResults(moreResults.results);
            }
        } catch (error) {
            console.error('Error loading more results:', error);
        } finally {
            isFetching = false;
            const loadingElement = document.getElementById('infiniteScrollLoading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    };
    
    const appendNewResults = (newResults) => {
        const grid = document.getElementById('searchGrid');
        if (!grid) return;
        
        const isLiteMode = document.documentElement.classList.contains('lite');
        
        newResults.forEach(drama => {
            if (!drama.book_id) return;
            
            const badges = getBadgesHTML(drama);
            const title = drama.search_high_light?.title?.rich_text || drama.book_name;
            const highlightedTitle = highlightText(title, window.AppState.searchQuery);
            const thumbnail = proxyThumbnail(drama.thumb_url, {
                width: isLiteMode ? 120 : 200,
                quality: isLiteMode ? 60 : 80
            });
            
            const cardHTML = `
                <div class="card" data-book-id="${drama.book_id}">
                    ${badges}
                    <div class="card-img">
                        <img src="${thumbnail}" 
                             alt="${escapeHTML(drama.book_name)}"
                             loading="lazy"
                             decoding="async">
                    </div>
                    <div class="card-info">
                        <div class="card-title">
                            ${highlightedTitle}
                        </div>
                        <div class="card-meta">
                            ${escapeHTML(drama.show_creation_status || '')}
                        </div>
                    </div>
                </div>
            `;
            
            grid.insertAdjacentHTML('beforeend', cardHTML);
        });
        
        setTimeout(() => {
            document.querySelectorAll('.card[data-book-id]').forEach(card => {
                if (card.onclick) return;
                
                const dramaId = card.getAttribute('data-book-id');
                if (dramaId) {
                    card.addEventListener('click', () => {
                        window.dispatchEvent(new CustomEvent('app-event', {
                            detail: { event: 'drama-click', data: dramaId }
                        }));
                    });
                }
            });
        }, 10);
    };
    
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(checkScroll, 200);
    });
    
    checkScroll();
}

async function handleEpisodeClick(index) {
    if (!window.AppState?.currentDrama?.episodes) return;
    
    const episode = window.AppState.currentDrama.episodes[index];
    if (!episode?.vid) return;
    
    const episodeItem = document.querySelector(`[data-episode-index="${index}"]`);
    if (episodeItem) {
        episodeItem.classList.add('loading');
        const playIcon = episodeItem.querySelector('.episode-play i');
        if (playIcon) {
            playIcon.className = 'fas fa-spinner fa-spin';
        }
    }
    
    try {
        const sources = await loadVideoSources(episode.vid);
        
        openPlayer(episode, sources, index);
        
        window.currentEpisodeIndex = index;
        
    } catch (error) {
        
        if (episodeItem) {
            episodeItem.classList.remove('loading');
            const playIcon = episodeItem.querySelector('.episode-play i');
            if (playIcon) {
                playIcon.className = 'fas fa-play';
            }
        }
        
        alert('Gagal memuat video. Silakan coba lagi.');
    }
}

function getBadgesHTML(drama) {
    const badges = [];
    
    if (drama.is_hot === "1") badges.push({ type: 'hot', text: 'HOT' });
    if (drama.is_new_book === "1") badges.push({ type: 'new', text: 'NEW' });
    if (drama.is_exclusive === "1") badges.push({ type: 'exclusive', text: 'EXCLUSIVE' });
    if (drama.is_dubbed === "1") badges.push({ type: 'dub', text: 'DUB' });
    if (drama.is_native === "1") badges.push({ type: 'original', text: 'ORIGINAL' });
    if (drama.in_bookshelf === "1") badges.push({ type: 'saved', text: 'SAVED' });
    
    if (badges.length === 0) return '';
    
    const badgesHTML = badges.map(badge => 
        `<span class="badge ${badge.type}">${badge.text}</span>`
    ).join('');
    
    return `<div class="badges">${badgesHTML}</div>`;
}

function setupExpandableDescription() {
    const descriptionContent = document.querySelector('.description-content');
    const expandBtn = document.querySelector('.expand-btn');
    
    if (!descriptionContent || !expandBtn) return;
    
    const lineHeight = 1.5;
    const computedStyle = window.getComputedStyle(descriptionContent);
    const fontSize = parseFloat(computedStyle.fontSize);
    const maxHeight = lineHeight * fontSize * 3;
    
    if (descriptionContent.scrollHeight > maxHeight) {
        descriptionContent.classList.add('truncated');
        expandBtn.style.display = 'flex';
        
        let isExpanded = false;
        const expandBtnText = expandBtn.querySelector('span');
        const expandBtnIcon = expandBtn.querySelector('i');
        
        expandBtn.addEventListener('click', () => {
            if (!isExpanded) {
                descriptionContent.classList.remove('truncated');
                expandBtnText.textContent = 'Lebih Sedikit';
                expandBtnIcon.className = 'fas fa-chevron-up';
                isExpanded = true;
            } else {
                descriptionContent.classList.add('truncated');
                expandBtnText.textContent = 'Selengkapnya';
                expandBtnIcon.className = 'fas fa-chevron-down';
                isExpanded = false;
            }
        });
    } else {
        expandBtn.style.display = 'none';
    }
}

window.components = {
    renderGrid,
    renderDetail,
    renderSearchResults
};

// js/player.js
const PlayerState = {
    currentEpisode: null,
    sources: null,
    currentTime: 0,
    isPlaying: false,
    isLoading: false,
    currentEpisodeIndex: -1,
    currentResolution: 'auto',
    wasPlayingBeforeSwitch: false
};

function initVideoPlayer() {
    let videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = 'videoContainer';
        videoContainer.className = 'video-container';
        videoContainer.style.display = 'none';
        document.body.appendChild(videoContainer);
    }
    
    setupFullscreenListeners();
}

function setupFullscreenListeners() {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
}

function openPlayer(episode, sources, episodeIndex) {
    PlayerState.currentEpisode = episode;
    PlayerState.sources = sources;
    PlayerState.currentEpisodeIndex = episodeIndex;
    PlayerState.currentTime = 0;
    PlayerState.isLoading = true;
    PlayerState.wasPlayingBeforeSwitch = false;
    
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    const isLiteMode = document.documentElement.classList.contains('lite');
    const episodeTitle = episode.video_title || `Episode ${episode.vid_index || episodeIndex + 1}`;
    
    let playerHTML;
    if (isLiteMode) {
        playerHTML = buildLitePlayerHTML(episodeTitle, sources);
    } else {
        playerHTML = buildFullPlayerHTML(episodeTitle, sources);
    }
    
    videoContainer.innerHTML = playerHTML;
    videoContainer.style.display = 'block';
    
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        initializePlayerElements();
        loadVideo();
        setupPlayerEventListeners();
    }, 100);
}

function buildFullPlayerHTML(episodeTitle, sources) {
    const resolutions = sources.sources || [];
    let resolutionOptions = '';
    
    if (resolutions.length > 0) {
        resolutions.forEach(source => {
            const isSelected = source.resolution === PlayerState.currentResolution;
            resolutionOptions += `<option value="${source.resolution}" ${isSelected ? 'selected' : ''}>${source.label}</option>`;
        });
    }
    
    if (sources.mainUrl) {
        const isAuto = PlayerState.currentResolution === 'auto';
        resolutionOptions = `<option value="auto" ${isAuto ? 'selected' : ''}>Auto</option>` + resolutionOptions;
    }
    
    return `
        <div class="video-player-wrapper">
            <video 
                id="videoPlayer" 
                class="video-player" 
                playsinline 
                webkit-playsinline
                preload="auto"
            >
                Your browser does not support the video tag.
            </video>
            
            <div class="player-loading" id="playerLoading">
                <div class="loading-spinner-large"></div>
                <div class="loading-text">Memuat video...</div>
            </div>
            
            <div class="video-controls" id="videoControls">
                <div class="controls-top">
                    <button class="control-btn back-btn" id="playerBackBtn">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    
                    <div class="episode-info">
                        <div class="episode-title">${escapeHTML(episodeTitle)}</div>
                        ${resolutions.length > 0 || sources.mainUrl ? `
                            <select class="resolution-select" id="resolutionSelect">
                                ${resolutionOptions}
                            </select>
                        ` : ''}
                    </div>
                </div>
                
                <div class="controls-center">
                    <button class="control-btn-large" id="prevBtn">
                        <i class="fas fa-backward"></i>
                        <span>10s</span>
                    </button>
                    
                    <button class="play-btn" id="playBtn">
                        <i class="fas fa-play"></i>
                    </button>
                    
                    <button class="control-btn-large" id="nextBtn">
                        <i class="fas fa-forward"></i>
                        <span>10s</span>
                    </button>
                </div>
                
                <div class="controls-bottom">
                    <div class="progress-container">
                        <div class="progress-bar-bg">
                            <div class="progress-buffered" id="progressBuffered"></div>
                            <div class="progress-current" id="progressCurrent"></div>
                        </div>
                        <input 
                            type="range" 
                            id="progressSlider" 
                            class="progress-slider" 
                            min="0" 
                            max="100" 
                            value="0"
                            step="0.1"
                        >
                    </div>
                    <div class="video-time" id="videoTime">0:00 / 0:00</div>
                    
                    <div class="controls-right">
                        <div class="volume-container">
                            <button class="control-btn volume-btn" id="volumeBtn">
                                <i class="fas fa-volume-up"></i>
                            </button>
                            <div class="volume-slider-container">
                                <input 
                                    type="range" 
                                    id="volumeSlider" 
                                    class="volume-slider" 
                                    min="0" 
                                    max="100" 
                                    value="80"
                                >
                            </div>
                        </div>
                        <button class="control-btn fullscreen-btn" id="fullscreenBtn">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="player-error" id="playerError" style="display: none;">
                <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="error-message">Gagal memuat video</div>
                <button class="retry-btn" id="retryBtn">Coba Lagi</button>
            </div>
        </div>
    `;
}

function buildLitePlayerHTML(episodeTitle, sources) {
    const resolutions = sources.sources || [];
    let resolutionOptions = '';
    
    if (resolutions.length > 0) {
        resolutions.forEach(source => {
            const isSelected = source.resolution === PlayerState.currentResolution;
            resolutionOptions += `<option value="${source.resolution}" ${isSelected ? 'selected' : ''}>${source.label}</option>`;
        });
    }
    
    if (sources.mainUrl) {
        const isAuto = PlayerState.currentResolution === 'auto';
        resolutionOptions = `<option value="auto" ${isAuto ? 'selected' : ''}>Auto</option>` + resolutionOptions;
    }
    
    return `
        <div class="video-player-wrapper lite">
            <video 
                id="videoPlayer" 
                class="video-player" 
                controls 
                playsinline 
                webkit-playsinline
                preload="auto"
            >
                Your browser does not support the video tag.
            </video>
            
            <div class="lite-controls">
                <button class="lite-btn back-btn" id="playerBackBtn">
                    <i class="fas fa-arrow-left"></i>
                </button>
                
                <div class="episode-info">
                    <div class="episode-title">${escapeHTML(episodeTitle)}</div>
                        
                    ${resolutions.length > 0 || sources.mainUrl ? `
                        <select class="lite-select" id="resolutionSelect">
                            ${resolutionOptions}
                        </select>
                    ` : ''}
                </div>
            </div>
            
            <div class="lite-loading" id="liteLoading">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
}

function initializePlayerElements() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    const savedVolume = localStorage.getItem('playerVolume');
    if (savedVolume !== null) {
        videoPlayer.volume = parseFloat(savedVolume);
    }
    
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.value = (videoPlayer.volume * 100);
    }
}

function loadVideo() {
    const videoPlayer = document.getElementById('videoPlayer');
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    
    if (!videoPlayer) return;
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    const resolutionSelect = document.getElementById('resolutionSelect');
    let selectedSource = null;
    
    if (resolutionSelect) {
        const selectedResolution = resolutionSelect.value;
        PlayerState.currentResolution = selectedResolution;
        
        if (selectedResolution === 'auto' && PlayerState.sources.mainUrl) {
            selectedSource = PlayerState.sources.mainUrl;
        } else {
            selectedSource = PlayerState.sources.sources?.find(
                source => source.resolution === selectedResolution
            )?.url;
        }
    } else if (PlayerState.sources.mainUrl) {
        selectedSource = PlayerState.sources.mainUrl;
        PlayerState.currentResolution = 'auto';
    } else if (PlayerState.sources.sources?.[0]?.url) {
        selectedSource = PlayerState.sources.sources[0].url;
        PlayerState.currentResolution = PlayerState.sources.sources[0].resolution;
    }
    
    if (!selectedSource) {
        showPlayerError('Tidak ada sumber video tersedia');
        return;
    }
    
    if (videoPlayer.src && videoPlayer.src !== selectedSource) {
        PlayerState.wasPlayingBeforeSwitch = !videoPlayer.paused;
        PlayerState.currentTime = videoPlayer.currentTime;
    }
    
    videoPlayer.src = selectedSource;
    
    videoPlayer.load();
    
    const onLoadedData = () => {
        videoPlayer.currentTime = PlayerState.currentTime;
        
        if (PlayerState.wasPlayingBeforeSwitch || PlayerState.isPlaying) {
            videoPlayer.play().catch(error => {
                PlayerState.isPlaying = false;
                updatePlayButton();
            });
        }
        
        videoPlayer.removeEventListener('loadeddata', onLoadedData);
    };
    
    videoPlayer.addEventListener('loadeddata', onLoadedData);
    
    if (!PlayerState.wasPlayingBeforeSwitch) {
        const playPromise = videoPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                PlayerState.isPlaying = false;
                updatePlayButton();
            });
        }
    }
}

function setupPlayerEventListeners() {
    const videoPlayer = document.getElementById('videoPlayer');
    const playBtn = document.getElementById('playBtn');
    const backBtn = document.getElementById('playerBackBtn');
    const resolutionSelect = document.getElementById('resolutionSelect');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressSlider = document.getElementById('progressSlider');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const retryBtn = document.getElementById('retryBtn');
    
    if (!videoPlayer) return;
    
    videoPlayer.addEventListener('loadeddata', handleVideoLoaded);
    videoPlayer.addEventListener('canplay', handleVideoCanPlay);
    videoPlayer.addEventListener('playing', handleVideoPlaying);
    videoPlayer.addEventListener('pause', handleVideoPause);
    videoPlayer.addEventListener('timeupdate', handleTimeUpdate);
    videoPlayer.addEventListener('durationchange', handleDurationChange);
    videoPlayer.addEventListener('progress', handleBuffering);
    videoPlayer.addEventListener('ended', handleVideoEnded);
    videoPlayer.addEventListener('error', handleVideoError);
    videoPlayer.addEventListener('waiting', handleVideoWaiting);
    videoPlayer.addEventListener('seeking', handleVideoSeeking);
    videoPlayer.addEventListener('seeked', handleVideoSeeked);
    
    if (playBtn) {
        playBtn.addEventListener('click', togglePlayPause);
    } else {
        videoPlayer.addEventListener('click', togglePlayPause);
    }
    
    if (backBtn) {
        backBtn.addEventListener('click', closePlayer);
    }
    
    if (resolutionSelect) {
        resolutionSelect.addEventListener('change', handleResolutionChange);
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    if (prevBtn) prevBtn.addEventListener('click', () => seekRelative(-10));
    if (nextBtn) nextBtn.addEventListener('click', () => seekRelative(10));
    
    if (progressSlider) {
        progressSlider.addEventListener('input', handleProgressInput);
        progressSlider.addEventListener('change', handleProgressChange);
    }
    
    if (volumeBtn) {
        volumeBtn.addEventListener('click', toggleMute);
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', handleVolumeChange);
    }
    
    if (retryBtn) {
        retryBtn.addEventListener('click', retryLoadVideo);
    }
    
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) {
        videoContainer.addEventListener('mousemove', showControls);
        videoContainer.addEventListener('touchstart', showControls);
        
        let controlsTimeout;
        function showControls() {
            const controls = document.getElementById('videoControls');
            if (controls) {
                controls.classList.add('visible');
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    if (!PlayerState.isLoading) {
                        controls.classList.remove('visible');
                    }
                }, 3000);
            }
        }
    }
}

function handleVideoLoaded() {
    PlayerState.isLoading = false;
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    const errorOverlay = document.getElementById('playerError');
    if (errorOverlay) {
        errorOverlay.style.display = 'none';
    }
}

function handleVideoCanPlay() {
    PlayerState.isLoading = false;
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    updateTimeDisplay();
}

function handleVideoPlaying() {
    PlayerState.isPlaying = true;
    PlayerState.isLoading = false;
    updatePlayButton();
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function handleVideoPause() {
    PlayerState.isPlaying = false;
    updatePlayButton();
}

function handleTimeUpdate() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    PlayerState.currentTime = videoPlayer.currentTime;
    updateProgress();
    updateTimeDisplay();
}

function handleDurationChange() {
    updateTimeDisplay();
}

function handleBuffering() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    const progressBuffered = document.getElementById('progressBuffered');
    if (progressBuffered && videoPlayer.duration > 0) {
        if (videoPlayer.buffered.length > 0) {
            const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
            const bufferedPercent = (bufferedEnd / videoPlayer.duration) * 100;
            progressBuffered.style.width = `${bufferedPercent}%`;
        }
    }
}

function handleVideoEnded() {
    PlayerState.isPlaying = false;
    updatePlayButton();
    
    const nextEpisodeIndex = PlayerState.currentEpisodeIndex + 1;
    const maxEpisodes = window.AppState?.currentDrama?.episodes?.length || 0;
    
    if (nextEpisodeIndex < maxEpisodes) {
        showNextEpisodeConfirmation(nextEpisodeIndex);
    }
}

function showNextEpisodeConfirmation(nextEpisodeIndex) {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    const nextEpisode = window.AppState.currentDrama.episodes[nextEpisodeIndex];
    const episodeTitle = nextEpisode.video_title || `Episode ${nextEpisode.vid_index || nextEpisodeIndex + 1}`;
    
    const confirmationOverlay = document.createElement('div');
    confirmationOverlay.className = 'next-episode-confirmation';
    confirmationOverlay.innerHTML = `
        <div class="confirmation-content">
            <div class="confirmation-title">Episode Berikutnya</div>
            <div class="confirmation-text">${escapeHTML(episodeTitle)}</div>
            <div class="confirmation-timer" id="countdownTimer">5</div>
            <div class="confirmation-buttons">
                <button class="confirmation-btn cancel-btn" id="cancelNextBtn">Batalkan</button>
                <button class="confirmation-btn playnext-btn" id="playNextBtn">Putar Sekarang</button>
            </div>
        </div>
    `;
    
    videoContainer.appendChild(confirmationOverlay);
    
    let countdown = 5;
    let countdownInterval;
    
    const updateTimer = () => {
        const timerElement = document.getElementById('countdownTimer');
        if (timerElement) {
            timerElement.textContent = countdown;
        }
    };
    
    countdownInterval = setInterval(() => {
        countdown--;
        updateTimer();
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            playNextEpisode(nextEpisodeIndex);
        }
    }, 1000);
    
    document.getElementById('playNextBtn')?.addEventListener('click', () => {
        clearInterval(countdownInterval);
        playNextEpisode(nextEpisodeIndex);
    });
    
    document.getElementById('cancelNextBtn')?.addEventListener('click', () => {
        clearInterval(countdownInterval);
        confirmationOverlay.remove();
    });
}

function playNextEpisode(nextEpisodeIndex) {
    const confirmationOverlay = document.querySelector('.next-episode-confirmation');
    if (confirmationOverlay) {
        confirmationOverlay.remove();
    }
    
    window.dispatchEvent(new CustomEvent('app-event', {
        detail: { event: 'episode-click', data: nextEpisodeIndex }
    }));
}

function handleVideoError(e) {
    PlayerState.isLoading = false;
    
    showPlayerError('Gagal memuat video. Coba resolusi lain.');
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function handleVideoWaiting() {
    PlayerState.isLoading = true;
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function handleVideoSeeking() {
    PlayerState.isLoading = true;
}

function handleVideoSeeked() {
    PlayerState.isLoading = false;
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function togglePlayPause() {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    if (videoPlayer.paused || videoPlayer.ended) {
        videoPlayer.play().catch(error => {
            const playBtn = document.getElementById('playBtn');
            if (playBtn) {
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        });
    } else {
        videoPlayer.pause();
    }
}

function handleResolutionChange(e) {
    const newResolution = e.target.value;
    const videoPlayer = document.getElementById('videoPlayer');
    
    if (!videoPlayer) return;
    
    PlayerState.currentTime = videoPlayer.currentTime;
    PlayerState.wasPlayingBeforeSwitch = !videoPlayer.paused;
    PlayerState.currentResolution = newResolution;
    
    const loadingOverlay = document.getElementById('playerLoading') || document.getElementById('liteLoading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
    
    let newSource = null;
    if (newResolution === 'auto' && PlayerState.sources.mainUrl) {
        newSource = PlayerState.sources.mainUrl;
    } else {
        newSource = PlayerState.sources.sources?.find(
            source => source.resolution === newResolution
        )?.url;
    }
    
    if (!newSource) {
        return;
    }
    
    videoPlayer.src = newSource;
    
    videoPlayer.load();
    
    const onLoadedData = () => {
        videoPlayer.currentTime = PlayerState.currentTime;
        
        if (PlayerState.wasPlayingBeforeSwitch) {
            videoPlayer.play().catch(error => {
                PlayerState.isPlaying = false;
                updatePlayButton();
            });
        }
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        videoPlayer.removeEventListener('loadeddata', onLoadedData);
    };
    
    videoPlayer.addEventListener('loadeddata', onLoadedData);
}

function toggleFullscreen() {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    if (!document.fullscreenElement) {
        if (videoContainer.requestFullscreen) {
            videoContainer.requestFullscreen();
        } else if (videoContainer.webkitRequestFullscreen) {
            videoContainer.webkitRequestFullscreen();
        } else if (videoContainer.mozRequestFullScreen) {
            videoContainer.mozRequestFullScreen();
        } else if (videoContainer.msRequestFullscreen) {
            videoContainer.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function handleFullscreenChange() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!fullscreenBtn) return;
    
    if (document.fullscreenElement) {
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

function seekRelative(seconds) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    const newTime = videoPlayer.currentTime + seconds;
    videoPlayer.currentTime = Math.max(0, Math.min(newTime, videoPlayer.duration || Infinity));
}

function handleProgressInput(e) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    const percent = parseFloat(e.target.value);
    const progressCurrent = document.getElementById('progressCurrent');
    if (progressCurrent) {
        progressCurrent.style.width = `${percent}%`;
    }
}

function handleProgressChange(e) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer || !videoPlayer.duration) return;
    
    const percent = parseFloat(e.target.value);
    const time = (percent / 100) * videoPlayer.duration;
    videoPlayer.currentTime = time;
}

function toggleMute() {
    const videoPlayer = document.getElementById('videoPlayer');
    const volumeBtn = document.getElementById('volumeBtn');
    if (!videoPlayer || !volumeBtn) return;
    
    videoPlayer.muted = !videoPlayer.muted;
    volumeBtn.innerHTML = videoPlayer.muted 
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>';
}

function handleVolumeChange(e) {
    const videoPlayer = document.getElementById('videoPlayer');
    const volumeBtn = document.getElementById('volumeBtn');
    if (!videoPlayer || !volumeBtn) return;
    
    const volume = parseInt(e.target.value) / 100;
    videoPlayer.volume = volume;
    videoPlayer.muted = volume === 0;
    
    localStorage.setItem('playerVolume', volume.toString());
    
    volumeBtn.innerHTML = volume === 0 
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>';
}

function retryLoadVideo() {
    const errorOverlay = document.getElementById('playerError');
    if (errorOverlay) {
        errorOverlay.style.display = 'none';
    }
    
    loadVideo();
}

function handleKeyboardShortcuts(e) {
    const videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) return;
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'f':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'm':
            e.preventDefault();
            toggleMute();
            break;
        case 'arrowleft':
            e.preventDefault();
            seekRelative(-5);
            break;
        case 'arrowright':
            e.preventDefault();
            seekRelative(5);
            break;
        case 'arrowup':
            e.preventDefault();
            adjustVolume(0.1);
            break;
        case 'arrowdown':
            e.preventDefault();
            adjustVolume(-0.1);
            break;
        case 'escape':
            if (document.fullscreenElement) {
                toggleFullscreen();
            }
            break;
    }
}

function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;
    
    playBtn.innerHTML = PlayerState.isPlaying 
        ? '<i class="fas fa-pause"></i>'
        : '<i class="fas fa-play"></i>';
}

function updateProgress() {
    const videoPlayer = document.getElementById('videoPlayer');
    const progressSlider = document.getElementById('progressSlider');
    const progressCurrent = document.getElementById('progressCurrent');
    
    if (!videoPlayer || !videoPlayer.duration) return;
    
    const percent = (PlayerState.currentTime / videoPlayer.duration) * 100;
    
    if (progressSlider) {
        progressSlider.value = percent;
    }
    
    if (progressCurrent) {
        progressCurrent.style.width = `${percent}%`;
    }
}

function updateTimeDisplay() {
    const videoPlayer = document.getElementById('videoPlayer');
    const timeDisplay = document.getElementById('videoTime');
    
    if (!videoPlayer || !timeDisplay) return;
    
    const currentTime = formatTime(PlayerState.currentTime);
    const duration = formatTime(videoPlayer.duration || 0);
    
    timeDisplay.textContent = `${currentTime} / ${duration}`;
}

function showPlayerError(message) {
    const errorOverlay = document.getElementById('playerError');
    if (errorOverlay) {
        const errorMessage = errorOverlay.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        errorOverlay.style.display = 'flex';
    }
}

function adjustVolume(change) {
    const videoPlayer = document.getElementById('videoPlayer');
    const volumeSlider = document.getElementById('volumeSlider');
    if (!videoPlayer || !volumeSlider) return;
    
    let newVolume = videoPlayer.volume + change;
    newVolume = Math.max(0, Math.min(1, newVolume));
    
    videoPlayer.volume = newVolume;
    volumeSlider.value = newVolume * 100;
    
    localStorage.setItem('playerVolume', newVolume.toString());
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function closePlayer() {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        PlayerState.currentTime = videoPlayer.currentTime;
        
        videoPlayer.pause();
        videoPlayer.src = '';
        videoPlayer.load();
    }
    
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    
    videoContainer.style.display = 'none';
    videoContainer.innerHTML = '';
    
    document.body.style.overflow = '';
    
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    
    PlayerState.currentEpisode = null;
    PlayerState.sources = null;
    PlayerState.isPlaying = false;
    PlayerState.isLoading = false;
    PlayerState.wasPlayingBeforeSwitch = false;
    
    updatePlayingEpisode(-1);
}

function updatePlayingEpisode(index) {
    document.querySelectorAll('.episode-item, .episode-item-lite').forEach(item => {
        item.classList.remove('playing');
    });
    
    if (index >= 0) {
        const episodeItem = document.querySelector(`[data-episode-index="${index}"]`);
        if (episodeItem) {
            episodeItem.classList.add('playing');
            episodeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

window.player = {
    openPlayer,
    closePlayer,
    getState: () => PlayerState
};

// js/ui.js

function detectLiteMode() {
    const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory <= 3;
    const isOldAndroid = /Android [5-8]/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth <= 360;
    
    const isLiteMode = hasLowMemory || isOldAndroid || isSmallScreen;
    
    if (isLiteMode) {
        document.documentElement.classList.add('lite');
    }
    
    return isLiteMode;
}

function setupEventListeners(eventHandler) {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'search', data: query }
                }));
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'search', data: query }
                    }));
                }
            }
        });
        
        searchInput.addEventListener('focus', () => {
            searchInput.select();
        });
    }
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            if (category) {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'category-click', data: category }
                }));
            }
        });
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const navItem = btn.getAttribute('data-nav');
            if (navItem) {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'nav-click', data: navItem }
                }));
            }
        });
    });
    
    window.addEventListener('app-event', (e) => {
        if (eventHandler && e.detail) {
            eventHandler(e.detail.event, e.detail.data);
        }
    });
    
    window.addEventListener('popstate', () => {
        window.dispatchEvent(new CustomEvent('app-event', {
            detail: { event: 'nav-click', data: 'back' }
        }));
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const videoContainer = document.getElementById('videoContainer');
            if (videoContainer && videoContainer.style.display === 'block') {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'player-close' }
                }));
            }
        }
        
        if (e.key === ' ' && !e.target.matches('input, textarea, select')) {
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                e.preventDefault();
                if (videoPlayer.paused) {
                    videoPlayer.play();
                } else {
                    videoPlayer.pause();
                }
            }
        }
        
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                e.preventDefault();
                const seekAmount = e.key === 'ArrowLeft' ? -10 : 10;
                videoPlayer.currentTime = Math.max(0, 
                    Math.min(videoPlayer.duration, videoPlayer.currentTime + seekAmount)
                );
            }
        }
    });
    
    window.addEventListener('resize', () => {
        handleResponsive();
    });
    
    handleResponsive();
}

function handleResponsive() {
    const width = window.innerWidth;
    const app = document.getElementById('app');
    
    if (width <= 480) {
        app.classList.add('mobile');
        app.classList.remove('tablet', 'desktop');
    } else if (width <= 768) {
        app.classList.add('tablet');
        app.classList.remove('mobile', 'desktop');
    } else {
        app.classList.add('desktop');
        app.classList.remove('mobile', 'tablet');
    }
}

function updateUI() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        const category = btn.getAttribute('data-category');
        if (category === window.AppState?.currentCategory) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const navItem = btn.getAttribute('data-nav');
        if (navItem === 'home' && window.AppState?.currentPage === 'home') {
            btn.classList.add('active');
        } else if (navItem === 'back' && window.AppState?.history.length > 0) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput && window.AppState?.searchQuery) {
        searchInput.value = window.AppState.searchQuery;
    }
}

function navigate(destination) {
    if (destination === 'back') {
        if (window.AppState?.history.length > 1) {
            window.AppState.history.pop();
            
            const previous = window.AppState.history[window.AppState.history.length - 1];
            
            if (previous.page === 'search') {
                if (window.AppState.searchResults.results && window.AppState.searchResults.results.length > 0) {
                    renderSearchResults(window.AppState.searchResults, previous.query);
                    window.AppState.currentPage = 'search';
                    window.AppState.searchQuery = previous.query;
                    
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) {
                        searchInput.value = previous.query;
                    }
                } else {
                    window.dispatchEvent(new CustomEvent('app-event', {
                        detail: { event: 'search', data: previous.query }
                    }));
                }
            } else if (previous.page === 'home') {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'category-click', data: window.AppState.currentCategory || 'latest' }
                }));
            } else if (previous.page === 'detail') {
                window.dispatchEvent(new CustomEvent('app-event', {
                    detail: { event: 'drama-click', data: previous.dramaId }
                }));
            }
        } else {
            window.dispatchEvent(new CustomEvent('app-event', {
                detail: { event: 'category-click', data: 'latest' }
            }));
        }
    } else if (destination === 'home') {
        window.AppState.history = [{ page: 'home' }];
        window.dispatchEvent(new CustomEvent('app-event', {
            detail: { event: 'category-click', data: 'latest' }
        }));
    }
    
    updateUI();
}

function toggleLiteMode() {
    const isLite = document.documentElement.classList.toggle('lite');
    window.AppState.isLiteMode = isLite;
    
    localStorage.setItem('liteMode', isLite);
    
    if (window.AppState.currentPage === 'detail' && window.AppState.currentDrama) {
        window.dispatchEvent(new CustomEvent('app-event', {
            detail: { event: 'drama-click', data: window.AppState.currentDrama.id }
        }));
    } else {
        window.dispatchEvent(new CustomEvent('app-event', {
            detail: { event: 'category-click', data: window.AppState.currentCategory }
        }));
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function confirmDialog(message, callback) {
    const existing = document.querySelector('.confirm-dialog');
    if (existing) existing.remove();
    
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <div class="dialog-message">${message}</div>
            <div class="dialog-buttons">
                <button class="dialog-btn cancel">Batal</button>
                <button class="dialog-btn confirm">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('.cancel').addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.querySelector('.confirm').addEventListener('click', () => {
        dialog.remove();
        if (callback) callback(true);
    });
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
        dialog.remove();
    });
}

function showLoadingOverlay(message = 'Memuat...') {
    const existing = document.querySelector('.loading-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    return () => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    };
}

window.uiUtils = {
    toggleLiteMode,
    showNotification,
    confirmDialog
};

// js/app.js
import { 
    loadLatestDramas, 
    loadTrendingDramas, 
    searchDramas, 
    loadDramaDetail,
    loadVideoSources 
} from './api.js';
import { 
    renderGrid, 
    renderDetail, 
    renderSearchResults,
    renderLoading,
    renderError 
} from './components.js';
import { 
    initVideoPlayer, 
    openPlayer, 
    closePlayer 
} from './player.js';
import { 
    detectLiteMode, 
    setupEventListeners,
    navigate,
    updateUI 
} from './ui.js';

const AppState = {
    currentPage: 'home',
    currentCategory: 'latest',
    currentDrama: null,
    searchQuery: '',
    searchResults: [],
    history: [],
    isLiteMode: false,
    loading: false
};

function initApp() {
    AppState.isLiteMode = detectLiteMode();
    if (AppState.isLiteMode) {
        document.documentElement.classList.add('lite');
    }
    
    setupEventListeners(handleAppEvent);
    
    initVideoPlayer();
    
    loadInitialContent();
}

function handleAppEvent(event, data) {
    switch (event) {
        case 'category-click':
            handleCategoryClick(data);
            break;
        case 'search':
            handleSearch(data);
            break;
        case 'drama-click':
            handleDramaClick(data);
            break;
        case 'episode-click':
            handleEpisodeClick(data);
            break;
        case 'nav-click':
            handleNavClick(data);
            break;
        case 'player-close':
            closePlayer();
            break;
        case 'player-next':
            handleNextEpisode();
            break;
        case 'player-prev':
            handlePrevEpisode();
            break;
    }
}

async function handleCategoryClick(category) {
    if (AppState.loading) return;
    
    AppState.currentCategory = category;
    AppState.currentPage = 'home';
    AppState.history.push({ 
        page: 'home', 
        category,
        timestamp: Date.now()
    });
    updateUI();
    
    renderLoading();
    
    try {
        let dramas;
        if (category === 'trending') {
            dramas = await loadTrendingDramas();
        } else {
            dramas = await loadLatestDramas();
        }
        
        renderGrid(dramas, category);
    } catch (error) {
        renderError('Gagal memuat drama');
    }
}

async function handleSearch(query) {
    if (!query.trim()) return;
    
    AppState.searchQuery = query;
    AppState.currentPage = 'search';
    AppState.history.push({ 
        page: 'search', 
        query,
        timestamp: Date.now()
    });
    
    AppState.searchResults = {
        results: [],
        hasMore: false,
        total: 0
    };
    
    renderLoading('Mencari...');
    
    try {
        const results = await searchDramas(query);
        AppState.searchResults = results;
        renderSearchResults(results, query);
    } catch (error) {
        console.error('Search error:', error);
        renderError('Pencarian gagal');
    }
}

async function handleDramaClick(dramaId) {
    if (AppState.loading) return;
    
    AppState.currentPage = 'detail';
    AppState.history.push({ 
        page: 'detail', 
        dramaId,
        previousPage: AppState.currentPage,
        previousQuery: AppState.searchQuery
    });
    
    renderLoading('Memuat detail...');
    
    try {
        const dramaDetail = await loadDramaDetail(dramaId);
        AppState.currentDrama = dramaDetail;
        renderDetail(dramaDetail);
    } catch (error) {
        renderError('Gagal memuat detail');
    }
}

async function handleEpisodeClick(episodeIndex) {
    if (!AppState.currentDrama) return;
    
    const episode = AppState.currentDrama.episodes[episodeIndex];
    if (!episode) return;
    
    try {
        const sources = await loadVideoSources(episode.vid);
        openPlayer(episode, sources, episodeIndex);
    } catch (error) {
        alert('Gagal memutar video');
    }
}

function handleNavClick(navItem) {
    switch (navItem) {
        case 'home':
            navigate('home');
            break;
        case 'back':
            navigate('back');
            break;
        case 'search':
            document.getElementById('searchInput').focus();
            break;
    }
}

function handleNextEpisode() {
    if (!AppState.currentDrama) return;
    
    const currentIndex = window.currentEpisodeIndex || 0;
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < AppState.currentDrama.episodes.length) {
        handleEpisodeClick(nextIndex);
    }
}

function handlePrevEpisode() {
    if (!AppState.currentDrama) return;
    
    const currentIndex = window.currentEpisodeIndex || 0;
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
        handleEpisodeClick(prevIndex);
    }
}

async function loadInitialContent() {
    renderLoading();
    
    try {
        const dramas = await loadLatestDramas();
        renderGrid(dramas, 'latest');
    } catch (error) {
        renderError('Gagal memuat konten awal');
    }
}

window.AppState = AppState;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
